import { z } from 'zod';
import { port, type PortDef, type PortHandle, type PortMap } from '@bus/ports';
import { defineSensor, type NeighborObservation } from './sensor-def';

/**
 * Zod parameter schema for {@link visionSensor} (Section 5.7).
 */
export const visionSensorParamsSchema = z.object({
  rangeMeters: z.number().finite().positive().default(8),
  fovRadians: z
    .number()
    .finite()
    .positive()
    .max(Math.PI * 2)
    .default(Math.PI * 0.75),
  sectors: z.number().int().min(1).default(8),
  tags: z.array(z.string().min(1)).default(['plant', 'predator']),
  occlusion: z.enum(['none', 'raycast']).default('none'),
  maxEntityRadiusMeters: z.number().finite().positive().default(2),
});

/** Validated parameters for {@link visionSensor}. */
export type VisionSensorParams = z.infer<typeof visionSensorParamsSchema>;

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Sector-based directional vision sensor (Section 5.7).
 * Finds neighbors via `SpatialHash`, filters them to the `fovRadians` cone (with optional Rapier
 * raycast occlusion), bins them into `sectors`, and outputs:
 * - `sector.distance` (`[0, 1]`, `1` = nothing seen)
 * - `sector.size` (`[0, 1]`, normalized by `maxEntityRadiusMeters`)
 * - per configured `tag`: `sector.tag.<tag>` (`[0, 1]`), `seen.<tag>` (nearest proximity `[0, 1]`),
 *   and `dir.<tag>` (normalized bearing `[-1, 1]`, `-1` left, `+1` right).
 */
export const visionSensor = defineSensor({
  id: 'vision-sensor',
  description:
    'Sector-based FOV vision sensor reporting per-sector distance, size, and tag-filtered target bearings.',
  params: visionSensorParamsSchema,
  sampleRateHz: 10,
  outputs(params): PortMap {
    const out: Record<string, PortDef> = {
      'sector.distance': port.analog({
        count: params.sectors,
        range: [0, 1],
        unit: 'normalized',
        description: 'Normalized distance to nearest visible object in each sector (1 = empty).',
      }),
      'sector.size': port.analog({
        count: params.sectors,
        range: [0, 1],
        unit: 'normalized',
        description: 'Normalized radius of nearest visible object in each sector.',
      }),
    };
    for (const tag of params.tags) {
      out[`sector.tag.${tag}`] = port.analog({
        count: params.sectors,
        range: [0, 1],
        unit: 'normalized',
        description: `1 if nearest visible object in sector has tag "${tag}", else 0.`,
      });
      out[`seen.${tag}`] = port.analog({
        range: [0, 1],
        unit: 'normalized',
        description: `Proximity (1 - distance/range) of nearest visible entity with tag "${tag}".`,
      });
      out[`dir.${tag}`] = port.analog({
        range: [-1, 1],
        unit: 'normalized',
        description: `Normalized bearing in FOV to nearest visible "${tag}" (-1 left, +1 right).`,
      });
    }
    return out;
  },
  create(params, { outputs }) {
    const sectors = params.sectors;
    const halfFov = params.fovRadians * 0.5;
    const range = params.rangeMeters;
    const invRange = 1 / range;
    const invMaxRadius = 1 / params.maxEntityRadiusMeters;
    const tags = params.tags;

    // Pre-allocated scratch buffers so sample() allocates nothing in the hot loop.
    const bestSectorDist = new Float32Array(sectors);
    const bestSectorSize = new Float32Array(sectors);
    const sectorTagMask = new Uint8Array(sectors * tags.length);
    const bestTagDist = new Float32Array(tags.length);
    const bestTagDir = new Float32Array(tags.length);

    const distHandle = outputs['sector.distance'] as PortHandle;
    const sizeHandle = outputs['sector.size'] as PortHandle;
    const sectorTagHandles = tags.map((t) => outputs[`sector.tag.${t}`] as PortHandle);
    const seenHandles = tags.map((t) => outputs[`seen.${t}`] as PortHandle);
    const dirHandles = tags.map((t) => outputs[`dir.${t}`] as PortHandle);

    return {
      sample(ctx, out) {
        bestSectorDist.fill(range);
        bestSectorSize.fill(0);
        sectorTagMask.fill(0);
        bestTagDist.fill(range);
        bestTagDir.fill(0);

        const neighbors = ctx.queryNeighbors(ctx.position, range);
        for (let i = 0; i < neighbors.length; i += 1) {
          const other = neighbors[i] as NeighborObservation;
          if (other.entityId === ctx.entityId) continue;

          const dx = other.position.x - ctx.position.x;
          const dy = other.position.y - ctx.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= 1e-6 || dist > range) continue;

          const relAngle = normalizeAngle(Math.atan2(dy, dx) - ctx.angle);
          if (Math.abs(relAngle) > halfFov) continue;

          if (params.occlusion === 'raycast') {
            const hit = ctx.castRay(ctx.position, { x: dx, y: dy }, dist);
            if (
              hit !== null &&
              hit.entityId !== other.entityId &&
              hit.distance < dist - other.radius
            ) {
              continue;
            }
          }

          const normalizedPos = (relAngle + halfFov) / params.fovRadians;
          const sectorIdx = Math.min(sectors - 1, Math.max(0, Math.floor(normalizedPos * sectors)));

          if (dist < (bestSectorDist[sectorIdx] as number)) {
            bestSectorDist[sectorIdx] = dist;
            bestSectorSize[sectorIdx] = Math.min(1, other.radius * invMaxRadius);
            for (let t = 0; t < tags.length; t += 1) {
              sectorTagMask[t * sectors + sectorIdx] = other.tags.has(tags[t] as string) ? 1 : 0;
            }
          }

          const bearing = relAngle / halfFov;
          for (let t = 0; t < tags.length; t += 1) {
            if (other.tags.has(tags[t] as string) && dist < (bestTagDist[t] as number)) {
              bestTagDist[t] = dist;
              bestTagDir[t] = bearing;
            }
          }
        }

        for (let s = 0; s < sectors; s += 1) {
          out.set(distHandle, (bestSectorDist[s] as number) * invRange, s);
          out.set(sizeHandle, bestSectorSize[s] as number, s);
          for (let t = 0; t < tags.length; t += 1) {
            out.set(sectorTagHandles[t] as PortHandle, sectorTagMask[t * sectors + s] as number, s);
          }
        }

        for (let t = 0; t < tags.length; t += 1) {
          const d = bestTagDist[t] as number;
          const proximity = d < range ? 1 - d * invRange : 0;
          out.set(seenHandles[t] as PortHandle, proximity);
          out.set(dirHandles[t] as PortHandle, d < range ? (bestTagDir[t] as number) : 0);
        }
      },
    };
  },
});
