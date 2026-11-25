import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createRegistry,
  InvalidParameterError,
  RegistryNotFoundError,
  RuleViolationError,
} from '@core/index';
import { defineRule, registerRule } from './define-rule';
import { resolveRules } from './resolve-rules';
import type { RuleDef } from './types';

function makeTestRegistry() {
  const registry = createRegistry<RuleDef<unknown, unknown>>('rule');
  registerRule(
    defineRule({
      id: 'max-parts',
      description: 'Limits body part count.',
      rationale: 'Keeps rendering and layout within budget.',
      scope: 'blueprint',
      category: 'performance',
      defaultSeverity: 'warn',
      params: z.object({ max: z.number().int().positive().default(16) }),
      check: () => [],
    }),
    registry,
  );
  registerRule(
    defineRule({
      id: 'min-radius',
      description: 'Minimum collider radius in meters.',
      rationale: 'Tiny colliders tunnel through walls.',
      scope: 'blueprint',
      category: 'physics-stability',
      defaultSeverity: 'error',
      params: z.object({ minMeters: z.number().positive() }),
      check: () => [],
    }),
    registry,
  );
  registerRule(
    defineRule({
      id: 'concave-strategy',
      description: 'Strategy for non-convex shapes.',
      rationale: 'Rapier only supports convex colliders.',
      scope: 'blueprint',
      category: 'engine-requirement',
      defaultSeverity: 'error',
      params: z.enum(['reject', 'hull', 'decompose']).default('hull'),
      check: () => [],
    }),
    registry,
  );
  registerRule(
    defineRule({
      id: 'no-nan-state',
      description: 'Rejects NaN state at runtime.',
      rationale: 'NaN corrupts physics and bus values.',
      scope: 'runtime',
      category: 'engine-requirement',
      defaultSeverity: 'error',
      params: z.undefined(),
      check: () => [],
    }),
    registry,
  );
  return registry;
}

describe('resolveRules', () => {
  it('applies three-layer precedence: default -> world -> species', () => {
    const registry = makeTestRegistry();
    const resolved = resolveRules({
      registry,
      defaultConfig: {
        'max-parts': { severity: 'warn', params: { max: 16 } },
        'min-radius': { severity: 'error', params: { minMeters: 0.02 } },
      },
      worldConfig: {
        'max-parts': { severity: 'error', params: { max: 20 } },
      },
      speciesOverrides: [
        {
          ruleId: 'max-parts',
          severity: 'warn',
          params: { max: 24 },
          reason: 'Segmented centipede requires extra body parts.',
        },
        {
          ruleId: 'concave-strategy',
          params: 'decompose',
          reason: 'Needs accurate concave silhouette.',
        },
      ],
    });

    const maxParts = resolved.get('max-parts');
    expect(maxParts?.severity).toBe('warn');
    expect(maxParts?.params).toEqual({ max: 24 });
    expect(maxParts?.source).toBe('species');

    const minRadius = resolved.get('min-radius');
    expect(minRadius?.severity).toBe('error');
    expect(minRadius?.params).toEqual({ minMeters: 0.02 });
    expect(minRadius?.source).toBe('default');

    const concave = resolved.get('concave-strategy');
    expect(concave?.params).toBe('decompose');
    expect(concave?.source).toBe('species');

    const noNan = resolved.get('no-nan-state');
    expect(noNan?.source).toBe('definition');
    expect(resolved.byScope('runtime').map((r) => r.def.id)).toEqual(['no-nan-state']);
    expect(resolved.byScope('blueprint')).toHaveLength(3);
  });

  it('rejects species overrides when world config sets allowSpeciesOverride: false', () => {
    const registry = makeTestRegistry();
    expect(() =>
      resolveRules({
        registry,
        defaultConfig: {
          'min-radius': { params: { minMeters: 0.02 } },
        },
        worldConfig: {
          'min-radius': { allowSpeciesOverride: false, params: { minMeters: 0.05 } },
        },
        speciesOverrides: [
          {
            ruleId: 'min-radius',
            params: { minMeters: 0.01 },
            reason: 'Microscopic insect',
          },
        ],
      }),
    ).toThrow(RuleViolationError);
  });

  it('rejects species overrides without a non-empty reason', () => {
    const registry = makeTestRegistry();
    expect(() =>
      resolveRules({
        registry,
        defaultConfig: { 'min-radius': { params: { minMeters: 0.02 } } },
        speciesOverrides: [{ ruleId: 'max-parts', severity: 'off', reason: '   ' }],
      }),
    ).toThrow(RuleViolationError);
  });

  it('rejects unknown rule ids in any config layer', () => {
    const registry = makeTestRegistry();
    expect(() =>
      resolveRules({
        registry,
        defaultConfig: { 'does-not-exist': { severity: 'off' } },
      }),
    ).toThrow(RegistryNotFoundError);

    expect(() =>
      resolveRules({
        registry,
        defaultConfig: { 'min-radius': { params: { minMeters: 0.02 } } },
        worldConfig: { 'ghost-rule': { severity: 'warn' } },
      }),
    ).toThrow(RegistryNotFoundError);

    expect(() =>
      resolveRules({
        registry,
        defaultConfig: { 'min-radius': { params: { minMeters: 0.02 } } },
        speciesOverrides: [{ ruleId: 'ghost-rule', reason: 'test' }],
      }),
    ).toThrow(RegistryNotFoundError);
  });

  it('validates merged params with Zod and throws InvalidParameterError on invalid params', () => {
    const registry = makeTestRegistry();
    expect(() =>
      resolveRules({
        registry,
        defaultConfig: {
          'min-radius': { params: { minMeters: -0.5 } },
        },
      }),
    ).toThrow(InvalidParameterError);
  });

  it('works with default options once built-in rules are registered', async () => {
    await import('./defs');
    const resolved = resolveRules();
    expect(resolved.rules.size).toBeGreaterThanOrEqual(8);
  });
});
