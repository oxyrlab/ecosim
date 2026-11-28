import { assertFiniteNumber, clamp, InvalidParameterError, type EntityId } from '@core/index';
import { RenderableStubComponent, TransformComponent, type World } from '@world/index';
import { CorpseComponent } from './components';
import type { EnergyLedger } from './energy-ledger';

/**
 * Gradually decomposes every {@link CorpseComponent} entity, transferring its energy into the
 * local `soil.nutrients` field, emitting `scent.corpse`, and despawning completely decomposed
 * corpses cleanly (Section 5.8).
 *
 * @param world - Simulation world.
 * @param dt - Non-negative timestep in seconds.
 * @param ledger - Optional {@link EnergyLedger} recording internal transfer to soil.
 * @param nutrientEnergyPerUnit - Energy per soil nutrient unit (`EU / unit`, default `1`).
 */
export function stepDecompositionSystem(
  world: World,
  dt: number,
  ledger?: EnergyLedger,
  nutrientEnergyPerUnit = 1,
): void {
  assertFiniteNumber('dt', dt, 'stepDecompositionSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepDecompositionSystem');
  }
  if (!Number.isFinite(nutrientEnergyPerUnit) || nutrientEnergyPerUnit <= 0) {
    throw new InvalidParameterError(
      'nutrientEnergyPerUnit',
      nutrientEnergyPerUnit,
      'a finite number > 0',
      'stepDecompositionSystem',
    );
  }

  const nutrients = world.fields.get('soil.nutrients');
  const corpseScent = world.fields.get('scent.corpse');
  const toRemove: EntityId[] = [];

  for (const entity of world.ecs.query(CorpseComponent, TransformComponent)) {
    const corpse = world.ecs.requireComponent(entity, CorpseComponent);
    const transform = world.ecs.requireComponent(entity, TransformComponent);

    // Clamp world coordinates into valid grid bounds so wall-adjacent corpses never lose energy.
    const clampedX = clamp(transform.x, 0, Math.max(0, nutrients.widthMeters - 1e-4));
    const clampedY = clamp(transform.y, 0, Math.max(0, nutrients.heightMeters - 1e-4));

    let release = Math.min(corpse.energy, corpse.decayRatePerSecond * dt);
    corpse.energy -= release;

    if (corpse.energy <= 1e-6) {
      release += corpse.energy;
      corpse.energy = 0;
      toRemove.push(entity);
    } else if (corpse.initialEnergy > 0) {
      const stub = world.ecs.getComponent(entity, RenderableStubComponent);
      if (stub !== undefined) {
        const remainingRatio = clamp(corpse.energy / corpse.initialEnergy, 0, 1);
        const visualRadius = corpse.radius * (0.45 + 0.55 * remainingRatio);
        if (Math.abs(visualRadius - stub.radius) >= 0.01) {
          world.ecs.setComponent(entity, RenderableStubComponent, {
            kind: stub.kind,
            radius: visualRadius,
            color: stub.color,
          });
        }
      }
    }

    if (release > 0) {
      nutrients.addAtWorld(clampedX, clampedY, release / nutrientEnergyPerUnit);
      ledger?.recordDecompositionToSoil(release);
    }

    if (corpse.scentRatePerSecond > 0 && dt > 0) {
      corpseScent.addAtWorld(clampedX, clampedY, corpse.scentRatePerSecond * dt);
    }
  }

  for (const entity of toRemove) {
    world.removeEntity(entity);
  }
}
