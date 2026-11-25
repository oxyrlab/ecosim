import { z } from 'zod';
import { port, type PortDef, type PortHandle, type PortMap } from '@bus/ports';
import { defineSensor } from './sensor-def';

/**
 * Zod parameter schema for {@link olfactorySensor} (Section 5.6).
 */
export const olfactorySensorParamsSchema = z.object({
  channels: z.array(z.string().min(1)).min(1).default(['scent.plant']),
  antennaSpreadMeters: z.number().finite().positive().default(0.2),
  maxIntensity: z.number().finite().positive().default(10),
});

/** Validated parameters for {@link olfactorySensor}. */
export type OlfactorySensorParams = z.infer<typeof olfactorySensorParamsSchema>;

/**
 * Stereo olfactory sensor sampling each configured scent field at two points (left & right of the
 * sensor's heading) via bilinear interpolation (Section 5.6).
 * For each scent channel `<ch>`, outputs:
 * - `intensity.<ch>` in `[0, 1]` (mean left/right intensity normalized by `maxIntensity`)
 * - `gradient.<ch>` in `[-1, 1]` (`(right - left) / maxIntensity`, positive = stronger on right).
 */
export const olfactorySensor = defineSensor({
  id: 'olfactory-sensor',
  description:
    'Stereo scent sensor sampling left/right field points with bilinear interpolation to output intensity and gradient.',
  params: olfactorySensorParamsSchema,
  sampleRateHz: 10,
  outputs(params): PortMap {
    const out: Record<string, PortDef> = {};
    for (const ch of params.channels) {
      out[`intensity.${ch}`] = port.analog({
        range: [0, 1],
        unit: 'normalized',
        description: `Mean bilinear concentration of field "${ch}" across left/right antennae.`,
      });
      out[`gradient.${ch}`] = port.analog({
        range: [-1, 1],
        unit: 'normalized',
        description: `Right-minus-left gradient of field "${ch}" (> 0 means stronger to the right).`,
      });
    }
    return out;
  },
  create(params, { outputs }) {
    const channels = params.channels;
    const halfSpread = params.antennaSpreadMeters * 0.5;
    const invMax = 1 / params.maxIntensity;
    const intensityHandles = channels.map((ch) => outputs[`intensity.${ch}`] as PortHandle);
    const gradientHandles = channels.map((ch) => outputs[`gradient.${ch}`] as PortHandle);

    return {
      sample(ctx, out) {
        // Right normal for heading angle: (-sin(a), cos(a)); Left normal: (sin(a), -cos(a))
        const rightX = -Math.sin(ctx.angle) * halfSpread;
        const rightY = Math.cos(ctx.angle) * halfSpread;

        const lx = ctx.position.x - rightX;
        const ly = ctx.position.y - rightY;
        const rx = ctx.position.x + rightX;
        const ry = ctx.position.y + rightY;

        for (let i = 0; i < channels.length; i += 1) {
          const ch = channels[i] as string;
          const leftVal = ctx.sampleField(ch, lx, ly);
          const rightVal = ctx.sampleField(ch, rx, ry);

          const meanNorm = (leftVal + rightVal) * 0.5 * invMax;
          const gradNorm = (rightVal - leftVal) * invMax;

          out.set(intensityHandles[i] as PortHandle, meanNorm);
          out.set(gradientHandles[i] as PortHandle, gradNorm);
        }
      },
    };
  },
});
