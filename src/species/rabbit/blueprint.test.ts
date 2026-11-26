import { describe, expect, it } from 'vitest';
import { validateAnimalBlueprint } from '../entity-factory';
import { RABBIT_BLUEPRINT } from './blueprint';

describe('rabbit reference blueprint', () => {
  it('passes all Constraint Rules, layout resolution, and SignalBus wiring validation', () => {
    const validated = validateAnimalBlueprint(RABBIT_BLUEPRINT);
    expect(validated.ruleReport.ok).toBe(true);
    expect(validated.parsedSensors).toHaveLength(4);
    expect(validated.parsedBrainModules).toHaveLength(5);
    expect(validated.parsedActuators).toHaveLength(4);
    expect(validated.wiring.diagnostics.unmergedFanIns).toEqual([]);
  });
});
