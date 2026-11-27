import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@core/index';
import { RABBIT_BLUEPRINT } from '@species/rabbit/blueprint';
import {
  crossoverBlueprints,
  getNumberAtPath,
  mutateBlueprint,
  mutationSpecSchema,
  setNumberAtPath,
  type MutationSpec,
} from './mutation';

describe('genome mutation and crossover', () => {
  it('mutates declared gene paths deterministically within bounds without mutating parent', () => {
    const spec: MutationSpec = mutationSpecSchema.parse({
      rate: 1,
      mutable: [
        { path: 'metabolism.basalRatePerKgPerSecond', min: 0.1, max: 1.0, sigma: 0.15 },
        { path: 'lifecycle.maxHealth', min: 10, max: 60, sigma: 5, integer: true },
        { path: 'brain.modules.0.params.gain', min: 0.5, max: 3.0, sigma: 0.4 },
      ],
    });

    const beforeBasal = RABBIT_BLUEPRINT.metabolism.basalRatePerKgPerSecond;
    const childA = mutateBlueprint(RABBIT_BLUEPRINT, spec, createSeededRng(42));
    const childB = mutateBlueprint(RABBIT_BLUEPRINT, spec, createSeededRng(42));

    expect(childA).toEqual(childB);
    expect(RABBIT_BLUEPRINT.metabolism.basalRatePerKgPerSecond).toBe(beforeBasal);
    expect(childA.metabolism.basalRatePerKgPerSecond).not.toBe(beforeBasal);
    expect(childA.metabolism.basalRatePerKgPerSecond).toBeGreaterThanOrEqual(0.1);
    expect(childA.metabolism.basalRatePerKgPerSecond).toBeLessThanOrEqual(1.0);
    expect(Number.isInteger(childA.lifecycle.maxHealth)).toBe(true);

    // Crossover combines genes from both parents cleanly
    const parentB = mutateBlueprint(RABBIT_BLUEPRINT, spec, createSeededRng(99));
    const hybrid = crossoverBlueprints(
      RABBIT_BLUEPRINT,
      parentB,
      { rate: 0, mutable: spec.mutable },
      createSeededRng(7),
    );
    expect(
      hybrid.metabolism.basalRatePerKgPerSecond ===
        RABBIT_BLUEPRINT.metabolism.basalRatePerKgPerSecond ||
        hybrid.metabolism.basalRatePerKgPerSecond === parentB.metabolism.basalRatePerKgPerSecond,
    ).toBe(true);

    // Path helpers reject missing or non-numeric paths safely
    expect(getNumberAtPath(RABBIT_BLUEPRINT, 'nonexistent.path')).toBeUndefined();
    expect(getNumberAtPath(RABBIT_BLUEPRINT, 'brain.modules.99.params.gain')).toBeUndefined();
    expect(getNumberAtPath(42, 'a.b')).toBeUndefined();
    expect(setNumberAtPath({ arr: [1, 2] }, 'arr.1', 5)).toBe(true);
    expect(setNumberAtPath({ arr: [1] }, 'arr.5', 5)).toBe(false);
    expect(setNumberAtPath({ nested: [{ v: 1 }] }, 'nested.0.v', 9)).toBe(true);
    expect(setNumberAtPath({ nested: [{ v: 1 }] }, 'nested.5.v', 9)).toBe(false);
    expect(setNumberAtPath({ nested: 42 }, 'nested.v', 9)).toBe(false);
    expect(setNumberAtPath(null, 'a', 1)).toBe(false);

    // Rate 0 leaves blueprint unchanged; missing gene path is skipped safely
    const unchanged = mutateBlueprint(
      RABBIT_BLUEPRINT,
      {
        rate: 0,
        mutable: [{ path: 'metabolism.basalRatePerKgPerSecond', min: 0.1, max: 1, sigma: 0.2 }],
      },
      createSeededRng(1),
    );
    expect(unchanged).toEqual(RABBIT_BLUEPRINT);
    const missingGene = mutateBlueprint(
      RABBIT_BLUEPRINT,
      { rate: 1, mutable: [{ path: 'nonexistent.gene', min: 0, max: 1, sigma: 0.1 }] },
      createSeededRng(1),
    );
    expect(missingGene).toEqual(RABBIT_BLUEPRINT);
  });
});
