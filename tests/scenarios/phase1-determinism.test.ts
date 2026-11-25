import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@core/index';
import { readSnapshotEntity } from '@sim/index';
import { createRapierTestSimulation, stepTicks } from '../helpers';

describe('Scenario: Phase 1 determinism and NaN-free invariants (Rapier WASM)', () => {
  async function runScenario(seed: number): Promise<{ hash: number; entityCount: number }> {
    const sim = await createRapierTestSimulation({
      seed,
      widthMeters: 24,
      heightMeters: 24,
      gridCols: 12,
      gridRows: 12,
    });
    const rng = createSeededRng(seed);

    for (let i = 0; i < 16; i += 1) {
      sim.enqueueCommand({
        type: 'spawn-body',
        position: { x: rng.nextRange(2, 22), y: rng.nextRange(2, 22) },
        radius: rng.nextRange(0.3, 0.6),
        linearVelocity: { x: rng.nextRange(-4, 4), y: rng.nextRange(-4, 4) },
      });
    }
    sim.enqueueCommand({
      type: 'paint-field',
      fieldName: 'scent.plant',
      x: 12,
      y: 12,
      radiusMeters: 4,
      value: 10,
      mode: 'set',
    });

    stepTicks(sim, 30);
    sim.enqueueCommand({
      type: 'paint-field',
      fieldName: 'soil.nutrients',
      x: 6,
      y: 18,
      radiusMeters: 3,
      value: 2,
      mode: 'add',
    });
    stepTicks(sim, 30);

    // Assert zero NaN/Infinity across all entities and fields
    const snapshot = sim.getSnapshot();
    for (let i = 0; i < snapshot.entityCount; i += 1) {
      const entity = readSnapshotEntity(snapshot, i);
      expect(Number.isFinite(entity.x)).toBe(true);
      expect(Number.isFinite(entity.y)).toBe(true);
      expect(Number.isFinite(entity.angle)).toBe(true);
      expect(Number.isFinite(entity.size)).toBe(true);
    }
    for (const name of sim.world.fields.names()) {
      const buf = sim.world.fields.get(name).data;
      for (let i = 0; i < buf.length; i += 1) {
        expect(Number.isFinite(buf[i])).toBe(true);
      }
    }

    const hash = sim.computeStateHash();
    const entityCount = snapshot.entityCount;
    sim.free();
    return { hash, entityCount };
  }

  it('produces identical state hashes across two independent Rapier runs with the same seed', async () => {
    const runA = await runScenario(9001);
    const runB = await runScenario(9001);
    const runOther = await runScenario(9002);

    expect(runA.entityCount).toBe(16);
    expect(runA.hash).toBe(runB.hash);
    expect(runA.hash).not.toBe(runOther.hash);
  });
});
