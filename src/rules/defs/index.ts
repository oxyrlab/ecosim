import type { Registry } from '@core/index';
import { registerRule, ruleRegistry } from '../define-rule';
import type { RuleDef } from '../types';
import { colliderConcaveStrategyRule } from './collider-concave-strategy';
import { maxAnimatedPartsRule } from './max-animated-parts';
import { maxBrainModulesRule } from './max-brain-modules';
import { maxBusChannelsRule } from './max-bus-channels';
import { maxConvexVerticesRule } from './max-convex-vertices';
import { maxJointChainLengthRule } from './max-joint-chain-length';
import { maxMassRatioJointedRule } from './max-mass-ratio-jointed';
import { maxPartsPerCreatureRule } from './max-parts-per-creature';
import { maxRigidBodiesPerCreatureRule } from './max-rigid-bodies-per-creature';
import { maxSensorsPerCreatureRule } from './max-sensors-per-creature';
import { minColliderSizeRule } from './min-collider-size';
import { numericIndexOnLogicalPortRule } from './numeric-index-on-logical-port';
import { unconnectedInputRule } from './unconnected-input';
import { unmergedFanInRule } from './unmerged-fan-in';
import { unusedOutputRule } from './unused-output';

/**
 * All built-in Constraint Rules registered as of Phase 2 (15 rules).
 */
export const BUILTIN_RULES: readonly RuleDef<unknown, unknown>[] = Object.freeze([
  maxPartsPerCreatureRule as RuleDef<unknown, unknown>,
  maxRigidBodiesPerCreatureRule as RuleDef<unknown, unknown>,
  maxJointChainLengthRule as RuleDef<unknown, unknown>,
  maxMassRatioJointedRule as RuleDef<unknown, unknown>,
  minColliderSizeRule as RuleDef<unknown, unknown>,
  maxAnimatedPartsRule as RuleDef<unknown, unknown>,
  maxConvexVerticesRule as RuleDef<unknown, unknown>,
  colliderConcaveStrategyRule as RuleDef<unknown, unknown>,
  maxSensorsPerCreatureRule as RuleDef<unknown, unknown>,
  maxBrainModulesRule as RuleDef<unknown, unknown>,
  maxBusChannelsRule as RuleDef<unknown, unknown>,
  unmergedFanInRule as RuleDef<unknown, unknown>,
  unconnectedInputRule as RuleDef<unknown, unknown>,
  unusedOutputRule as RuleDef<unknown, unknown>,
  numericIndexOnLogicalPortRule as RuleDef<unknown, unknown>,
]);

/**
 * Registers all built-in Constraint Rules into `registry` (idempotent if already present).
 */
export function registerBuiltinRules(
  registry: Registry<RuleDef<unknown, unknown>> = ruleRegistry,
): void {
  for (const rule of BUILTIN_RULES) {
    if (!registry.has(rule.id)) {
      registerRule(rule, registry);
    }
  }
}

// Register built-in rules into the global ruleRegistry on module load.
registerBuiltinRules(ruleRegistry);

export { colliderConcaveStrategyRule } from './collider-concave-strategy';
export { maxAnimatedPartsRule } from './max-animated-parts';
export { maxBrainModulesRule } from './max-brain-modules';
export { maxBusChannelsRule } from './max-bus-channels';
export { maxConvexVerticesRule } from './max-convex-vertices';
export { maxJointChainLengthRule } from './max-joint-chain-length';
export { maxMassRatioJointedRule } from './max-mass-ratio-jointed';
export { maxPartsPerCreatureRule } from './max-parts-per-creature';
export { maxRigidBodiesPerCreatureRule } from './max-rigid-bodies-per-creature';
export { maxSensorsPerCreatureRule } from './max-sensors-per-creature';
export { minColliderSizeRule } from './min-collider-size';
export { numericIndexOnLogicalPortRule } from './numeric-index-on-logical-port';
export { unconnectedInputRule } from './unconnected-input';
export { unmergedFanInRule } from './unmerged-fan-in';
export { unusedOutputRule } from './unused-output';
export type { BlueprintBodySubject } from './subject';
