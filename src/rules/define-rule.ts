import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type Registry,
} from '@core/index';
import type { RuleDef } from './types';

/**
 * Global registry of all registered Constraint Rules.
 */
export const ruleRegistry: Registry<RuleDef<unknown, unknown>> =
  createRegistry<RuleDef<unknown, unknown>>('rule');

/**
 * Identity helper that infers parameter and subject types for a {@link RuleDef} while validating
 * required self-describing metadata (`id`, `description`, `rationale`).
 *
 * @typeParam P - Validated parameter type inferred from `def.params`.
 * @typeParam S - Subject type inspected by `def.check`.
 * @param def - Rule definition.
 * @returns The validated {@link RuleDef} unchanged.
 * @throws InvalidParameterError if `id` is not kebab-case or `description`/`rationale` is blank.
 */
export function defineRule<P, S>(def: RuleDef<P, S>): RuleDef<P, S> {
  assertKebabCaseId(def.id, 'rule id');
  if (def.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      def.description,
      'a non-empty description string',
      `defineRule(${def.id})`,
    );
  }
  if (def.rationale.trim().length === 0) {
    throw new InvalidParameterError(
      'rationale',
      def.rationale,
      'a non-empty rationale explaining why this rule exists',
      `defineRule(${def.id})`,
    );
  }
  return def;
}

/**
 * Registers a {@link RuleDef} into a rule registry (defaults to {@link ruleRegistry}).
 *
 * @typeParam P - Parameter type.
 * @typeParam S - Subject type.
 * @param def - Rule definition created via {@link defineRule}.
 * @param registry - Target registry (defaults to the global {@link ruleRegistry}).
 * @returns The registered rule definition unchanged.
 */
export function registerRule<P, S>(
  def: RuleDef<P, S>,
  registry: Registry<RuleDef<unknown, unknown>> = ruleRegistry,
): RuleDef<P, S> {
  defineRule(def);
  registry.register(def as RuleDef<unknown, unknown>);
  return def;
}
