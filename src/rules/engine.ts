import { RuleViolationError } from '@core/index';
import type {
  ResolvedRuleSet,
  RuleContext,
  RuleEvaluationReport,
  RuleScope,
  RuleViolation,
} from './types';

/**
 * Evaluates all active (`severity !== 'off'`) rules in `resolved` that match `scope` against
 * `subject`, stamping every produced violation with the rule's effective severity.
 *
 * @typeParam S - Subject type expected by rules in `scope`.
 * @param scope - Lifecycle scope to evaluate (`blueprint`, `spawn`, or `runtime`).
 * @param subject - Subject inspected by each rule.
 * @param resolved - Pre-resolved rule set from {@link resolveRules}.
 * @param ctx - Optional evaluation context (tick, entityId, speciesId, metadata).
 * @returns Aggregated {@link RuleEvaluationReport} separating errors and warnings.
 */
export function evaluateRules<S>(
  scope: RuleScope,
  subject: S,
  resolved: ResolvedRuleSet,
  ctx: RuleContext = {},
): RuleEvaluationReport {
  const violations: RuleViolation[] = [];
  const errors: RuleViolation[] = [];
  const warnings: RuleViolation[] = [];

  for (const entry of resolved.byScope(scope)) {
    if (entry.severity === 'off') continue;

    const rawViolations = entry.def.check(subject, entry.params, ctx);
    for (const raw of rawViolations) {
      const normalized: RuleViolation = {
        ...raw,
        ruleId: entry.def.id,
        severity: entry.severity,
      };
      violations.push(normalized);
      if (entry.severity === 'error') {
        errors.push(normalized);
      } else {
        warnings.push(normalized);
      }
    }
  }

  return {
    scope,
    ok: errors.length === 0,
    violations,
    errors,
    warnings,
  };
}

/**
 * Throws a {@link RuleViolationError} if `report` contains any `error`-severity violations.
 * Warnings do not cause an error to be thrown.
 *
 * @param report - Evaluation report returned by {@link evaluateRules}.
 * @param context - Optional human-readable description of what was being checked.
 * @throws RuleViolationError when `!report.ok`.
 */
export function assertNoRuleErrors(report: RuleEvaluationReport, context?: string): void {
  if (report.ok) return;
  const target = context ? ` for ${context}` : '';
  throw new RuleViolationError(
    `Rule check failed in "${report.scope}" scope${target} with ${report.errors.length} error(s).`,
    report.errors,
  );
}

/**
 * Formats a {@link RuleEvaluationReport} into a concise multi-line string suitable for logs,
 * headless output, and diagnostics.
 *
 * @param report - Evaluation report to format.
 * @returns Formatted summary string.
 */
export function formatRuleReport(report: RuleEvaluationReport): string {
  if (report.violations.length === 0) {
    return `[rules:${report.scope}] OK (0 violations)`;
  }
  const header = `[rules:${report.scope}] ${report.ok ? 'WARN' : 'FAILED'} (${report.errors.length} error(s), ${report.warnings.length} warning(s))`;
  const lines = report.violations.map((v) => {
    const path = v.path ? ` [${v.path}]` : '';
    const detail =
      v.actual !== undefined && v.limit !== undefined
        ? ` (actual=${v.actual}, limit=${v.limit})`
        : '';
    const suggestion = v.suggestion ? ` Suggestion: ${v.suggestion}` : '';
    return `  - [${v.severity.toUpperCase()}] ${v.ruleId}${path}: ${v.message}${detail}${suggestion}`;
  });
  return `${header}\n${lines.join('\n')}`;
}
