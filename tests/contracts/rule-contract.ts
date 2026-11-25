import { describe, expect, it } from 'vitest';
import { createRegistry, isKebabCaseId } from '@core/index';
import {
  evaluateRules,
  registerRule,
  resolveRules,
  type RuleContext,
  type RuleDef,
} from '@rules/index';

/**
 * Fixtures required by {@link runRuleContract} to verify a {@link RuleDef}.
 *
 * @typeParam S - Subject type checked by the rule.
 */
export interface RuleContractFixtures<S> {
  /** Subject expected to pass with zero violations. */
  readonly validSubject: S;
  /** Subject expected to trigger at least one violation. */
  readonly violatingSubject: S;
  /** Optional parameter override used when resolving the rule under test. */
  readonly params?: unknown;
  /** Optional evaluation context passed to `evaluateRules`. */
  readonly context?: RuleContext;
}

/**
 * Shared contract suite that every registered {@link RuleDef} must satisfy:
 * 1. Valid kebab-case id, non-empty description, and documented rationale.
 * 2. Produces zero violations on a valid subject.
 * 3. Produces descriptive violations on a violating subject under `error` and `warn`, and none under `off`.
 * 4. Deterministic: repeated evaluations produce identical violations.
 *
 * @typeParam P - Validated parameter type.
 * @typeParam S - Subject type.
 * @param def - Rule definition under test.
 * @param fixtures - Valid and violating subjects for the rule.
 */
export function runRuleContract<P, S>(def: RuleDef<P, S>, fixtures: RuleContractFixtures<S>): void {
  describe(`RuleContract(${def.id})`, () => {
    const buildResolved = (severity: 'error' | 'warn' | 'off') => {
      const registry = createRegistry<RuleDef<unknown, unknown>>('rule');
      registerRule(def, registry);
      const entry =
        fixtures.params !== undefined ? { severity, params: fixtures.params } : { severity };
      return resolveRules({
        registry,
        defaultConfig: { [def.id]: entry },
      });
    };

    it('declares valid self-describing metadata and rationale', () => {
      expect(isKebabCaseId(def.id)).toBe(true);
      expect(def.description.trim().length).toBeGreaterThan(0);
      expect(def.rationale.trim().length).toBeGreaterThan(0);
    });

    it('passes cleanly on a valid subject', () => {
      const resolved = buildResolved('error');
      const report = evaluateRules(def.scope, fixtures.validSubject, resolved, fixtures.context);
      expect(report.ok).toBe(true);
      expect(report.violations).toEqual([]);
    });

    it('behaves consistently under error, warn, and off severities', () => {
      const errorReport = evaluateRules(
        def.scope,
        fixtures.violatingSubject,
        buildResolved('error'),
        fixtures.context,
      );
      expect(errorReport.ok).toBe(false);
      expect(errorReport.errors.length).toBeGreaterThan(0);
      for (const violation of errorReport.errors) {
        expect(violation.ruleId).toBe(def.id);
        expect(violation.severity).toBe('error');
        expect(violation.message.trim().length).toBeGreaterThan(0);
      }

      const warnReport = evaluateRules(
        def.scope,
        fixtures.violatingSubject,
        buildResolved('warn'),
        fixtures.context,
      );
      expect(warnReport.ok).toBe(true);
      expect(warnReport.errors).toHaveLength(0);
      expect(warnReport.warnings.length).toBe(errorReport.errors.length);

      const offReport = evaluateRules(
        def.scope,
        fixtures.violatingSubject,
        buildResolved('off'),
        fixtures.context,
      );
      expect(offReport.ok).toBe(true);
      expect(offReport.violations).toEqual([]);
    });

    it('is deterministic across repeated evaluations', () => {
      const resolved = buildResolved('error');
      const first = evaluateRules(def.scope, fixtures.violatingSubject, resolved, fixtures.context);
      const second = evaluateRules(
        def.scope,
        fixtures.violatingSubject,
        resolved,
        fixtures.context,
      );
      expect(first).toEqual(second);
    });
  });
}
