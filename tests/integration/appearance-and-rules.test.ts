import { describe, expect, it } from 'vitest';
import { buildPhysicsBodyFromLayout, resolveLayout } from '@appearance/index';
import { RuleViolationError } from '@core/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import { assertNoRuleErrors, evaluateRules, resolveRules } from '@rules/index';
import {
  CAT_BODY_FIXTURE,
  CAT_BODY_PARTS,
  CONCAVE_ARROW_BODY_FIXTURE,
  WORM_BODY_FIXTURE,
  WORM_BODY_PARTS,
} from '../fixtures/creatures';

describe('Integration: Appearance layout + Rapier physics + Constraint Rules', () => {
  it('builds cat and worm fixtures in real Rapier WASM with exact body/collider/joint counts and zero leaks', async () => {
    const physics = await createRapierPhysicsAdapter();

    const catLayout = resolveLayout(CAT_BODY_PARTS, 1, 'hull');
    expect(catLayout.parts).toHaveLength(7); // torso, head, ear.l, ear.r, paw.l, paw.r, tail
    expect(catLayout.rigidBodyGroups).toHaveLength(2);
    expect(catLayout.joints).toHaveLength(1);
    expect(catLayout.byId.get('paw.l')?.part.anim[0]?.channel).toBe('thrust.l:power');
    expect(catLayout.byId.get('paw.r')?.part.anim[0]?.channel).toBe('thrust.r:power');

    const catBody = buildPhysicsBodyFromLayout(catLayout, physics, { x: 4, y: 4 }, 0);
    expect(catBody.bodies).toHaveLength(2);
    expect(catBody.colliders).toHaveLength(3);
    expect(catBody.joints).toHaveLength(1);

    const wormLayout = resolveLayout(WORM_BODY_PARTS, 1, 'hull');
    expect(wormLayout.parts).toHaveLength(5);
    expect(wormLayout.rigidBodyGroups).toHaveLength(5);
    expect(wormLayout.joints).toHaveLength(4);

    const wormBody = buildPhysicsBodyFromLayout(wormLayout, physics, { x: 10, y: 4 }, 0);
    expect(wormBody.bodies).toHaveLength(5);
    expect(wormBody.colliders).toHaveLength(5);
    expect(wormBody.joints).toHaveLength(4);

    expect(physics.getStats()).toEqual({ bodyCount: 7, colliderCount: 8, jointCount: 5 });

    // Step Rapier 30 ticks and verify stability (no NaNs)
    physics.applyImpulse(catBody.rootBody, { x: 0.5, y: 0.2 });
    physics.applyImpulse(wormBody.rootBody, { x: 0.4, y: 0 });
    for (let i = 0; i < 30; i += 1) {
      physics.step(1 / 30);
    }
    const catPose = physics.getBodyTransform(catBody.rootBody);
    expect(Number.isFinite(catPose.position.x)).toBe(true);
    expect(catPose.position.x).toBeGreaterThan(4);

    // Clean removal leaves zero lingering WASM handles
    catBody.removeAll();
    wormBody.removeAll();
    expect(physics.getStats()).toEqual({ bodyCount: 0, colliderCount: 0, jointCount: 0 });
    physics.free();
  });

  it('evaluates cat, worm, and concave fixtures through three-layer Constraint Rules', () => {
    const defaultRules = resolveRules();
    expect(evaluateRules('blueprint', CAT_BODY_FIXTURE, defaultRules).violations).toEqual([]);
    expect(evaluateRules('blueprint', WORM_BODY_FIXTURE, defaultRules).violations).toEqual([]);

    // Concave shape allowed under default 'hull' strategy, rejected under world 'reject'
    expect(evaluateRules('blueprint', CONCAVE_ARROW_BODY_FIXTURE, defaultRules).ok).toBe(true);

    const strictConcave = resolveRules({
      worldConfig: {
        'collider-concave-strategy': {
          severity: 'error',
          params: { strategy: 'reject' },
          allowSpeciesOverride: false,
        },
      },
    });
    const report = evaluateRules('blueprint', CONCAVE_ARROW_BODY_FIXTURE, strictConcave);
    expect(report.ok).toBe(false);
    expect(() => assertNoRuleErrors(report, 'concave-arrow')).toThrow(RuleViolationError);

    // Species cannot override a world-locked rule
    expect(() =>
      resolveRules({
        worldConfig: {
          'min-collider-size': { allowSpeciesOverride: false, params: { minMeters: 0.03 } },
        },
        speciesOverrides: [
          {
            ruleId: 'min-collider-size',
            params: { minMeters: 0.005 },
            reason: 'Microscopic species',
          },
        ],
      }),
    ).toThrow(RuleViolationError);

    // Warn-severity rule records warning without throwing
    const tightParts = resolveRules({
      worldConfig: { 'max-parts-per-creature': { severity: 'warn', params: { max: 4 } } },
    });
    const warnReport = evaluateRules('blueprint', CAT_BODY_FIXTURE, tightParts);
    expect(warnReport.ok).toBe(true);
    expect(warnReport.warnings).toHaveLength(1);
    expect(() => assertNoRuleErrors(warnReport, 'cat')).not.toThrow();
  });
});
