import { describe, expect, it } from 'vitest';
import { createEntityId } from '@core/index';
import { formatHeadlessOutput, runHeadlessSimulation } from '@headless/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import {
  createDefaultMeadowScenario,
  createEmptySandboxScenario,
  parseScenarioJson,
  serializeScenario,
  Simulation,
} from '@sim/index';

describe('Phase 7 integration: Observation, Sandbox Replay & Headless CLI', () => {
  it('replays an interactive Sandbox session via exported ScenarioConfig JSON with bit-exact Rapier state hash (ADR 0009)', async () => {
    const base = createEmptySandboxScenario(42);
    const sim = new Simulation(
      { world: base.world, scenario: base },
      await createRapierPhysicsAdapter(),
    );

    // Tick 0: spawn grass and rabbit via CommandQueue
    sim.enqueueCommand({
      type: 'spawn-species',
      speciesId: 'grass',
      position: { x: 16, y: 16 },
      plantStage: 'mature',
    });
    sim.enqueueCommand({
      type: 'spawn-species',
      speciesId: 'rabbit',
      position: { x: 14, y: 16 },
      angle: 0,
    });
    for (let i = 0; i < 15; i += 1) sim.stepFixed();

    // Tick 15: paint scent + spawn fox
    sim.enqueueCommand({
      type: 'paint-field',
      fieldName: 'scent.plant',
      x: 16,
      y: 16,
      radiusMeters: 3,
      value: 5,
      mode: 'add',
    });
    sim.enqueueCommand({
      type: 'spawn-species',
      speciesId: 'fox',
      position: { x: 8, y: 16 },
      angle: 0,
    });
    for (let i = 0; i < 15; i += 1) sim.stepFixed();

    // Tick 30: remove the grass entity via Sandbox remove tool
    sim.enqueueCommand({
      type: 'remove-entity',
      entityId: createEntityId(1),
    });
    for (let i = 0; i < 15; i += 1) sim.stepFixed();

    const originalHash = sim.computeStateHash();
    const exportedJson = serializeScenario(sim.exportScenario());
    sim.free();

    // Replay from JSON into a brand new Rapier world
    const parsedScenario = parseScenarioJson(exportedJson);
    expect(parsedScenario.commands).toHaveLength(5);

    const replay = new Simulation(
      { world: parsedScenario.world, scenario: parsedScenario },
      await createRapierPhysicsAdapter(),
    );
    for (let i = 0; i < 45; i += 1) replay.stepFixed();

    expect(replay.computeStateHash()).toBe(originalHash);
    replay.free();
  });

  it('picks and inspects live animals with populated SignalBus channels and serialized brain states', async () => {
    const scenario = createDefaultMeadowScenario(108);
    const sim = new Simulation(
      { world: scenario.world, scenario },
      await createRapierPhysicsAdapter(),
    );
    for (let i = 0; i < 10; i += 1) sim.stepFixed();

    const rabbitSpawn = scenario.initialSpawns.find((s) => s.speciesId === 'rabbit');
    expect(rabbitSpawn).toBeDefined();

    // Find a living rabbit entity via stats/ECS inspection
    let inspectedRabbit = null;
    const snap = sim.getSnapshot();
    for (let i = 0; i < snap.entityCount; i += 1) {
      const id = createEntityId(Math.round(snap.entities[i * 7] ?? 0));
      const info = sim.inspectEntity(id);
      if (info?.speciesId === 'rabbit') {
        inspectedRabbit = info;
        break;
      }
    }

    expect(inspectedRabbit).not.toBeNull();
    expect(inspectedRabbit?.signalBus).toBeDefined();
    expect(Object.keys(inspectedRabbit?.signalBus ?? {}).length).toBeGreaterThan(0);
    expect(inspectedRabbit?.brainModules?.length).toBeGreaterThan(0);
    expect(inspectedRabbit?.energy?.current).toBeGreaterThan(0);

    sim.free();
  });

  it('executes deterministic headless simulation runs with balanced EnergyLedger and CSV/JSON export', async () => {
    const runA = await runHeadlessSimulation({
      seed: 42,
      ticks: 60,
      scenarioName: 'default',
      sampleIntervalTicks: 15,
    });
    const runB = await runHeadlessSimulation({
      seed: 42,
      ticks: 60,
      scenarioName: 'default',
      sampleIntervalTicks: 15,
    });

    expect(runA.finalTick).toBe(60);
    expect(runA.finalStateHash).toBe(runB.finalStateHash);
    expect(runA.energyAudit.balanced).toBe(true);
    expect(runA.statsHistory.length).toBe(5); // ticks 0, 15, 30, 45, 60

    const csv = formatHeadlessOutput(runA, 'csv');
    expect(csv.split('\n')).toHaveLength(6);
    expect(csv).toContain('species:grass');
    expect(csv).toContain('species:rabbit');
    expect(csv).toContain('species:fox');
  });
});
