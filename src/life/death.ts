import type { EntityId } from '@core/index';
import { COLLISION_GROUP } from '@physics/types';
import { RenderableStubComponent, TransformComponent, type World } from '@world/index';
import { CorpseComponent, EnergyComponent, HealthComponent } from './components';
import type { EnergyLedger } from './energy-ledger';

/**
 * Configuration controlling how dead creatures convert into decomposing corpses.
 */
export interface DeathSystemConfig {
  /** Default corpse decomposition rate in `EU / s` (default `2`). */
  readonly defaultCorpseDecayRatePerSecond?: number;
  /** Default `scent.corpse` emission rate per second (default `1.5`). */
  readonly defaultCorpseScentRatePerSecond?: number;
  /** Visual 24-bit RGB color of spawned corpses (default `0x78716c`). */
  readonly corpseColor?: number;
}

/**
 * Event record emitted when a living entity dies and optionally spawns a corpse.
 */
export interface DeathRecord {
  readonly deadEntityId: EntityId;
  readonly corpseEntityId: EntityId | null;
  readonly corpseEnergy: number;
}

/**
 * Converts every entity with `HealthComponent.dead === true` into a decomposing `corpse` entity
 * holding its remaining stored + structural energy, removing the original creature's physics
 * bodies cleanly so zero WASM handles leak (Section 5.8).
 */
export function stepDeathSystem(
  world: World,
  ledger?: EnergyLedger,
  config: DeathSystemConfig = {},
): DeathRecord[] {
  const decayRate = config.defaultCorpseDecayRatePerSecond ?? 2;
  const scentRate = config.defaultCorpseScentRatePerSecond ?? 1.5;
  const corpseColor = config.corpseColor ?? 0x78716c;

  const deadEntities: EntityId[] = [];
  for (const entity of world.ecs.query(HealthComponent)) {
    const health = world.ecs.requireComponent(entity, HealthComponent);
    if (health.dead) {
      deadEntities.push(entity);
    }
  }

  const records: DeathRecord[] = [];
  for (const entity of deadEntities) {
    const transform = world.ecs.getComponent(entity, TransformComponent);
    const energy = world.ecs.getComponent(entity, EnergyComponent);
    const renderable = world.ecs.getComponent(entity, RenderableStubComponent);

    const pos = transform !== undefined ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };
    const radius = renderable?.radius ?? 0.25;
    const residualEnergy =
      energy !== undefined ? Math.max(0, energy.current + energy.structuralEnergy) : 0;

    world.removeEntity(entity);

    let corpseId: EntityId | null = null;
    if (residualEnergy > 1e-6) {
      corpseId = world.spawnSimpleBody({
        position: pos,
        radius,
        bodyKind: 'fixed',
        kind: 4,
        color: corpseColor,
        tags: ['corpse'],
        collisionGroup: COLLISION_GROUP.FRUIT,
      });
      world.ecs.addComponent(corpseId, CorpseComponent, {
        energy: residualEnergy,
        initialEnergy: residualEnergy,
        decayRatePerSecond: decayRate,
        scentRatePerSecond: scentRate,
        radius,
      });
      ledger?.recordCorpseConversion(residualEnergy);
    }

    records.push({
      deadEntityId: entity,
      corpseEntityId: corpseId,
      corpseEnergy: residualEnergy,
    });
  }

  return records;
}
