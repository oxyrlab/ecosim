import { z } from 'zod';
import {
  defineRule,
  type RuleContext,
  type RuleDef,
  type RuleScope,
  type RuleSeverity,
} from '@rules/index';

/**
 * Options for constructing a deterministic numeric-threshold test rule.
 */
export interface TestRuleOptions {
  readonly id?: string;
  readonly scope?: RuleScope;
  readonly defaultSeverity?: RuleSeverity;
  readonly defaultLimit?: number;
}

/**
 * Creates a simple {@link RuleDef} checking `subject <= params.limit` for engine and contract tests.
 *
 * @param options - Optional overrides for rule id, scope, severity, and limit.
 */
export function createTestRuleDef(
  options: TestRuleOptions = {},
): RuleDef<{ limit: number }, number> {
  const id = options.id ?? 'test-max-value';
  const scope = options.scope ?? 'blueprint';
  const defaultSeverity = options.defaultSeverity ?? 'warn';
  const defaultLimit = options.defaultLimit ?? 10;

  return defineRule({
    id,
    description: 'Test rule asserting that a numeric value does not exceed limit.',
    rationale: 'Used in Phase 0 test suites to verify rule engine and contract behavior.',
    scope,
    category: 'simplicity',
    defaultSeverity,
    params: z.object({ limit: z.number().nonnegative().default(defaultLimit) }),
    check(subject: number, params) {
      if (subject <= params.limit) return [];
      return [
        {
          ruleId: id,
          severity: defaultSeverity,
          message: `Value ${subject} exceeds configured limit ${params.limit}.`,
          actual: subject,
          limit: params.limit,
          suggestion: `Reduce value to at most ${params.limit}.`,
        },
      ];
    },
  });
}

/**
 * Creates a {@link RuleContext} with optional overrides for tests.
 *
 * @param overrides - Partial context fields.
 */
export function createTestRuleContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    worldTick: 0,
    ...overrides,
  };
}
