import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { CorpseComponent, EnergyComponent } from './components';
import { computeWorldEnergy, EnergyLedger } from './energy-ledger';

describe('EnergyLedger & computeWorldEnergy', () => {
  it('tracks inflows, outflows, internal transfers, and balances world energy', () => {
    const ledger = new EnergyLedger();
    ledger.recordInitialSpawn(100);
    ledger.recordLightInput(25);
    ledger.recordBasalMetabolism(10);
    ledger.recordActuatorWork(5);
    ledger.recordBrainUpkeep(2);
    ledger.recordFeeding(8, 2);
    ledger.recordReproduction(15, 3);
    ledger.recordCorpseConversion(20);
    ledger.recordDecompositionToSoil(12);

    const snap = ledger.snapshot();
    expect(snap.initialSpawn).toBe(100);
    expect(snap.lightInput).toBe(25);
    expect(snap.feedingTransfer).toBe(8);
    expect(snap.corpseConversion).toBe(20);
    expect(snap.decompositionToSoil).toBe(12);
    expect(snap.reproductionTransfer).toBe(15);

    // Expected = 125 - (10 + 5 + 2 + 2 + 3) = 103
    const okAudit = ledger.audit(103);
    expect(okAudit.balanced).toBe(true);
    expect(okAudit.discrepancy).toBeCloseTo(0);

    const badAudit = ledger.audit(90);
    expect(badAudit.balanced).toBe(false);

    expect(() => ledger.recordLightInput(-1)).toThrow(InvalidParameterError);
    ledger.reset();
    expect(ledger.snapshot().initialSpawn).toBe(0);
  });

  it('computes total world energy across living entities, corpses, and soil nutrients', () => {
    const world = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    const living = world.spawnSimpleBody({ position: { x: 2, y: 2 }, radius: 0.3 });
    world.ecs.addComponent(living, EnergyComponent, {
      current: 40,
      max: 100,
      massKg: 1,
      basalRatePerKgPerSecond: 0.5,
      brainUpkeepPerSecond: 0.1,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 5,
      structuralEnergy: 10,
    });

    const corpse = world.spawnSimpleBody({
      position: { x: 6, y: 6 },
      radius: 0.3,
      bodyKind: 'fixed',
    });
    world.ecs.addComponent(corpse, CorpseComponent, {
      energy: 25,
      initialEnergy: 25,
      decayRatePerSecond: 2,
      scentRatePerSecond: 1,
      radius: 0.3,
    });

    world.fields.get('soil.nutrients').setCell(2, 2, 15);
    expect(computeWorldEnergy(world)).toBeCloseTo(90); // 40 + 10 + 25 + 15
    world.free();
  });
});
