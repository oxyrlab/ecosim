import { z } from 'zod';
import { defineShape, type PathCommand } from './shape-def';

/** Parameter schema for the `rect` primitive shape (meters). */
export const rectParamsSchema = z.object({
  w: z.number().finite().positive(),
  h: z.number().finite().positive(),
  cornerRadius: z.number().finite().nonnegative().optional(),
});

/** Validated parameters for the `rect` shape. */
export type RectParams = z.infer<typeof rectParamsSchema>;

/**
 * Primitive `rect` shape centered at `(0, 0)` with width `w`, height `h`, and optional `cornerRadius` (meters).
 */
export const rectShape = defineShape({
  id: 'rect',
  description: 'Axis-aligned rectangle with optional rounded corners (dimensions in meters).',
  params: rectParamsSchema,
  bounds(params) {
    return { w: params.w, h: params.h };
  },
  toPath(params): readonly PathCommand[] {
    const hw = params.w * 0.5;
    const hh = params.h * 0.5;
    const r = Math.min(params.cornerRadius ?? 0, hw, hh);
    if (r <= 1e-9) {
      return [
        { kind: 'moveTo', x: -hw, y: -hh },
        { kind: 'lineTo', x: hw, y: -hh },
        { kind: 'lineTo', x: hw, y: hh },
        { kind: 'lineTo', x: -hw, y: hh },
        { kind: 'closePath' },
      ];
    }
    return [
      { kind: 'moveTo', x: -hw + r, y: -hh },
      { kind: 'lineTo', x: hw - r, y: -hh },
      { kind: 'arc', cx: hw - r, cy: -hh + r, radius: r, startAngle: -Math.PI / 2, endAngle: 0 },
      { kind: 'lineTo', x: hw, y: hh - r },
      { kind: 'arc', cx: hw - r, cy: hh - r, radius: r, startAngle: 0, endAngle: Math.PI / 2 },
      { kind: 'lineTo', x: -hw + r, y: hh },
      {
        kind: 'arc',
        cx: -hw + r,
        cy: hh - r,
        radius: r,
        startAngle: Math.PI / 2,
        endAngle: Math.PI,
      },
      { kind: 'lineTo', x: -hw, y: -hh + r },
      {
        kind: 'arc',
        cx: -hw + r,
        cy: -hh + r,
        radius: r,
        startAngle: Math.PI,
        endAngle: (3 * Math.PI) / 2,
      },
      { kind: 'closePath' },
    ];
  },
  toColliders(params) {
    return [{ shape: { kind: 'rect', halfWidth: params.w * 0.5, halfHeight: params.h * 0.5 } }];
  },
  isConvex() {
    return true;
  },
  scaleParams(params, scaleFactor) {
    return {
      w: params.w * scaleFactor,
      h: params.h * scaleFactor,
      ...(params.cornerRadius !== undefined
        ? { cornerRadius: params.cornerRadius * scaleFactor }
        : {}),
    };
  },
  area(params) {
    const r = Math.min(params.cornerRadius ?? 0, params.w * 0.5, params.h * 0.5);
    return params.w * params.h - (4 - Math.PI) * r * r;
  },
});
