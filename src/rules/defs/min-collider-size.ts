import { z } from 'zod';
import { computePointsBounds, resolveLayout } from '@appearance/index';
import type { ColliderShapeDesc } from '@physics/types';
import { defineRule } from '../define-rule';
import type { RuleViolation } from '../types';
import type { BlueprintBodySubject } from './subject';

function minColliderExtentMeters(shape: ColliderShapeDesc): number {
  switch (shape.kind) {
    case 'circle':
      return shape.radius * 2;
    case 'rect':
      return Math.min(shape.halfWidth, shape.halfHeight) * 2;
    case 'capsule':
      return shape.radius * 2;
    case 'convex': {
      const bounds = computePointsBounds(shape.vertices);
      return Math.min(bounds.w, bounds.h);
    }
  }
}

/**
 * Enforces a minimum physical collider dimension in SI meters so small colliders do not tunnel.
 */
export const minColliderSizeRule = defineRule({
  id: 'min-collider-size',
  description: 'Requires every physical collider to meet a minimum extent in SI meters.',
  rationale: 'Tiny colliders tunnel through walls and degrade continuous collision accuracy.',
  scope: 'blueprint',
  category: 'physics-stability',
  defaultSeverity: 'error',
  params: z.object({
    minMeters: z.number().finite().positive().default(0.02),
  }),
  check(subject: BlueprintBodySubject, params) {
    const layout = resolveLayout(subject.body.parts, subject.scale ?? 1, 'hull');
    const violations: RuleViolation[] = [];

    for (const part of layout.parts) {
      if (part.isVisual) continue;
      for (const col of part.colliders) {
        const extent = minColliderExtentMeters(col.shape);
        if (extent < params.minMeters) {
          violations.push({
            ruleId: 'min-collider-size',
            severity: 'error',
            message: `Collider on part "${part.id}" has minimum extent ${extent.toFixed(4)} m, below ${params.minMeters} m.`,
            path: `body.parts.${part.id}.shape`,
            actual: Number(extent.toFixed(4)),
            limit: params.minMeters,
            suggestion: 'Enlarge the shape or change this part to joint: "visual".',
          });
        }
      }
    }
    return violations;
  },
});
