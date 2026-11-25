# Guide: Add a Primitive Shape

1. Create `src/appearance/shapes/<shape-id>.ts` using `defineShape(...)` with:
   - `id`: unique `kebab-case` identifier
   - `description`: concise 1-2 sentence summary (appears in [docs/catalog/shapes.md](../catalog/shapes.md))
   - `params`: Zod schema with SI meters and positive/finite guards
   - `bounds(params)`, `toPath(params)` (closed, NaN-free), `toColliders(params, strategy)` (always convex), `isConvex(params)`, `scaleParams(params, scaleFactor)`, and `area(params)`.
2. Add a sibling unit test `src/appearance/shapes/<shape-id>.test.ts`.
3. Export and add the shape to `BUILTIN_SHAPES` in `src/appearance/shapes/index.ts` and `src/appearance/index.ts`.
4. Add a valid/invalid parameter fixture entry to `SHAPE_FIXTURES` in `tests/contracts/registry-contracts.test.ts` so `runShapeContract` runs automatically.
5. Regenerate docs and verify: `npm run docs:catalog && npm run typecheck && npm run lint && npm run test:coverage && npm run docs:check`.
