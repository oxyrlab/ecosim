import { z } from 'zod';
import { resolveLayout } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { RuleViolation } from '../types';
import type { BlueprintBodySubject } from './subject';

/**
 * Limits vertex count on any single convex polygon collider to keep narrow-phase collision fast.
 */
export const maxConvexVerticesRule = defineRule({
  id: 'max-convex-vertices',
  description: 'Limits the number of vertices in any single convex physics collider.',
  rationale: 'High-vertex convex hulls increase narrow-phase GJK/EPA collision cost.',
  scope: 'blueprint',
  category: 'performance',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().min(3).default(16),
  }),
  check(subject: BlueprintBodySubject, params) {
    const layout = resolveLayout(subject.body.parts, subject.scale ?? 1, 'hull');
    const violations: RuleViolation[] = [];

    for (const part of layout.parts) {
      if (part.isVisual) continue;
      for (const col of part.colliders) {
        if (col.shape.kind === 'convex' && col.shape.vertices.length > params.max) {
          violations.push({
            ruleId: 'max-convex-vertices',
            severity: 'warn',
            message: `Convex collider on part "${part.id}" has ${col.shape.vertices.length} vertices, exceeding limit ${params.max}.`,
            path: `body.parts.${part.id}.shape`,
            actual: col.shape.vertices.length,
            limit: params.max,
            suggestion: 'Reduce polygon sides or simplify the convex vertex list.',
          });
        }
      }
    }
    return violations;
  },
});
