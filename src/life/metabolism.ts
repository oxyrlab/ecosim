import { assertFiniteNumber, InvalidParameterError } from '@core/index';
import type { World } from '@world/index';
import { EnergyComponent, HealthComponent, LifecycleComponent } from './components';
import type { EnergyLedger } from './energy-ledger';

/**
 * Deducts metabolic upkeep (mass-scaled basal cost adjusted for senescence efficiency, brain
 * upkeep, and queued actuator costs) from every entity with an {@link EnergyComponent}.
 * Records exact dissipated energy into `ledger` and applies starvation damage when reserves hit `0`.
 */
export function stepMetabolismSystem(world: World, dt: number, ledger?: EnergyLedger): void {
  assertFiniteNumber('dt', dt, 'stepMetabolismSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepMetabolismSystem');
  }

  const entities = world.ecs.query(EnergyComponent);
  for (const entity of entities) {
    const energy = world.ecs.requireComponent(entity, EnergyComponent);
    const lifecycle = world.ecs.getComponent(entity, LifecycleComponent);
    const efficiency =
      lifecycle !== undefined && lifecycle.efficiency > 0 ? lifecycle.efficiency : 1;

    const basalWanted = (energy.massKg * energy.basalRatePerKgPerSecond * dt) / efficiency;
    const brainWanted = energy.brainUpkeepPerSecond * dt;
    const actuatorWanted = Math.max(0, energy.pendingActuatorCost);
    energy.pendingActuatorCost = 0;

    // Deduct sequentially, clamping to available energy so EnergyLedger stays strictly balanced.
    const basalPaid = Math.min(energy.current, basalWanted);
    energy.current -= basalPaid;

    const brainPaid = Math.min(energy.current, brainWanted);
    energy.current -= brainPaid;

    const actuatorPaid = Math.min(energy.current, actuatorWanted);
    energy.current -= actuatorPaid;

    if (ledger !== undefined) {
      if (basalPaid > 0) ledger.recordBasalMetabolism(basalPaid);
      if (brainPaid > 0) ledger.recordBrainUpkeep(brainPaid);
      if (actuatorPaid > 0) ledger.recordActuatorWork(actuatorPaid);
    }

    const totalWanted = basalWanted + brainWanted + actuatorWanted;
    const totalPaid = basalPaid + brainPaid + actuatorPaid;
    const starving = energy.current <= 1e-9 && totalWanted > totalPaid;

    if (starving && energy.starvationDamagePerSecond > 0) {
      const health = world.ecs.getComponent(entity, HealthComponent);
      if (health !== undefined && !health.dead) {
        const damage = energy.starvationDamagePerSecond * dt;
        health.pendingDamage += damage;
        if (health.current - health.pendingDamage <= 0) {
          health.deathCause = 'starvation';
        }
      }
    }
  }
}
