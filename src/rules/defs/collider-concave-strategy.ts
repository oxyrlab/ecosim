import { z } from 'zod';
import { expandBodyParts, shapeRegistry } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { RuleViolation } from '../types';
import type { BlueprintBodySubject } from './subject';

/**
 * Declares how non-convex physical shapes are converted into convex Rapier colliders (`reject`,
 * `hull`, or `decompose`) and rejects concave shapes when `strategy` is `'reject'`.
 */
export const colliderConcaveStrategyRule = defineRule({
  id: 'collider-concave-strategy',
  description: 'Controls how concave physical shapes are converted to convex Rapier colliders.',
  rationale:
    'Rapier only supports convex colliders; non-convex shapes must be rejected, wrapped in a hull, or decomposed.',
  scope: 'blueprint',
  category: 'engine-requirement',
  defaultSeverity: 'error',
  params: z.object({
    strategy: z.enum(['reject', 'hull', 'decompose']).default('hull'),
  }),
  check(subject: BlueprintBodySubject, params) {
    if (params.strategy !== 'reject') return [];

    const violations: RuleViolation[] = [];
    for (const part of expandBodyParts(subject.body.parts)) {
      if (part.joint === 'visual') continue;
      const shapeDef = shapeRegistry.get(part.shape.type);
      const { type: _type, ...rawParams } = part.shape;
      void _type;
      const parsed = shapeDef.params.parse(rawParams);
      if (!shapeDef.isConvex(parsed)) {
        violations.push({
          ruleId: 'collider-concave-strategy',
          severity: 'error',
          message: `Physical part "${part.id}" uses a concave "${part.shape.type}" shape while collider-concave-strategy is "reject".`,
          path: `body.parts.${part.id}.shape`,
          actual: 'concave',
          limit: 'convex',
          suggestion:
            'Use a convex shape, switch to joint: "visual", or set strategy to "hull" / "decompose".',
        });
      }
    }
    return violations;
  },
});
