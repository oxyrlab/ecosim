import type { ActuatorActionEvent } from '@body/actuators';
import type { EntityId } from '@core/index';
import { PhysicsBodyComponent, TagsComponent, TransformComponent, type World } from '@world/index';
import { CorpseComponent, DietComponent, EnergyComponent, HealthComponent } from './components';
import type { EnergyLedger } from './energy-ledger';
import { applyDamage } from './health';

/**
 * Outcome summary for a single resolved bite interaction.
 */
export interface BiteResolution {
  readonly actorEntityId: EntityId;
  readonly targetEntityId: EntityId;
  readonly damageDealt: number;
  readonly energyExtracted: number;
  readonly energyAssimilated: number;
  readonly energyWasted: number;
}

const DEFAULT_ASSIMILATION_EFFICIENCY = 0.7;

function canFeedOn(
  edibleTags: readonly string[] | undefined,
  targetTags: ReadonlySet<string> | undefined,
): boolean {
  if (edibleTags === undefined || edibleTags.length === 0) return true;
  if (targetTags === undefined) return false;
  for (const tag of edibleTags) {
    if (targetTags.has(tag)) return true;
  }
  return false;
}

/**
 * Resolves discrete actuator interaction events (currently `bite` actions) against nearby
 * entities in `world.spatialHash`, applying damage, transferring assimilated energy, and
 * recording exact assimilation + waste in `ledger`.
 */
export function stepInteractionSystem(
  world: World,
  events: readonly ActuatorActionEvent[],
  ledger?: EnergyLedger,
): BiteResolution[] {
  const resolutions: BiteResolution[] = [];

  for (const event of events) {
    if (!world.ecs.isAlive(event.actorEntityId)) continue;

    const diet = world.ecs.getComponent(event.actorEntityId, DietComponent);
    const actorEnergy = world.ecs.getComponent(event.actorEntityId, EnergyComponent);
    const efficiency = diet?.assimilationEfficiency ?? DEFAULT_ASSIMILATION_EFFICIENCY;

    const candidates = world.spatialHash.queryRadius(
      event.origin.x,
      event.origin.y,
      event.rangeMeters,
    );

    let bestTarget: EntityId | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      if (candidate === event.actorEntityId || !world.ecs.isAlive(candidate)) continue;
      const targetTags = world.ecs.getComponent(candidate, TagsComponent)?.values;
      if (!canFeedOn(diet?.edibleTags, targetTags)) continue;

      const hasFood =
        world.ecs.hasComponent(candidate, CorpseComponent) ||
        world.ecs.hasComponent(candidate, EnergyComponent) ||
        world.ecs.hasComponent(candidate, HealthComponent);
      if (!hasFood) continue;

      const tPos = world.ecs.getComponent(candidate, TransformComponent);
      if (tPos === undefined) continue;

      const tRadius = world.ecs.getComponent(candidate, PhysicsBodyComponent)?.boundingRadius ?? 0;
      const dx = tPos.x - event.origin.x;
      const dy = tPos.y - event.origin.y;
      const dist = Math.hypot(dx, dy);
      if (dist - tRadius > event.rangeMeters) continue;

      // Require target to lie generally in front of the mouth direction (or overlapping mouth).
      const forwardDot = dx * event.direction.x + dy * event.direction.y;
      if (forwardDot < -tRadius) continue;

      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = candidate;
      }
    }

    if (bestTarget === null) continue;

    let damageDealt = 0;
    let extracted = 0;

    const corpse = world.ecs.getComponent(bestTarget, CorpseComponent);
    if (corpse !== undefined) {
      extracted = Math.min(corpse.energy, event.damage);
      corpse.energy -= extracted;
    } else {
      const targetHealth = world.ecs.getComponent(bestTarget, HealthComponent);
      const targetEnergy = world.ecs.getComponent(bestTarget, EnergyComponent);

      if (targetHealth !== undefined && !targetHealth.dead) {
        damageDealt = event.damage;
        applyDamage(targetHealth, event.damage, 'damage');
        if (targetEnergy !== undefined) {
          const wanted = event.damage * targetHealth.energyPerDamage;
          extracted = Math.min(targetEnergy.current, wanted);
          targetEnergy.current -= extracted;
        }
      } else if (targetEnergy !== undefined) {
        extracted = Math.min(targetEnergy.current, event.damage);
        targetEnergy.current -= extracted;
      }
    }

    let assimilated = 0;
    if (actorEnergy !== undefined && extracted > 0) {
      const rawGain = extracted * efficiency;
      const headroom = Math.max(0, actorEnergy.max - actorEnergy.current);
      assimilated = Math.min(rawGain, headroom);
      actorEnergy.current += assimilated;
    }

    const wasted = Math.max(0, extracted - assimilated);
    if (ledger !== undefined && extracted > 0) {
      ledger.recordFeeding(assimilated, wasted);
    }

    resolutions.push({
      actorEntityId: event.actorEntityId,
      targetEntityId: bestTarget,
      damageDealt,
      energyExtracted: extracted,
      energyAssimilated: assimilated,
      energyWasted: wasted,
    });
  }

  return resolutions;
}
