import type { PartAnimSpec } from '@appearance/types';

/**
 * Purely visual transform offsets computed for an animated body part on the render thread.
 * Never fed back into the simulation (preserving determinism per ADR 0006).
 */
export interface VisualAnimOffset {
  /** Additive visual rotation offset in radians. */
  readonly deltaAngle: number;
  /** Multiplicative X scale factor (> 0). */
  readonly scaleX: number;
  /** Multiplicative Y scale factor (> 0). */
  readonly scaleY: number;
}

/**
 * Evaluates all {@link PartAnimSpec} bindings on a single part using live snapshot channel values
 * and visual render time (`timeSeconds`).
 *
 * - `swing`: direct angular deflection `channelValue * amplitude`
 * - `wag`: sinusoidal oscillation `sin(timeSeconds * 10) * channelValue * amplitude`
 * - `pulse`: rhythmic uniform breathing `1 + sin(timeSeconds * 8) * channelValue * amplitude`
 * - `scale`: direct uniform scale `1 + channelValue * amplitude`
 *
 * @param anims - Animation specs declared on the expanded part.
 * @param channelValues - Snapshot values keyed by resolved channel address.
 * @param timeSeconds - Monotonic render clock in seconds.
 */
export function evaluatePartAnimations(
  anims: readonly PartAnimSpec[],
  channelValues: Readonly<Record<string, number>>,
  timeSeconds: number,
): VisualAnimOffset {
  let deltaAngle = 0;
  let scaleX = 1;
  let scaleY = 1;

  for (const anim of anims) {
    const raw = channelValues[anim.channel] ?? 0;
    const value = Number.isFinite(raw) ? raw : 0;

    switch (anim.kind) {
      case 'swing':
        deltaAngle += value * anim.amplitude;
        break;
      case 'wag':
        deltaAngle += Math.sin(timeSeconds * 10) * value * anim.amplitude;
        break;
      case 'pulse': {
        const factor = Math.max(0.1, 1 + Math.sin(timeSeconds * 8) * value * anim.amplitude);
        scaleX *= factor;
        scaleY *= factor;
        break;
      }
      case 'scale': {
        const factor = Math.max(0.1, 1 + value * anim.amplitude);
        scaleX *= factor;
        scaleY *= factor;
        break;
      }
    }
  }

  return { deltaAngle, scaleX, scaleY };
}
