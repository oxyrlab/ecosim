import { clamp } from '@core/index';

/**
 * Visual color and maximum alpha configuration for rendering one environmental or scent field.
 */
export interface FieldHeatmapPalette {
  /** 24-bit RGB hex color (`0xRRGGBB`) for high field values. */
  readonly color: number;
  /** Maximum opacity in `(0, 1]` when normalized intensity equals `1`. */
  readonly maxAlpha: number;
  /** Reference scale floor preventing tiny floating noise from lighting up the entire grid. */
  readonly minScale: number;
}

/**
 * Rendered style for one visible heatmap cell.
 */
export interface HeatmapCellStyle {
  readonly color: number;
  readonly alpha: number;
}

/**
 * Default color palettes for all standard EcoSim grid fields.
 */
export const FIELD_HEATMAP_PALETTES: Readonly<Record<string, FieldHeatmapPalette>> = Object.freeze({
  'scent.plant': { color: 0x4ade80, maxAlpha: 0.6, minScale: 1 },
  'scent.prey': { color: 0x38bdf8, maxAlpha: 0.65, minScale: 1 },
  'scent.predator': { color: 0xf87171, maxAlpha: 0.65, minScale: 1 },
  'scent.corpse': { color: 0xc084fc, maxAlpha: 0.65, minScale: 1 },
  'pheromone.mate': { color: 0xf472b6, maxAlpha: 0.65, minScale: 1 },
  'soil.nutrients': { color: 0xd97706, maxAlpha: 0.55, minScale: 10 },
  'soil.moisture': { color: 0x06b6d4, maxAlpha: 0.55, minScale: 1 },
  light: { color: 0xfef08a, maxAlpha: 0.45, minScale: 1 },
});

const FALLBACK_PALETTE: FieldHeatmapPalette = {
  color: 0x94a3b8,
  maxAlpha: 0.5,
  minScale: 1,
};

/**
 * Maps a single grid cell's scalar `value` into a {@link HeatmapCellStyle}, or returns `null`
 * when the normalized intensity is too faint to draw.
 */
export function mapFieldValueToCellStyle(
  fieldName: string,
  value: number,
  maxValue: number,
): HeatmapCellStyle | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const palette = FIELD_HEATMAP_PALETTES[fieldName] ?? FALLBACK_PALETTE;
  const denom = Math.max(palette.minScale, Number.isFinite(maxValue) ? maxValue : palette.minScale);
  const normalized = clamp(value / denom, 0, 1);
  if (normalized < 0.02) return null;
  return {
    color: palette.color,
    alpha: normalized * palette.maxAlpha,
  };
}
