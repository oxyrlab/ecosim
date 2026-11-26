import { describe, expect, it } from 'vitest';
import {
  CorpseComponent,
  DietComponent,
  EnergyComponent,
  HealthComponent,
  LifecycleComponent,
} from './components';

describe('life ECS components', () => {
  it('defines stable kebab-case component tokens', () => {
    expect(EnergyComponent.id).toBe('energy');
    expect(LifecycleComponent.id).toBe('lifecycle');
    expect(HealthComponent.id).toBe('health');
    expect(DietComponent.id).toBe('diet');
    expect(CorpseComponent.id).toBe('corpse');
  });
});
