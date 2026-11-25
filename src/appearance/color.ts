import { z } from 'zod';

/**
 * Heritable HSL color gene used for procedural creature appearance and tinting.
 * - `h`: hue in degrees `[0, 360)`
 * - `s`: saturation in `[0, 1]`
 * - `l`: lightness in `[0, 1]`
 */
export interface ColorGene {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

/**
 * Zod schema validating a {@link ColorGene}.
 */
export const colorGeneSchema: z.ZodType<ColorGene> = z.object({
  h: z.number().finite().min(0).max(360),
  s: z.number().finite().min(0).max(1),
  l: z.number().finite().min(0).max(1),
});

/**
 * Converts an HSL {@link ColorGene} into a packed 24-bit RGB hex integer (`0xRRGGBB`).
 *
 * @param color - Validated HSL color gene.
 * @returns Integer in `[0x000000, 0xffffff]`.
 */
export function colorGeneToHex(color: ColorGene): number {
  const h = ((color.h % 360) + 360) % 360;
  const s = Math.max(0, Math.min(1, color.s));
  const l = Math.max(0, Math.min(1, color.l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c * 0.5;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}
