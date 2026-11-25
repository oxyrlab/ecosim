import { InvalidParameterError, RuleViolationError, type Registry } from '@core/index';
import { DEFAULT_RULE_CONFIG } from '@config/rules.default';
import { ruleRegistry } from './define-rule';
import type {
  ResolvedRule,
  ResolvedRuleSet,
  RuleConfigEntry,
  RuleDef,
  RuleOverride,
  RuleScope,
  RuleSeverity,
  WorldRuleConfigEntry,
} from './types';

/**
 * Options for three-layer Constraint Rule resolution:
 * 1. `defaultConfig` (`src/config/rules.default.ts`)
 * 2. `worldConfig` (`WorldConfig.rules`, which may lock rules via `allowSpeciesOverride: false`)
 * 3. `speciesOverrides` (`blueprint.ruleOverrides`, each requiring a non-empty `reason`)
 */
export interface ResolveRulesOptions {
  /** Registry containing the active rule definitions (defaults to {@link ruleRegistry}). */
  readonly registry?: Registry<RuleDef<unknown, unknown>>;
  /** Layer 1 defaults (defaults to {@link DEFAULT_RULE_CONFIG}). */
  readonly defaultConfig?: Readonly<Record<string, RuleConfigEntry>>;
  /** Layer 2 world/scenario overrides. */
  readonly worldConfig?: Readonly<Record<string, WorldRuleConfigEntry>>;
  /** Layer 3 species-level overrides from a Blueprint. */
  readonly speciesOverrides?: readonly RuleOverride[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeParams(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    return { ...base, ...override };
  }
  return override;
}

function parseRuleParams(def: RuleDef<unknown, unknown>, rawParams: unknown): unknown {
  const direct = def.params.safeParse(rawParams);
  if (direct.success) {
    return direct.data;
  }
  if (rawParams === undefined) {
    const withEmptyObject = def.params.safeParse({});
    if (withEmptyObject.success) {
      return withEmptyObject.data;
    }
  }
  const summary = direct.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new InvalidParameterError(
    `rules.${def.id}.params`,
    rawParams,
    `valid params matching schema (${summary})`,
    `resolveRules(${def.id})`,
  );
}

/**
 * Resolves effective severities and validated parameters for every registered rule using the
 * three-layer precedence order: defaults → world config → species overrides.
 *
 * @param options - Resolution inputs for each layer.
 * @returns An immutable {@link ResolvedRuleSet}.
 * @throws RegistryNotFoundError if any config layer references an unregistered rule id.
 * @throws RuleViolationError if a species override lacks a `reason` or targets a locked rule.
 * @throws InvalidParameterError if the merged parameters fail the rule's Zod schema.
 */
export function resolveRules(options: ResolveRulesOptions = {}): ResolvedRuleSet {
  const registry = options.registry ?? ruleRegistry;
  const defaultConfig = options.defaultConfig ?? DEFAULT_RULE_CONFIG;
  const worldConfig = options.worldConfig ?? {};
  const speciesOverrides = options.speciesOverrides ?? [];

  // Validate unknown rule references eagerly across all config layers.
  for (const id of Object.keys(defaultConfig)) {
    registry.get(id);
  }
  for (const id of Object.keys(worldConfig)) {
    registry.get(id);
  }

  const overridesByRule = new Map<string, RuleOverride>();
  for (const override of speciesOverrides) {
    registry.get(override.ruleId);
    if (override.reason.trim().length === 0) {
      throw new RuleViolationError(
        `Species rule override for "${override.ruleId}" must include a non-empty reason.`,
        [
          {
            ruleId: override.ruleId,
            severity: 'error',
            message: 'RuleOverride.reason must be a non-empty explanation.',
            path: `ruleOverrides.${override.ruleId}.reason`,
          },
        ],
      );
    }
    overridesByRule.set(override.ruleId, override);
  }

  const resolvedMap = new Map<string, ResolvedRule<unknown, unknown>>();

  for (const def of registry.list()) {
    let severity: RuleSeverity = def.defaultSeverity;
    let rawParams: unknown = undefined;
    let allowSpeciesOverride = true;
    let source: ResolvedRule<unknown, unknown>['source'] = 'definition';

    const layer1 = defaultConfig[def.id];
    if (layer1 !== undefined) {
      if (layer1.severity !== undefined) severity = layer1.severity;
      rawParams = mergeParams(rawParams, layer1.params);
      source = 'default';
    }

    const layer2 = worldConfig[def.id];
    if (layer2 !== undefined) {
      if (layer2.severity !== undefined) severity = layer2.severity;
      rawParams = mergeParams(rawParams, layer2.params);
      if (layer2.allowSpeciesOverride !== undefined) {
        allowSpeciesOverride = layer2.allowSpeciesOverride;
      }
      source = 'world';
    }

    const layer3 = overridesByRule.get(def.id);
    if (layer3 !== undefined) {
      if (!allowSpeciesOverride) {
        throw new RuleViolationError(
          `Rule "${def.id}" is locked by world configuration (allowSpeciesOverride: false) and cannot be overridden by a species Blueprint.`,
          [
            {
              ruleId: def.id,
              severity: 'error',
              message: `Species override rejected because world config locked "${def.id}".`,
              path: `ruleOverrides.${def.id}`,
            },
          ],
        );
      }
      if (layer3.severity !== undefined) severity = layer3.severity;
      rawParams = mergeParams(rawParams, layer3.params);
      source = 'species';
    }

    const params = parseRuleParams(def, rawParams);
    resolvedMap.set(def.id, {
      def,
      severity,
      params,
      allowSpeciesOverride,
      source,
    });
  }

  return {
    rules: resolvedMap,

    get(ruleId: string): ResolvedRule<unknown, unknown> | undefined {
      return resolvedMap.get(ruleId);
    },

    byScope(scope: RuleScope): readonly ResolvedRule<unknown, unknown>[] {
      const result: ResolvedRule<unknown, unknown>[] = [];
      for (const entry of resolvedMap.values()) {
        if (entry.def.scope === scope) {
          result.push(entry);
        }
      }
      return result;
    },
  };
}
