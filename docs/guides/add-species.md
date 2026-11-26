# Guide: Adding a New Species

Use the canonical reference species in `src/species/rabbit/` (`RABBIT_BLUEPRINT` + `rabbit-flee-predator`) as your template when creating a new animal species, or `src/species/berry-bush.ts` for a plant species.

## Checklist

1. **Create a folder or file under `src/species/<species-id>/`**:
   - Put species-specific brain modules in `<species-id>/<module>.ts` + `<module>.test.ts` and register them via `registerBrainModule(defineBrainModule(...))`.
   - Put the species Blueprint in `<species-id>/blueprint.ts` + `blueprint.test.ts` using `defineSpecies({ ... })`.
2. **Design the procedural body (`body.parts`)**:
   - Follow [Design Creature Appearance](design-creature-appearance.md): root `torso` + fixed `head` + mirrored `visual` ears/paws (`mirror: true`) + optional `revolute` tail.
   - Mount sensors (`vision-sensor`, `olfactory-sensor`, `energy-sensor`, `pain-sensor`) and actuators (`thruster`, `rotator`, `bite`) on the appropriate parts.
3. **Wire the isolated nervous system (`wiring`)**:
   - Reuse shared modules from `src/brain/modules/` (`hunger-drive`, `seek-gradient`, `random-wander`, `behavior-arbiter`).
   - Connect behavior proposals to `behavior-arbiter` using `{ bundle: 'behavior', from: '<mod>', to: 'arbiter:<slot>' }`.
   - Connect `arbiter` → `spine` (`differential-drive`) → actuators (`thrust.l:power`, `thrust.r:power`, `turner:turn`, `mouth:bite`).
4. **Register the species**:
   - Add the blueprint to `BUILTIN_SPECIES` in `src/species/index.ts`.
   - If you added a species-specific brain module, add its contract fixture to `BRAIN_MODULE_FIXTURES` in `tests/contracts/registry-contracts.test.ts`.
5. **Verify**:
   - Write a blueprint validation test calling `validateAnimalBlueprint(MY_BLUEPRINT)` (checks Zod, layout, SignalBus wiring, and all 15 Constraint Rules).
   - Run `npm run docs:catalog && npm run typecheck && npm run lint && npm run test:coverage && npm run docs:check`.

## Reference Example (`src/species/rabbit/blueprint.ts`)

```ts
export const RABBIT_BLUEPRINT: AnimalSpeciesBlueprint = defineSpecies({
  id: 'rabbit',
  name: 'Meadow Rabbit',
  description:
    'Reference herbivore species foraging on plants and berries while fleeing predators.',
  kingdom: 'animal',
  tags: ['animal', 'herbivore', 'prey', 'rabbit'],
  stubColor: 0xe5e7eb,
  body: { parts: [/* torso, head, mirrored ears, mirrored paw thrusters, visual tail */] },
  brain: {
    modules: [
      { instanceId: 'hunger', module: 'hunger-drive' },
      { instanceId: 'forage', module: 'seek-gradient' },
      { instanceId: 'flee', module: 'rabbit-flee-predator' },
      { instanceId: 'wander', module: 'random-wander' },
      {
        instanceId: 'arbiter',
        module: 'behavior-arbiter',
        params: { slots: ['flee', 'forage', 'wander'] },
      },
    ],
  },
  spine: { instanceId: 'spine', spine: 'differential-drive' },
  wiring: [/* sensors -> brain -> bundle('behavior') -> arbiter -> spine -> actuators */],
  metabolism: {/* ... */},
  diet: { assimilationEfficiency: 0.78, edibleTags: ['plant', 'fruit'] },
  lifecycle: {/* ... */},
  scentEmission: { field: 'scent.prey', ratePerSecond: 1.2 },
});
```
