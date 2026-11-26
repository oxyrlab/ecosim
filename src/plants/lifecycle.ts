import { assertFiniteNumber, clamp, InvalidParameterError, type EntityId } from '@core/index';
import { EnergyComponent, HealthComponent, LifecycleComponent } from '@life/index';
import { COLLISION_GROUP } from '@physics/types';
import { PhysicsBodyComponent, TransformComponent, type World } from '@world/index';
import { PlantComponent, type PlantData, type PlantStage } from './components';
import { syncPlantVisualsAndTags } from './spawn';

const RADIUS_SYNC_EPSILON = 0.01;

function resizePlantCollider(
  world: World,
  entity: EntityId,
  newRadius: number,
  x: number,
  y: number,
): void {
  const body = world.ecs.getComponent(entity, PhysicsBodyComponent);
  if (body === undefined) return;
  for (const ch of body.colliderHandles) {
    world.physics.removeCollider(ch);
  }
  const nextCollider = world.physics.createCollider({
    body: body.bodyHandle,
    shape: { kind: 'circle', radius: newRadius },
    collisionGroup: COLLISION_GROUP.PLANT,
    collisionMask: COLLISION_GROUP.ALL,
  });
  world.ecs.setComponent(entity, PhysicsBodyComponent, {
    bodyHandle: body.bodyHandle,
    colliderHandles: [nextCollider],
    jointHandles: body.jointHandles,
    boundingRadius: newRadius,
  });
  world.spatialHash.update(entity, x, y, newRadius);
}

function transitionStage(world: World, entity: EntityId, plant: PlantData, next: PlantStage): void {
  const prev = plant.stage;
  if (prev === next) return;
  plant.stage = next;
  plant.stageTimeSeconds = 0;

  // Activate normal basal metabolism and initial cotyledon leaves once a seed sprouts.
  if (prev === 'seed' && next === 'sprout') {
    plant.organs.stemLength = Math.max(plant.organs.stemLength, plant.spec.maxStemLength * 0.25);
    plant.organs.leafArea = Math.max(plant.organs.leafArea, plant.spec.maxLeafArea * 0.25);
    const energy = world.ecs.getComponent(entity, EnergyComponent);
    if (energy !== undefined) {
      world.ecs.setComponent(entity, EnergyComponent, {
        ...energy,
        basalRatePerKgPerSecond: plant.spec.basalRatePerKgPerSecond,
      });
    }
  }

  if (next === 'flowering') {
    plant.pollinated = false;
    plant.fruitsInCurrentCycle = 0;
    plant.organs.flowerCount = plant.spec.maxFlowers;
  } else if (next === 'mature' || next === 'senescence') {
    plant.pollinated = false;
    plant.organs.flowerCount = 0;
  }

  syncPlantVisualsAndTags(world, entity, next);
}

function countNearbyPlants(
  world: World,
  self: EntityId,
  x: number,
  y: number,
  radius: number,
): number {
  if (radius <= 0) return 0;
  const neighbors = world.spatialHash.queryRadius(x, y, radius);
  let count = 0;
  for (const id of neighbors) {
    if (id === self || !world.ecs.isAlive(id)) continue;
    const other = world.ecs.getComponent(id, PlantComponent);
    if (other !== undefined && other.stage !== 'seed') {
      count += 1;
    }
  }
  return count;
}

/**
 * Advances the plant lifecycle state machine (`seed → sprout → mature → flowering → fruiting →
 * senescence → death`), grows stems/leaves/flowers, and updates physical collider radii when
 * plants grow (Section 5.9).
 */
export function stepPlantLifecycleSystem(world: World, dt: number): void {
  assertFiniteNumber('dt', dt, 'stepPlantLifecycleSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepPlantLifecycleSystem');
  }
  if (dt === 0) return;

  const lightField = world.fields.get('light');
  const moistureField = world.fields.get('soil.moisture');

  for (const entity of world.ecs.query(PlantComponent, EnergyComponent, LifecycleComponent)) {
    const plant = world.ecs.requireComponent(entity, PlantComponent);
    if (plant.carriedBy !== null) continue;

    const health = world.ecs.getComponent(entity, HealthComponent);
    if (health !== undefined && health.dead) continue;

    const energy = world.ecs.requireComponent(entity, EnergyComponent);
    const lifecycle = world.ecs.requireComponent(entity, LifecycleComponent);
    const transform = world.ecs.getComponent(entity, TransformComponent);
    const spec = plant.spec;

    plant.stageTimeSeconds += dt;

    // Senescence check applies to any established stage once senescenceAgeSeconds is reached.
    if (
      plant.stage !== 'seed' &&
      plant.stage !== 'senescence' &&
      lifecycle.ageSeconds >= spec.senescenceAgeSeconds
    ) {
      transitionStage(world, entity, plant, 'senescence');
    }

    switch (plant.stage) {
      case 'seed': {
        if (plant.stageTimeSeconds >= spec.germinationDelaySeconds && transform !== undefined) {
          const light = lightField.sampleBilinear(transform.x, transform.y);
          const moisture = moistureField.sampleBilinear(transform.x, transform.y);
          const neighbors = countNearbyPlants(
            world,
            entity,
            transform.x,
            transform.y,
            spec.crowdingRadiusMeters,
          );
          if (
            light >= spec.minLightToGrow &&
            moisture >= spec.minMoistureToGrow &&
            neighbors <= spec.maxNeighborsToGerminate
          ) {
            transitionStage(world, entity, plant, 'sprout');
          }
        }
        break;
      }

      case 'sprout': {
        const progress = clamp(lifecycle.ageSeconds / spec.sproutToMatureAgeSeconds, 0, 1);
        plant.organs.stemLength = spec.maxStemLength * (0.25 + 0.6 * progress);
        plant.organs.leafArea = spec.maxLeafArea * (0.25 + 0.6 * progress);
        const targetRadius =
          spec.seedRadius + (spec.adultRadius - spec.seedRadius) * (0.3 + 0.6 * progress);
        if (
          transform !== undefined &&
          Math.abs(targetRadius - plant.currentRadius) >= RADIUS_SYNC_EPSILON
        ) {
          plant.currentRadius = targetRadius;
          resizePlantCollider(world, entity, targetRadius, transform.x, transform.y);
          syncPlantVisualsAndTags(world, entity, plant.stage);
        }

        if (
          lifecycle.ageSeconds >= spec.sproutToMatureAgeSeconds &&
          energy.current >= spec.sproutToMatureEnergy
        ) {
          transitionStage(world, entity, plant, 'mature');
        }
        break;
      }

      case 'mature': {
        plant.organs.stemLength = spec.maxStemLength;
        plant.organs.leafArea = spec.maxLeafArea;
        if (
          transform !== undefined &&
          Math.abs(spec.adultRadius - plant.currentRadius) >= RADIUS_SYNC_EPSILON
        ) {
          plant.currentRadius = spec.adultRadius;
          resizePlantCollider(world, entity, spec.adultRadius, transform.x, transform.y);
          syncPlantVisualsAndTags(world, entity, plant.stage);
        }

        if (
          lifecycle.ageSeconds >= spec.matureToFloweringAgeSeconds &&
          energy.current >= spec.matureToFloweringEnergy
        ) {
          transitionStage(world, entity, plant, 'flowering');
        }
        break;
      }

      case 'flowering': {
        if (plant.pollinated) {
          transitionStage(world, entity, plant, 'fruiting');
        }
        break;
      }

      case 'fruiting': {
        if (plant.fruitsInCurrentCycle >= spec.maxFruitsPerCycle) {
          transitionStage(world, entity, plant, 'mature');
        }
        break;
      }

      case 'senescence': {
        plant.organs.leafArea = Math.max(0, plant.organs.leafArea - spec.maxLeafArea * 0.05 * dt);
        plant.organs.flowerCount = 0;
        if (lifecycle.ageSeconds >= spec.maxAgeSeconds && health !== undefined) {
          health.dead = true;
          health.deathCause = 'aging';
        }
        break;
      }
    }
  }
}
