import { describe, expect, it } from 'vitest';
import { validateAnimalBlueprint } from '../entity-factory';
import { FOX_BLUEPRINT } from './blueprint';

describe('fox predator blueprint', () => {
  it('passes all Constraint Rules, multi-body articulated layout, and SignalBus wiring validation', () => {
    const validated = validateAnimalBlueprint(FOX_BLUEPRINT);
    expect(validated.ruleReport.ok).toBe(true);
    expect(validated.layout.rigidBodyGroups).toHaveLength(2); // torso+head + articulated tail
    expect(validated.layout.joints).toHaveLength(1);
    expect(validated.parsedBrainModules).toHaveLength(5);
    expect(validated.wiring.diagnostics.unmergedFanIns).toEqual([]);
  });
});
