import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createEmptySandboxScenario } from '@sim/scenario';
import { formatHeadlessOutput, parseHeadlessArgs, runHeadlessSimulation } from './runner';

describe('headless runner', () => {
  it('parses CLI flags, infers CSV from .csv extension, and rejects invalid arguments', () => {
    expect(parseHeadlessArgs([])).toEqual({
      seed: 42,
      ticks: 300,
      scenario: 'default',
      outPath: null,
      format: 'json',
      sampleIntervalTicks: 30,
      help: false,
    });

    expect(
      parseHeadlessArgs([
        '--seed',
        '77',
        '--ticks',
        '120',
        '--scenario',
        'meadow',
        '--out',
        'out/run.csv',
        '--sample-interval',
        '15',
      ]),
    ).toEqual({
      seed: 77,
      ticks: 120,
      scenario: 'meadow',
      outPath: 'out/run.csv',
      format: 'csv',
      sampleIntervalTicks: 15,
      help: false,
    });

    expect(parseHeadlessArgs(['--format', 'json', '--help']).help).toBe(true);

    expect(() => parseHeadlessArgs(['--seed', 'abc'])).toThrow(InvalidParameterError);
    expect(() => parseHeadlessArgs(['--ticks', '-5'])).toThrow(InvalidParameterError);
    expect(() => parseHeadlessArgs(['--scenario', ''])).toThrow(InvalidParameterError);
    expect(() => parseHeadlessArgs(['--out', ''])).toThrow(InvalidParameterError);
    expect(() => parseHeadlessArgs(['--format', 'xml'])).toThrow(InvalidParameterError);
    expect(() => parseHeadlessArgs(['--unknown'])).toThrow(InvalidParameterError);
  });

  it('runs a deterministic Rapier headless simulation and formats JSON & CSV outputs', async () => {
    const a = await runHeadlessSimulation({
      seed: 42,
      ticks: 30,
      scenarioName: 'default',
      sampleIntervalTicks: 10,
    });
    const b = await runHeadlessSimulation({
      seed: 42,
      ticks: 30,
      scenarioName: 'default',
      sampleIntervalTicks: 10,
    });

    expect(a.finalTick).toBe(30);
    expect(a.finalStateHash).toBe(b.finalStateHash);
    expect(a.energyAudit.balanced).toBe(true);
    expect(a.statsHistory.length).toBeGreaterThanOrEqual(4);
    expect(a.genomeSummary.length).toBeGreaterThanOrEqual(2);

    const json = formatHeadlessOutput(a, 'json');
    expect(JSON.parse(json).finalStateHash).toBe(a.finalStateHash);

    const csv = formatHeadlessOutput(a, 'csv');
    expect(csv.split('\n')[0]).toContain('species:rabbit');

    // Custom scenario + seed override + non-aligned final sample tick
    const custom = await runHeadlessSimulation({
      seed: 99,
      ticks: 5,
      scenario: createEmptySandboxScenario(12),
      sampleIntervalTicks: 10,
    });
    expect(custom.seed).toBe(99);
    expect(custom.statsHistory[custom.statsHistory.length - 1]?.tick).toBe(5);

    await expect(runHeadlessSimulation({ ticks: -1 })).rejects.toThrow(InvalidParameterError);
    await expect(runHeadlessSimulation({ ticks: 5, sampleIntervalTicks: 0 })).rejects.toThrow(
      InvalidParameterError,
    );
  });
});
