import { describe, expect, it } from 'vitest';
import { createRegistry, InvalidParameterError } from '@core/index';
import { parsePlantSpeciesSpec } from '@plants/components';
import {
  defineSpecies,
  registerSpecies,
  type PlantSpeciesBlueprint,
  type SpeciesBlueprint,
} from './blueprint';

describe('SpeciesBlueprint validation and registry', () => {
  it('validates and registers plant species blueprints and rejects malformed inputs', () => {
    const reg = createRegistry<SpeciesBlueprint>('species-test');
    const bp: PlantSpeciesBlueprint = {
      id: 'test-grass',
      name: 'Test Grass',
      description: 'Fast-growing test grass.',
      kingdom: 'plant',
      tags: ['plant', 'test-grass'],
      plantSpec: parsePlantSpeciesSpec({ speciesId: 'test-grass' }),
    };

    registerSpecies(bp, reg);
    expect(reg.get('test-grass')?.name).toBe('Test Grass');

    expect(() =>
      defineSpecies({
        ...bp,
        id: 'BadId',
      }),
    ).toThrow(InvalidParameterError);

    expect(() =>
      defineSpecies({
        ...bp,
        description: '   ',
      }),
    ).toThrow(InvalidParameterError);
  });
});
