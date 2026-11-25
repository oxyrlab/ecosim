# Guide: Add an Organ

1. Create `src/body/organs/<organ-id>.ts` using `defineOrgan(...)` with `defaultShape` (must exist in `shapeRegistry`), `sensorSlots`, `actuatorSlot`, `massDensity`, and Zod `params`.
2. Add a sibling unit test `src/body/organs/<organ-id>.test.ts`.
3. Register it in `BUILTIN_ORGANS` (`src/body/organs/index.ts`).
4. Run `npm run docs:catalog && npm run test:coverage && npm run docs:check` (`runOrganContract` runs automatically over `organRegistry`).
