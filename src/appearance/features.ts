import { clamp } from '@core/index';
import type { ResolvedBodyLayout } from './types';

/**
 * Normalized `[0, 1]` visual appearance feature vector of a creature (Section 5.7).
 * Used by learning modules (`threat-memory`) so creatures recognize *what another creature looks
 * like* rather than inspecting opaque species IDs or tags.
 */
export interface AppearanceFeatures {
  /** Normalized overall physical size in `[0, 1]` (`hypot(w, h) / 2`). */
  readonly size: number;
  /** Dominant body fill hue in `[0, 1]` (`h / 360`). */
  readonly hue: number;
  /** Dominant body fill lightness in `[0, 1]`. */
  readonly lightness: number;
  /** Dominant primitive shape encoded stably in `[0, 1]`. */
  readonly shape: number;
  /** Normalized expanded part count in `[0, 1]` (`partCount / 16`). */
  readonly parts: number;
}

const SHAPE_CODES: Readonly<Record<string, number>> = Object.freeze({
  circle: 0.1,
  ellipse: 0.25,
  rect: 0.4,
  capsule: 0.55,
  triangle: 0.7,
  polygon: 0.85,
  convex: 1.0,
});

/**
 * Extracts a deterministic, normalized `[0, 1]` {@link AppearanceFeatures} vector from a
 * creature's {@link ResolvedBodyLayout}.
 */
export function extractAppearanceFeatures(layout: ResolvedBodyLayout): AppearanceFeatures {
  const diag = Math.hypot(layout.overallBounds.w, layout.overallBounds.h);
  const size = clamp(diag / 2, 0, 1);

  let dominantArea = -1;
  let hue = 0.5;
  let lightness = 0.5;
  let shape = 0.1;

  for (const resolved of layout.parts) {
    const area = resolved.bounds.w * resolved.bounds.h;
    if (area > dominantArea) {
      dominantArea = area;
      const fill = resolved.part.style?.fill;
      if (fill !== undefined) {
        hue = clamp((((fill.h % 360) + 360) % 360) / 360, 0, 1);
        lightness = clamp(fill.l, 0, 1);
      }
      shape = SHAPE_CODES[resolved.part.shape.type] ?? 0.5;
    }
  }

  const parts = clamp(layout.parts.length / 16, 0, 1);
  return Object.freeze({ size, hue, lightness, shape, parts });
}
