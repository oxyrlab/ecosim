import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRegistry, RuleViolationError } from '@core/index';
import { defineRule, registerRule } from './define-rule';
import { assertNoRuleErrors, evaluateRules, formatRuleReport } from './engine';
import { resolveRules } from './resolve-rules';
import type { RuleDef } from './types';

interface DummyBlueprint {
  readonly partCount: number;
  readonly minRadius: number;
}

describe('rule engine (evaluateRules, assertNoRuleErrors, formatRuleReport)', () => {
  function setupRegistry() {
    const registry = createRegistry<RuleDef<unknown, unknown>>('rule');
    registerRule(
      defineRule({
        id: 'max-parts',
        description: 'Caps part count.',
        rationale: 'Rendering cost.',
        scope: 'blueprint',
        category: 'performance',
        defaultSeverity: 'warn',
        params: z.object({ max: z.number().int().positive().default(10) }),
        check(subject: DummyBlueprint, params) {
          if (subject.partCount <= params.max) return [];
          return [
            {
              ruleId: 'max-parts',
              severity: 'warn',
              message: 'Too many parts',
              path: 'body.parts',
              actual: subject.partCount,
              limit: params.max,
              suggestion: 'Merge decorative parts.',
            },
          ];
        },
      }),
      registry,
    );
    registerRule(
      defineRule({
        id: 'min-collider-size',
        description: 'Enforces minimum collider radius.',
        rationale: 'Prevents tunneling.',
        scope: 'blueprint',
        category: 'physics-stability',
        defaultSeverity: 'error',
        params: z.object({ minMeters: z.number().positive().default(0.02) }),
        check(subject: DummyBlueprint, params) {
          if (subject.minRadius >= params.minMeters) return [];
          return [
            {
              ruleId: 'min-collider-size',
              severity: 'error',
              message: 'Collider smaller than minimum threshold',
              actual: subject.minRadius,
              limit: params.minMeters,
            },
          ];
        },
      }),
      registry,
    );
    registerRule(
      defineRule({
        id: 'runtime-only',
        description: 'Runs only in runtime scope.',
        rationale: 'Verifies scope isolation.',
        scope: 'runtime',
        category: 'engine-requirement',
        defaultSeverity: 'error',
        params: z.undefined(),
        check() {
          return [
            {
              ruleId: 'runtime-only',
              severity: 'error',
              message: 'should not run in blueprint scope',
            },
          ];
        },
      }),
      registry,
    );
    return registry;
  }

  it('passes cleanly when no rules are violated', () => {
    const resolved = resolveRules({ registry: setupRegistry(), defaultConfig: {} });
    const report = evaluateRules('blueprint', { partCount: 4, minRadius: 0.1 }, resolved);

    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(() => assertNoRuleErrors(report)).not.toThrow();
    expect(formatRuleReport(report)).toContain('OK (0 violations)');
  });

  it('continues with warnings when only warn-severity rules fail', () => {
    const resolved = resolveRules({ registry: setupRegistry(), defaultConfig: {} });
    const report = evaluateRules('blueprint', { partCount: 15, minRadius: 0.1 }, resolved);

    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]?.ruleId).toBe('max-parts');
    expect(() => assertNoRuleErrors(report, 'rabbit')).not.toThrow();

    const formatted = formatRuleReport(report);
    expect(formatted).toContain('WARN');
    expect(formatted).toContain('actual=15, limit=10');
    expect(formatted).toContain('Suggestion: Merge decorative parts.');
  });

  it('rejects on error severity and respects severity: off', () => {
    const registry = setupRegistry();
    const resolved = resolveRules({
      registry,
      defaultConfig: {},
      worldConfig: {
        'max-parts': { severity: 'off' },
      },
    });

    const report = evaluateRules('blueprint', { partCount: 99, minRadius: 0.005 }, resolved);
    expect(report.ok).toBe(false);
    expect(report.warnings).toHaveLength(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.ruleId).toBe('min-collider-size');

    expect(() => assertNoRuleErrors(report, 'ant')).toThrow(RuleViolationError);
    expect(() => assertNoRuleErrors(report)).toThrow(RuleViolationError);
    expect(formatRuleReport(report)).toContain('FAILED');
  });

  it('stamps effective severity when world config upgrades a warn rule to error', () => {
    const resolved = resolveRules({
      registry: setupRegistry(),
      defaultConfig: {},
      worldConfig: { 'max-parts': { severity: 'error' } },
    });

    const report = evaluateRules('blueprint', { partCount: 12, minRadius: 0.1 }, resolved);
    expect(report.ok).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.severity).toBe('error');
  });
});
