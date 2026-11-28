import { describe, expect, it } from 'vitest';
import {
  areOrgansComplementary,
  computeOrganWorldPosition,
  createReproductiveOrganData,
  organIdToSex,
  REPRODUCTIVE_ORGAN_COLORS,
  reproductiveFemaleOrgan,
  reproductiveMaleOrgan,
  sexToOrganId,
} from './reproductive-organ';

describe('reproductive organs', () => {
  it('defines male and female reproductive organs and maps sex/complementarity accurately', () => {
    expect(reproductiveMaleOrgan.id).toBe('reproductive-male');
    expect(reproductiveFemaleOrgan.id).toBe('reproductive-female');
    expect(reproductiveMaleOrgan.sensorSlots).toBe(1);
    expect(reproductiveFemaleOrgan.actuatorSlot).toBe(false);

    expect(organIdToSex('reproductive-male')).toBe('male');
    expect(organIdToSex('reproductive-female')).toBe('female');
    expect(sexToOrganId('male')).toBe('reproductive-male');
    expect(sexToOrganId('female')).toBe('reproductive-female');

    const male = createReproductiveOrganData('reproductive-male');
    const female = createReproductiveOrganData('reproductive-female');
    expect(male.sex).toBe('male');
    expect(male.markerColor).toBe(REPRODUCTIVE_ORGAN_COLORS.male);
    expect(female.sex).toBe('female');
    expect(female.markerColor).toBe(REPRODUCTIVE_ORGAN_COLORS.female);
    expect(areOrgansComplementary(male, female)).toBe(true);
    expect(areOrgansComplementary(male, male)).toBe(false);
    expect(areOrgansComplementary(female, female)).toBe(false);

    const worldPos = computeOrganWorldPosition({ x: 10, y: 5 }, Math.PI / 2, { x: -0.2, y: 0 });
    expect(worldPos.x).toBeCloseTo(10, 5);
    expect(worldPos.y).toBeCloseTo(4.8, 5);
  });
});
