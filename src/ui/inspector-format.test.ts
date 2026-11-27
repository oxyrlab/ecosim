import { describe, expect, it } from 'vitest';
import type { EntityInspection } from '@sim/inspector';
import { formatInspectionSections } from './inspector-format';

describe('inspector-format', () => {
  it('formats animal, plant, fruit, corpse, and rule violations into structured sections', () => {
    const animal: EntityInspection = {
      entityId: 7,
      kingdom: 'animal',
      speciesId: 'rabbit',
      tags: ['animal', 'herbivore'],
      position: { x: 10.5, y: 8.25 },
      angle: Math.PI / 2,
      boundingRadius: 0.4,
      energy: {
        current: 42,
        max: 100,
        structuralEnergy: 12,
        massKg: 1.5,
        basalRatePerKgPerSecond: 0.2,
        brainUpkeepPerSecond: 0.1,
      },
      health: {
        current: 50,
        max: 50,
        dead: false,
        deathCause: 'none',
        recentPainPulse: 0,
      },
      lifecycle: {
        ageSeconds: 12,
        maxAgeSeconds: 200,
        maturityAgeSeconds: 10,
        currentScale: 1,
        efficiency: 1,
      },
      reproduction: {
        generation: 2,
        offspringCount: 1,
        cooldownRemainingSeconds: 4,
        mode: 'asexual',
      },
      neuromodulators: { reward: 0.45, aversive: 0 },
      signalBus: { 'flee.speed': 0.8, 'eye.nearestDist': 0.25 },
      brainModules: [
        { instanceId: 'flee', state: null },
        { instanceId: 'threat', state: { weights: Array.from({ length: 40 }, (_, i) => i) } },
      ],
      ruleViolations: [{ ruleId: 'brain-size', severity: 'warning', message: 'Near cap' }],
    };

    const sections = formatInspectionSections(animal);
    expect(sections.map((s) => s.id)).toEqual([
      'overview',
      'vitals',
      'neuromodulators',
      'signal-bus',
      'brain-modules',
      'rules',
    ]);
    expect(sections.find((s) => s.id === 'brain-modules')?.rows[1]?.value).toContain('...');

    const plantFruitCorpse: EntityInspection = {
      entityId: 8,
      kingdom: 'plant',
      speciesId: 'berry-bush',
      tags: [],
      position: { x: Number.NaN, y: 1 },
      angle: 0,
      boundingRadius: 0.5,
      plant: {
        stage: 'fruiting',
        stageTimeSeconds: 3,
        stemLength: 0.6,
        leafArea: 0.9,
        flowerCount: 2,
        pollinated: true,
        totalFruitsProduced: 3,
      },
      fruit: { ageSeconds: 2, maxAgeSeconds: 20, seedEnergy: 4 },
      corpse: { energy: 10, initialEnergy: 20 },
      ruleViolations: [],
    };
    const pSections = formatInspectionSections(plantFruitCorpse);
    expect(pSections.find((s) => s.id === 'rules')?.rows[0]?.value).toBe('All rules satisfied');
  });
});
