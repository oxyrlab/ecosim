# ADR 0007: All Numeric Limits as Configurable Constraint Rules

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Simulation engines accumulate arbitrary magic limits (max parts, max rigid bodies, minimum collider size, max brain modules, tick budgets). Hard-coding numbers inside logic hides their motivation, prevents scenario customization, and makes performance trade-offs opaque.

## Decision

Forbid hard-coded numeric caps or floors in simulation logic. Express every limit as a registered **Constraint Rule** (`src/rules/`) with:

- A Zod-validated `params` schema, a `scope` (`blueprint`, `spawn`, or `runtime`), a `category`, a default `severity` (`error`, `warn`, `off`), and a mandatory `rationale`.
- Three-layer resolution (`src/config/rules.default.ts` → `WorldConfig.rules` with optional `allowSpeciesOverride: false` lock → `blueprint.ruleOverrides` with mandatory `reason`).
- Auto-generated documentation in `docs/catalog/rules.md` and benchmark-backed default updates recorded in `docs/CHANGELOG.md`.

## Rejected options

- **Hard-coded `const MAX_*` checks inside systems:** Impossible to override per scenario or species without branching code; rationales drift out of sync.
- **Unstructured JSON config bags:** No validation, no severity control, and no automated catalog documentation.

## Consequences

- **Positive:** Every limit is discoverable, validated, auditable in the Inspector/headless output, and safely tunable via benchmarks.
- **Negative:** Adds a small upfront ceremony when introducing a new limit (registering a rule file + test + default entry).
