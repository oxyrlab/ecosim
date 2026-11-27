import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { ReproductionComponent } from '@genome/index';
import { EnergyLedger } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { applyScenarioToWorld, createDefaultMeadowScenario } from './scenario';
import {
  collectGenomeSummary,
  collectSimulationStats,
  StatsHistory,
  statsHistoryToCsv,
} from './stats';

describe('stats', () => {
  it('collects species counts, energy balance, genome summary, history ring buffer, and CSV', () => {
    const scenario = createDefaultMeadowScenario(42);
    const world = new World(scenario.world, createMockPhysicsAdapter());
    const ledger = new EnergyLedger();
    applyScenarioToWorld(world, scenario, ledger);

    // Bump one rabbit to generation 2 with offspring so maxGeneration / averageGeneration branches run
    const reproEntities = world.ecs.query(ReproductionComponent);
    const first = reproEntities[0];
    if (first !== undefined) {
      const prev = world.ecs.requireComponent(first, ReproductionComponent);
      world.ecs.setComponent(first, ReproductionComponent, {
        ...prev,
        generation: 2,
        offspringCount: 3,
      });
    }

    const snap = collectSimulationStats(world, ledger, 2, 1);
    expect(snap.animalCount).toBe(9); // 7 rabbits + 2 foxes
    expect(snap.plantCount).toBe(24); // 18 grass + 6 berry bushes
    expect(snap.speciesCounts['rabbit']).toBe(7);
    expect(snap.speciesCounts['fox']).toBe(2);
    expect(snap.energyBalanced).toBe(true);
    expect(snap.cumulativeBirths).toBe(2);
    expect(snap.cumulativeDeaths).toBe(1);

    const genomes = collectGenomeSummary(world);
    expect(genomes).toHaveLength(2);
    expect(genomes.find((g) => g.speciesId === 'rabbit')?.maxGeneration).toBe(2);

    const history = new StatsHistory(2);
    history.record(snap);
    history.record({ ...snap, tick: 15, speciesCounts: { rabbit: 5 } });
    history.record({ ...snap, tick: 30, speciesCounts: { rabbit: 6 } });
    expect(history.length).toBe(2);
    expect(history.getSamples()[0]?.tick).toBe(15);

    const csv = statsHistoryToCsv(history.getSamples(), ['rabbit', 'fox']);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('species:rabbit');
    expect(csv).toContain('species:fox');

    history.clear();
    expect(history.length).toBe(0);
    expect(() => new StatsHistory(0)).toThrow(InvalidParameterError);

    world.free();
  });
});
