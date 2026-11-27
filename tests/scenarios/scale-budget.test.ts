import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@core/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import { Simulation, type ScenarioConfig, type ScenarioSpeciesSpawn } from '@sim/index';

function buildStressScenario(seed: number): ScenarioConfig {
  const rng = createSeededRng(seed);
  const size = 80;
  const pos = () => ({
    x: Number(rng.nextRange(4, size - 4).toFixed(2)),
    y: Number(rng.nextRange(4, size - 4).toFixed(2)),
  });

  const initialSpawns: ScenarioSpeciesSpawn[] = [];
  for (let i = 0; i < 60; i += 1) {
    initialSpawns.push({ speciesId: 'grass', position: pos(), plantStage: 'mature' });
  }
  for (let i = 0; i < 20; i += 1) {
    initialSpawns.push({ speciesId: 'berry-bush', position: pos(), plantStage: 'flowering' });
  }
  for (let i = 0; i < 40; i += 1) {
    initialSpawns.push({ speciesId: 'rabbit', position: pos(), angle: rng.next() * Math.PI * 2 });
  }
  for (let i = 0; i < 10; i += 1) {
    initialSpawns.push({ speciesId: 'fox', position: pos(), angle: rng.next() * Math.PI * 2 });
  }

  return {
    version: 1,
    name: 'scale-stress',
    description: 'Phase 8 deterministic multi-species scale invariance test.',
    world: {
      seed,
      widthMeters: size,
      heightMeters: size,
      gridCols: 40,
      gridRows: 40,
      spatialCellSizeMeters: 4,
    },
    enableReproduction: true,
    initialFields: [
      { fieldName: 'soil.nutrients', x: 40, y: 40, radiusMeters: 45, value: 8 },
      { fieldName: 'soil.moisture', x: 40, y: 40, radiusMeters: 45, value: 0.7 },
    ],
    initialSpawns,
    commands: [],
  };
}

describe('Phase 8 scale & determinism stress scenario', () => {
  it('stays bit-exact deterministic, NaN-free, and energy-balanced across 130+ entities with staggered rates', async () => {
    const run = async () => {
      const scenario = buildStressScenario(77);
      const sim = new Simulation(
        { world: scenario.world, scenario, statsIntervalTicks: 15 },
        await createRapierPhysicsAdapter(),
      );
      for (let i = 0; i < 30; i += 1) {
        sim.stepFixed();
      }
      const stats = sim.getStats();
      const hash = sim.computeStateHash();
      const snap = sim.getSnapshot();
      sim.free();
      return { stats, hash, snap };
    };

    const a = await run();
    const b = await run();

    expect(a.hash).toBe(b.hash);
    expect(a.stats.energyBalanced).toBe(true);
    expect(Number.isFinite(a.stats.totalWorldEnergy)).toBe(true);
    for (let i = 0; i < a.snap.entities.length; i += 1) {
      expect(Number.isFinite(a.snap.entities[i])).toBe(true);
    }
  });
});
