import type { ComponentMeta, EntityId, RuleViolationDetail } from '@core/index';

/**
 * Enforcement behavior of a Constraint Rule.
 * - `error`: rejects a Blueprint, blocks a spawn, or triggers an error action at runtime.
 * - `warn`: records a warning without halting execution.
 * - `off`: disables evaluation of the rule.
 */
export type RuleSeverity = 'error' | 'warn' | 'off';

/**
 * Lifecycle stage at which a Constraint Rule runs.
 */
export type RuleScope = 'blueprint' | 'spawn' | 'runtime';

/**
 * Classification explaining the broad motivation for a Constraint Rule.
 */
export type RuleCategory =
  'performance' | 'physics-stability' | 'simplicity' | 'engine-requirement';

/**
 * Additional read-only context passed into `RuleDef.check()`.
 */
export interface RuleContext {
  /** Current simulation tick index, when running in `runtime` or `spawn` scope. */
  readonly worldTick?: number;
  /** Entity identifier associated with the check, if any. */
  readonly entityId?: EntityId;
  /** Species identifier associated with the check, if any. */
  readonly speciesId?: string;
  /** Arbitrary structured metadata supplied by the caller. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Individual violation reported by a Constraint Rule.
 */
export interface RuleViolation extends RuleViolationDetail {
  /** Measured value that broke the rule, if numeric or categorical. */
  readonly actual?: number | string;
  /** Configured limit that was exceeded or violated. */
  readonly limit?: number | string;
  /** Actionable hint for resolving the violation. */
  readonly suggestion?: string;
}

/**
 * Species-level override declared inside `blueprint.ruleOverrides`.
 * Every override requires a documented `reason`.
 */
export interface RuleOverride {
  /** Target rule identifier (`kebab-case`). */
  readonly ruleId: string;
  /** Optional severity override. */
  readonly severity?: RuleSeverity;
  /** Optional parameter override (merged with lower layers and validated against Zod). */
  readonly params?: unknown;
  /** Mandatory explanation of why this species needs an exception. */
  readonly reason: string;
}

/**
 * Layer 1 (default) configuration entry for a single rule.
 */
export interface RuleConfigEntry {
  /** Override for the rule's default severity. */
  readonly severity?: RuleSeverity;
  /** Default parameter object or value validated by the rule's Zod schema. */
  readonly params?: unknown;
}

/**
 * Layer 2 (world/scenario) configuration entry for a single rule.
 */
export interface WorldRuleConfigEntry extends RuleConfigEntry {
  /**
   * When `false`, species-level `blueprint.ruleOverrides` targeting this rule are rejected.
   * Defaults to `true`.
   */
  readonly allowSpeciesOverride?: boolean;
}

/**
 * Self-describing definition of a Constraint Rule.
 *
 * @typeParam P - Validated parameter type parsed from `params`.
 * @typeParam S - Subject type inspected by `check()`.
 */
export interface RuleDef<P, S> extends ComponentMeta<P> {
  /** Stage at which this rule executes. */
  readonly scope: RuleScope;
  /** Category of constraint. */
  readonly category: RuleCategory;
  /** Documented rationale explaining why this rule exists; included in `docs/catalog/rules.md`. */
  readonly rationale: string;
  /** Default severity when no config layer overrides it. */
  readonly defaultSeverity: RuleSeverity;
  /**
   * Evaluates `subject` under validated `params` and returns zero or more violations.
   * Returned violations may omit `severity` normalization; the engine stamps effective severity.
   */
  check(subject: S, params: P, ctx: RuleContext): RuleViolation[];
}

/**
 * A rule combined with its effective severity and validated parameters after three-layer resolution.
 *
 * @typeParam P - Validated parameter type.
 * @typeParam S - Subject type.
 */
export interface ResolvedRule<P, S> {
  /** Underlying registered rule definition. */
  readonly def: RuleDef<P, S>;
  /** Effective severity after resolving default, world, and species layers. */
  readonly severity: RuleSeverity;
  /** Validated parameters after merging all layers. */
  readonly params: P;
  /** Whether layer 2 allows species overrides for this rule. */
  readonly allowSpeciesOverride: boolean;
  /** Layer that last modified this rule's effective configuration. */
  readonly source: 'definition' | 'default' | 'world' | 'species';
}

/**
 * Collection of resolved rules ready for evaluation by the {@link evaluateRules} engine.
 */
export interface ResolvedRuleSet {
  /** All resolved rules keyed by rule id. */
  readonly rules: ReadonlyMap<string, ResolvedRule<unknown, unknown>>;
  /** Looks up a single resolved rule by id. */
  get(ruleId: string): ResolvedRule<unknown, unknown> | undefined;
  /** Returns all resolved rules matching `scope` in deterministic registration order. */
  byScope(scope: RuleScope): readonly ResolvedRule<unknown, unknown>[];
}

/**
 * Aggregated output of running all active rules for a given scope against a subject.
 */
export interface RuleEvaluationReport {
  /** Scope that was evaluated. */
  readonly scope: RuleScope;
  /** `true` when zero `error`-severity violations occurred. */
  readonly ok: boolean;
  /** Every violation produced (errors and warnings combined). */
  readonly violations: readonly RuleViolation[];
  /** Violations at `error` severity. */
  readonly errors: readonly RuleViolation[];
  /** Violations at `warn` severity. */
  readonly warnings: readonly RuleViolation[];
}
