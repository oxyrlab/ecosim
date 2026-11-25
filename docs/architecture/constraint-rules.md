# Constraint Rules Architecture

No numeric cap or floor may be hard-coded in EcoSim logic (see [ADR 0007](../adr/0007-limits-as-rules.md)). Every limit is registered as a `RuleDef` in `src/rules/`.

## Scopes & Severities

- **Scopes:** `blueprint` (species validation), `spawn` (entity creation budgets), `runtime` (per-tick invariants like `tick-budget-ms` and `no-nan-state`).
- **Severities:** `error` (rejects Blueprint/spawn or triggers error handling), `warn` (records report and continues), `off` (skips evaluation).

## Three-Layer Resolution (`resolveRules`)

Each layer overrides the previous one:

1. **Defaults:** `src/config/rules.default.ts` (`DEFAULT_RULE_CONFIG`).
2. **World / Scenario:** `WorldConfig.rules`. May lock any rule with `allowSpeciesOverride: false`.
3. **Species Blueprint:** `blueprint.ruleOverrides`. Every override must provide a non-empty `reason`; targeting a locked rule throws `RuleViolationError`.

Merged parameters are validated against each rule's Zod schema (`RuleDef.params`).

## Evaluation & Reporting

`evaluateRules(scope, subject, resolved, ctx)` executes all active rules for `scope`, stamps every violation with the rule's effective severity, and returns a `RuleEvaluationReport` separating `errors` and `warnings`. Call `assertNoRuleErrors(report)` where `error` violations must abort execution, and `formatRuleReport(report)` for human-readable diagnostics.

See [docs/catalog/rules.md](../catalog/rules.md) for the auto-generated catalog of registered rules.
