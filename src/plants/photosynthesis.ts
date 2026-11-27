import { assertFiniteNumber, clamp, InvalidParameterError } from '@core/index';
import { EnergyComponent, HealthComponent, type EnergyLedger } from '@life/index';
import { TransformComponent, type World } from '@world/index';
import { PlantComponent } from './components';

/**
 * Advances photosynthesis and plant scent emission for all rooted, living, photosynthesizing
 * plants (`sprout`, `mature`, `flowering`, `fruiting`).
 *
 * Energy is drawn from `light` (logged as solar inflow to `ledger.recordLightInput`) and
 * `soil.nutrients` (internal transfer from soil cell to plant biomass), modulated by
 * `soil.moisture`, preserving exact `EnergyLedger` balance.
 *
 * @param world - Simulation world.
 * @param dt - Non-negative timestep in seconds.
 * @param ledger - Optional {@link EnergyLedger} recording solar energy inflow.
 * @param nutrientEnergyPerUnit - Energy per soil nutrient unit (`EU / unit`, default `1`).
 */
export function stepPhotosynthesisSystem(
  world: World,
  dt: number,
  ledger?: EnergyLedger,
  nutrientEnergyPerUnit = 1,
): void {
  assertFiniteNumber('dt', dt, 'stepPhotosynthesisSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepPhotosynthesisSystem');
  }
  if (!Number.isFinite(nutrientEnergyPerUnit) || nutrientEnergyPerUnit <= 0) {
    throw new InvalidParameterError(
      'nutrientEnergyPerUnit',
      nutrientEnergyPerUnit,
      'a finite number > 0',
      'stepPhotosynthesisSystem',
    );
  }
  if (dt === 0) return;

  const lightField = world.fields.get('light');
  const moistureField = world.fields.get('soil.moisture');
  const nutrientField = world.fields.get('soil.nutrients');

  for (const entity of world.ecs.query(PlantComponent, EnergyComponent, TransformComponent)) {
    const plant = world.ecs.requireComponent(entity, PlantComponent);
    if (plant.carriedBy !== null || plant.stage === 'seed' || plant.stage === 'senescence') {
      continue;
    }

    const health = world.ecs.getComponent(entity, HealthComponent);
    if (health !== undefined && health.dead) continue;

    const energy = world.ecs.requireComponent(entity, EnergyComponent);
    const transform = world.ecs.requireComponent(entity, TransformComponent);
    const spec = plant.spec;

    const cx = clamp(transform.x, 0, Math.max(0, nutrientField.widthMeters - 1e-4));
    const cy = clamp(transform.y, 0, Math.max(0, nutrientField.heightMeters - 1e-4));

    if (spec.plantScentRatePerSecond > 0 && world.fields.has(spec.scentField)) {
      world.fields.get(spec.scentField).addAtWorld(cx, cy, spec.plantScentRatePerSecond * dt);
    }

    const leafArea = plant.organs.leafArea;
    if (leafArea <= 0) continue;

    const light = lightField.sampleBilinear(cx, cy);
    const moisture = moistureField.sampleBilinear(cx, cy);
    if (light < spec.minLightToGrow || moisture < spec.minMoistureToGrow) continue;

    const headroom = Math.max(0, energy.max - energy.current);
    if (headroom <= 1e-9) continue;

    const potentialGain = spec.photosynthesisRatePerArea * leafArea * light * moisture * dt;
    const wantedGain = Math.min(headroom, potentialGain);
    if (wantedGain <= 0) continue;

    let actualGain = wantedGain;
    let nutrientTakenEu = 0;

    if (spec.nutrientFraction > 0) {
      const col = Math.floor(cx / nutrientField.cellSizeMeters);
      const row = Math.floor(cy / nutrientField.cellSizeMeters);
      if (col < 0 || col >= nutrientField.cols || row < 0 || row >= nutrientField.rows) continue;
      const availUnits = nutrientField.getCell(col, row);
      const availEu = availUnits * nutrientEnergyPerUnit;
      const wantedNutrientEu = wantedGain * spec.nutrientFraction;
      nutrientTakenEu = Math.min(wantedNutrientEu, availEu);
      if (nutrientTakenEu <= 0) continue;

      actualGain = nutrientTakenEu / spec.nutrientFraction;
      nutrientField.setCell(
        col,
        row,
        Math.max(0, availUnits - nutrientTakenEu / nutrientEnergyPerUnit),
      );
    }

    const solarInflowEu = Math.max(0, actualGain - nutrientTakenEu);
    energy.current = Math.min(energy.max, energy.current + actualGain);
    if (solarInflowEu > 0) {
      ledger?.recordLightInput(solarInflowEu);
    }
  }
}
