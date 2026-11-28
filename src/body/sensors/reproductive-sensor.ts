import { z } from 'zod';
import { areOrgansComplementary } from '@body/organs/reproductive-organ';
import { port } from '@bus/ports';
import { clamp } from '@core/index';
import { defineSensor } from './sensor-def';

function wrapRadians(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Zod parameter schema for {@link reproductiveSensor}.
 */
export const reproductiveSensorParamsSchema = z.object({
  detectionRadiusMeters: z.number().finite().positive().default(5),
  minReadyEnergyRatio: z.number().finite().min(0).max(1).default(0.55),
});

/** Validated parameters for {@link reproductiveSensor}. */
export type ReproductiveSensorParams = z.infer<typeof reproductiveSensorParamsSchema>;

/**
 * Lightweight reproductive-organ sensor emitting signals when a complementary conspecific
 * reproductive organ (`reproductive-male` <-> `reproductive-female`) is nearby or overlapping,
 * plus an internal readiness signal (`ready`) so brains can react cleanly to mating opportunities.
 */
export const reproductiveSensor = defineSensor({
  id: 'reproductive-sensor',
  description:
    'Detects nearby and overlapping complementary conspecific reproductive organs and reports readiness.',
  params: reproductiveSensorParamsSchema,
  sampleRateHz: 10,
  outputs: {
    contact: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: '1 when a complementary conspecific reproductive organ overlaps this organ.',
    }),
    'mate.near': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Proximity [0, 1] of the nearest complementary conspecific mate.',
    }),
    'mate.dir': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Relative bearing [-1 left, +1 right] toward nearest complementary mate.',
    }),
    ready: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: '1 when mature and above minReadyEnergyRatio.',
    }),
  },
  create(params, { outputs }) {
    return {
      sample(ctx, out) {
        const selfOrgan = ctx.bodyState?.reproductiveOrgan;
        const isMature = ctx.bodyState?.isMature ?? true;
        const energyRatio = ctx.bodyState?.energyRatio ?? 0;
        const ready = isMature && energyRatio >= params.minReadyEnergyRatio ? 1 : 0;
        out.set(outputs.ready, ready);

        if (selfOrgan === undefined) {
          out.set(outputs.contact, 0);
          out.set(outputs['mate.near'], 0);
          out.set(outputs['mate.dir'], 0);
          return;
        }

        const neighbors = ctx.queryNeighbors(selfOrgan.worldPosition, params.detectionRadiusMeters);
        let inContact = 0;
        let nearestDist = Number.POSITIVE_INFINITY;
        let nearestDir = 0;

        for (let i = 0; i < neighbors.length; i += 1) {
          const n = neighbors[i];
          if (n === undefined || n.entityId === ctx.entityId) continue;
          const otherOrgan = n.reproductiveOrgan;
          if (otherOrgan === undefined) continue;
          if (otherOrgan.speciesId !== selfOrgan.speciesId) continue;
          if (!areOrgansComplementary(selfOrgan, otherOrgan)) continue;

          const dx = otherOrgan.worldPosition.x - selfOrgan.worldPosition.x;
          const dy = otherOrgan.worldPosition.y - selfOrgan.worldPosition.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= selfOrgan.contactRadiusMeters + otherOrgan.contactRadiusMeters) {
            inContact = 1;
          }
          if (dist < nearestDist && dist <= params.detectionRadiusMeters) {
            nearestDist = dist;
            const relAngle = wrapRadians(Math.atan2(dy, dx) - ctx.angle);
            nearestDir = clamp(relAngle / Math.PI, -1, 1);
          }
        }

        const proximity =
          nearestDist <= params.detectionRadiusMeters
            ? clamp(1 - nearestDist / params.detectionRadiusMeters, 0, 1)
            : 0;

        out.set(outputs.contact, inContact);
        out.set(outputs['mate.near'], proximity);
        out.set(outputs['mate.dir'], nearestDir);
      },
    };
  },
});
