# AGENTS.md

Entry point for any AI assistant working on **EcoSim**.

## Read first

1. [docs/README.md](docs/README.md) — project summary and reading order by task type.
2. [docs/STATUS.md](docs/STATUS.md) — current phase, exact next task, and open design questions.

Read only the docs relevant to your task using the reading-order table. Read source code only when the docs are insufficient, and update the missing docs in the same change.

## Non-negotiable rules

- **English only** for all code, comments, identifiers, and files under `docs/`.
- **One concept = one file** (target < 300 lines); **named exports only**; every folder exports its public API through `index.ts`.
- **TSDoc on every public export** covering purpose, SI units, value ranges, and examples where helpful.
- **Strict TypeScript**, no `any`; validate untrusted boundaries with Zod or explicit guards (`src/core/errors.ts`).
- **Determinism:** `Math.random()`, `Date.now()`, and `performance.now()` are forbidden in simulation layers (lint-enforced). Inject a seeded `Rng` derived from `worldSeed + entityId`.
- **No hidden global state** in simulation logic; pass dependencies via parameters or context.
- **No hard-coded numeric limits:** every cap or floor is a configurable Constraint Rule (`src/rules/`) with a documented `rationale` (see [docs/adr/0007-limits-as-rules.md](docs/adr/0007-limits-as-rules.md)).
- **Simulation/render separation:** `src/sim/` and lower layers never depend on the DOM or PixiJS and run headless in Node.js.
- **Tests alongside code:** unit tests live next to their source file (`x.ts` + `x.test.ts`); contract, integration, and scenario tests live in `tests/`.
- **Docs-first:** update `docs/STATUS.md`, `docs/CHANGELOG.md`, relevant concept/architecture docs, ADRs (if architecture changes), and regenerate `docs/catalog/` in the same change.

## Session workflow

1. Read `AGENTS.md`, `docs/README.md`, and `docs/STATUS.md`.
2. Present a short plan before writing code (files, interfaces, tests).
3. Stop and ask if any decision conflicts with an ADR or an open design question in `docs/STATUS.md`.
4. Write code, tests, and docs together.
5. Verify the Definition of Done before finishing:
   `npm run typecheck && npm run lint && npm run test:coverage && npm run docs:catalog && npm run docs:check`.
