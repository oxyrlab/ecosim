# Guide: Add or Tune a Constraint Rule

See [Constraint Rules Architecture](../architecture/constraint-rules.md) and [ADR 0007](../adr/0007-limits-as-rules.md).

## Adding a new Rule

1. Create `src/rules/defs/<rule-id>.ts` using `defineRule(...)` with:
   - `id` (`kebab-case`), `description`, mandatory `rationale`, `scope` (`blueprint | spawn | runtime`), `category`, `defaultSeverity`, Zod `params`, and pure `check(subject, params, ctx)`.
2. Create a sibling unit test `src/rules/defs/<rule-id>.test.ts`.
3. Register it in `BUILTIN_RULES` (`src/rules/defs/index.ts`) and export it from `src/rules/index.ts`.
4. Add its Layer 1 default value in `src/config/rules.default.ts`.
5. Add a valid/violating subject fixture in `tests/contracts/registry-contracts.test.ts` so `runRuleContract` covers it automatically.
6. Run `npm run docs:catalog && npm run docs:check && npm run test:coverage` and record the addition in [docs/CHANGELOG.md](../CHANGELOG.md).

## Tuning an existing Rule default

1. Update the value in `src/config/rules.default.ts` (never hard-code overrides in systems).
2. Run `npm run docs:catalog` to refresh [docs/catalog/rules.md](../catalog/rules.md).
3. Record the change and supporting benchmark numbers in [docs/CHANGELOG.md](../CHANGELOG.md).
