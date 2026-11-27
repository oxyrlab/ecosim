import { describe, expect, it } from 'vitest';
import type { SimulationStatsSnapshot } from '@sim/stats';
import { renderPopulationChartSvg } from './chart-svg';

describe('chart-svg', () => {
  const makeSample = (tick: number, counts: Record<string, number>): SimulationStatsSnapshot => ({
    tick,
    timeSeconds: tick / 30,
    totalEntities: Object.values(counts).reduce((a, b) => a + b, 0),
    animalCount: (counts['rabbit'] ?? 0) + (counts['fox'] ?? 0),
    plantCount: counts['grass'] ?? 0,
    fruitCount: 0,
    corpseCount: 0,
    speciesCounts: counts,
    totalWorldEnergy: 100,
    energyDiscrepancy: 0,
    energyBalanced: true,
    cumulativeBirths: 0,
    cumulativeDeaths: 0,
  });

  it('renders an empty chart and multi-series species polylines cleanly', () => {
    const emptySvg = renderPopulationChartSvg([]);
    expect(emptySvg).toContain('<svg');
    expect(emptySvg).not.toContain('<polyline');

    const singleSvg = renderPopulationChartSvg([makeSample(0, { rabbit: 5 })]);
    expect(singleSvg).toContain('<polyline');
    expect(singleSvg).toContain('rabbit:5');

    const multiSvg = renderPopulationChartSvg(
      [
        makeSample(0, { grass: 12, rabbit: 5, custom: 2 }),
        makeSample(15, { grass: 10, rabbit: 6, fox: 2, custom: 3 }),
      ],
      { width: 300, height: 140 },
    );
    expect(multiSvg).toContain('viewBox="0 0 300 140"');
    expect(multiSvg).toContain('fox:2');
    expect(multiSvg).toContain('custom:3');
  });
});
