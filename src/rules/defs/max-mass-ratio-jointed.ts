import { z } from 'zod';
import { resolveLayout } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { RuleViolation } from '../types';
import type { BlueprintBodySubject } from './subject';

/**
 * Caps the mass ratio between any two rigid bodies connected by a joint to prevent solver jitter.
 */
export const maxMassRatioJointedRule = defineRule({
  id: 'max-mass-ratio-jointed',
  description: 'Caps the mass ratio between any two directly jointed rigid bodies.',
  rationale: 'Large mass ratios across physics joints cause numerical instability and jitter.',
  scope: 'blueprint',
  category: 'physics-stability',
  defaultSeverity: 'warn',
  params: z.object({
    maxRatio: z.number().finite().min(1).default(10),
  }),
  check(subject: BlueprintBodySubject, params) {
    const layout = resolveLayout(subject.body.parts, subject.scale ?? 1, 'hull');
    const massByGroup = new Map<string, number>();
    for (const group of layout.rigidBodyGroups) {
      massByGroup.set(group.id, group.totalMass);
    }

    const violations: RuleViolation[] = [];
    for (const joint of layout.joints) {
      const mA = massByGroup.get(joint.parentGroupId) ?? 0;
      const mB = massByGroup.get(joint.childGroupId) ?? 0;
      const minMass = Math.min(mA, mB);
      const maxMass = Math.max(mA, mB);
      const ratio = minMass > 0 ? maxMass / minMass : Number.POSITIVE_INFINITY;
      if (ratio > params.maxRatio) {
        violations.push({
          ruleId: 'max-mass-ratio-jointed',
          severity: 'warn',
          message: `Joint "${joint.id}" connects bodies with mass ratio ${ratio.toFixed(2)}, exceeding limit ${params.maxRatio}.`,
          path: `body.parts.${joint.childGroupId}`,
          actual: Number(ratio.toFixed(2)),
          limit: params.maxRatio,
          suggestion: 'Adjust part massDensity or size so connected bodies have closer mass.',
        });
      }
    }
    return violations;
  },
});
