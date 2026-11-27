import { describe, expect, it } from 'vitest';
import { createEntityId, InvalidParameterError } from '@core/index';
import { EnergyLedger } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import {
  applyScenarioToWorld,
  createDefaultMeadowScenario,
  createEmptySandboxScenario,
  getBuiltinScenario,
  parseScenarioJson,
  serializeScenario,
} from './scenario';

describe('scenario', () => {
  it('builds deterministic default meadow and empty sandbox presets', () => {
    const a = createDefaultMeadowScenario(42);
    const b = createDefaultMeadowScenario(42);
    expect(a).toEqual(b);
    expect(a.initialSpawns.some((s) => s.speciesId === 'rabbit')).toBe(true);
    expect(a.initialSpawns.some((s) => s.speciesId === 'fox')).toBe(true);
    expect(a.initialSpawns.some((s) => s.speciesId === 'grass')).toBe(true);
    expect(a.initialSpawns.some((s) => s.speciesId === 'berry-bush')).toBe(true);

    const empty = createEmptySandboxScenario(7);
    expect(empty.initialSpawns).toHaveLength(0);
    expect(getBuiltinScenario('meadow', 42)).toEqual(a);
    expect(getBuiltinScenario('sandbox', 7)).toEqual(empty);
    expect(() => getBuiltinScenario('nonexistent')).toThrow(InvalidParameterError);
  });

  it('round-trips JSON serialization including recorded commands', () => {
    const base = createEmptySandboxScenario(11);
    const withCommands = {
      ...base,
      commands: [
        {
          tick: 2,
          command: {
            type: 'spawn-species' as const,
            speciesId: 'rabbit',
            position: { x: 10, y: 12 },
            angle: 0.5,
          },
        },
        {
          tick: 4,
          command: {
            type: 'remove-entity' as const,
            entityId: createEntityId(1),
          },
        },
        {
          tick: 5,
          command: {
            type: 'paint-field' as const,
            fieldName: 'soil.nutrients',
            x: 8,
            y: 8,
            radiusMeters: 3,
            value: 5,
            mode: 'add' as const,
          },
        },
        {
          tick: 6,
          command: {
            type: 'apply-impulse' as const,
            entityId: createEntityId(1),
            impulse: { x: 1, y: -1 },
          },
        },
        {
          tick: 7,
          command: {
            type: 'clear-world' as const,
          },
        },
      ],
    };

    const json = serializeScenario(withCommands);
    const parsed = parseScenarioJson(json);
    expect(parsed.name).toBe(base.name);
    expect(parsed.commands).toHaveLength(5);

    expect(() => parseScenarioJson('{not-json')).toThrow(InvalidParameterError);
  });

  it('applies scenario fields and species spawns to a world and seeds ledger', () => {
    const scenario = createDefaultMeadowScenario(99);
    const world = new World(scenario.world, createMockPhysicsAdapter());
    const ledger = new EnergyLedger();

    applyScenarioToWorld(world, scenario, ledger);
    expect(ledger.snapshot().initialSpawn).toBeGreaterThan(0);

    // Also test unknown field name ignored safely and reproduction disabled
    const noRepro = {
      ...createEmptySandboxScenario(5),
      enableReproduction: false,
      initialFields: [{ fieldName: 'nonexistent.field', x: 1, y: 1, radiusMeters: 1, value: 1 }],
      initialSpawns: [{ speciesId: 'grass', position: { x: 5, y: 5 } }],
    };
    const world2 = new World(noRepro.world, createMockPhysicsAdapter());
    applyScenarioToWorld(world2, noRepro);
    expect(world2.fields.get('light').totalMass()).toBeGreaterThan(0);

    world.free();
    world2.free();
  });
});
