import { assertFiniteNumber, InvalidParameterError } from '@core/index';
import type { World } from '@world/index';
import { CorpseComponent, EnergyComponent } from './components';

/**
 * Snapshot of all cumulative energy inflows, internal transfers, and dissipated outflows (`EU`).
 */
export interface EnergyLedgerSnapshot {
  /** Energy seeded when entities or soil nutrients are initially spawned. */
  readonly initialSpawn: number;
  /** External energy entering the ecosystem via photosynthesis / light. */
  readonly lightInput: number;
  /** Energy dissipated through basal metabolic upkeep. */
  readonly basalMetabolism: number;
  /** Energy dissipated through actuator physical work. */
  readonly actuatorWork: number;
  /** Energy dissipated through neural brain upkeep. */
  readonly brainUpkeep: number;
  /** Energy lost as assimilation heat during feeding (`(1 - efficiency) * taken`). */
  readonly feedingWaste: number;
  /** Energy dissipated as reproductive overhead. */
  readonly reproductionCost: number;
  /** Internal bookkeeping: energy assimilated via feeding/predation. */
  readonly feedingTransfer: number;
  /** Internal bookkeeping: energy transferred from living body into corpse. */
  readonly corpseConversion: number;
  /** Internal bookkeeping: energy released from corpses into `soil.nutrients`. */
  readonly decompositionToSoil: number;
  /** Internal bookkeeping: energy transferred from parent to offspring. */
  readonly reproductionTransfer: number;
}

/**
 * Conservation audit result comparing expected net energy against measured world energy.
 */
export interface EnergyAuditResult {
  /** Total energy that entered the system (`initialSpawn + lightInput`). */
  readonly totalInflow: number;
  /** Total energy dissipated as heat/waste. */
  readonly totalOutflow: number;
  /** Expected energy remaining inside the world (`totalInflow - totalOutflow`). */
  readonly expectedWorldEnergy: number;
  /** Measured energy currently stored in living entities, corpses, and `soil.nutrients`. */
  readonly measuredWorldEnergy: number;
  /** Signed discrepancy `measuredWorldEnergy - expectedWorldEnergy`. */
  readonly discrepancy: number;
  /** `true` when `|discrepancy| <= tolerance`. */
  readonly balanced: boolean;
}

function assertNonNegativeFinite(name: string, value: number, context: string): void {
  assertFiniteNumber(name, value, context);
  if (value < 0) {
    throw new InvalidParameterError(name, value, 'a finite number >= 0', context);
  }
}

/**
 * Auditable energy conservation ledger (Section 5.8).
 * Tracks every inflow (`initialSpawn`, `lightInput`), dissipated outflow (`basalMetabolism`,
 * `actuatorWork`, `brainUpkeep`, `feedingWaste`, `reproductionCost`), and internal transfer
 * so scenario tests can prove exact energy conservation.
 */
export class EnergyLedger {
  private initialSpawn = 0;
  private lightInput = 0;
  private basalMetabolism = 0;
  private actuatorWork = 0;
  private brainUpkeep = 0;
  private feedingWaste = 0;
  private reproductionCost = 0;
  private feedingTransfer = 0;
  private corpseConversion = 0;
  private decompositionToSoil = 0;
  private reproductionTransfer = 0;

  /** Records energy seeded into the world at spawn (living energy + structural biomass + initial soil). */
  public recordInitialSpawn(eu: number): void {
    assertNonNegativeFinite('eu', eu, 'EnergyLedger.recordInitialSpawn');
    this.initialSpawn += eu;
  }

  /** Records solar/light energy harvested into the ecosystem. */
  public recordLightInput(eu: number): void {
    assertNonNegativeFinite('eu', eu, 'EnergyLedger.recordLightInput');
    this.lightInput += eu;
  }

  /** Records energy dissipated by basal metabolism. */
  public recordBasalMetabolism(eu: number): void {
    assertNonNegativeFinite('eu', eu, 'EnergyLedger.recordBasalMetabolism');
    this.basalMetabolism += eu;
  }

  /** Records energy dissipated by actuator forces/actions. */
  public recordActuatorWork(eu: number): void {
    assertNonNegativeFinite('eu', eu, 'EnergyLedger.recordActuatorWork');
    this.actuatorWork += eu;
  }

  /** Records energy dissipated by brain module upkeep. */
  public recordBrainUpkeep(eu: number): void {
    assertNonNegativeFinite('eu', eu, 'EnergyLedger.recordBrainUpkeep');
    this.brainUpkeep += eu;
  }

  /** Records feeding assimilation (`assimilated` transferred internally, `waste` dissipated). */
  public recordFeeding(assimilated: number, waste: number): void {
    assertNonNegativeFinite('assimilated', assimilated, 'EnergyLedger.recordFeeding');
    assertNonNegativeFinite('waste', waste, 'EnergyLedger.recordFeeding');
    this.feedingTransfer += assimilated;
    this.feedingWaste += waste;
  }

  /** Records reproductive energy transfer (`offspringEnergy`) and overhead cost (`overheadCost`). */
  public recordReproduction(offspringEnergy: number, overheadCost: number): void {
    assertNonNegativeFinite('offspringEnergy', offspringEnergy, 'EnergyLedger.recordReproduction');
    assertNonNegativeFinite('overheadCost', overheadCost, 'EnergyLedger.recordReproduction');
    this.reproductionTransfer += offspringEnergy;
    this.reproductionCost += overheadCost;
  }

  /** Records living energy converted into a decomposing corpse (internal transfer). */
  public recordCorpseConversion(eu: number): void {
    assertNonNegativeFinite('eu', eu, 'EnergyLedger.recordCorpseConversion');
    this.corpseConversion += eu;
  }

  /** Records corpse energy released into `soil.nutrients` (internal transfer). */
  public recordDecompositionToSoil(eu: number): void {
    assertNonNegativeFinite('eu', eu, 'EnergyLedger.recordDecompositionToSoil');
    this.decompositionToSoil += eu;
  }

  /** Returns an immutable snapshot of all ledger totals. */
  public snapshot(): EnergyLedgerSnapshot {
    return {
      initialSpawn: this.initialSpawn,
      lightInput: this.lightInput,
      basalMetabolism: this.basalMetabolism,
      actuatorWork: this.actuatorWork,
      brainUpkeep: this.brainUpkeep,
      feedingWaste: this.feedingWaste,
      reproductionCost: this.reproductionCost,
      feedingTransfer: this.feedingTransfer,
      corpseConversion: this.corpseConversion,
      decompositionToSoil: this.decompositionToSoil,
      reproductionTransfer: this.reproductionTransfer,
    };
  }

  /** Audits expected energy (`inflows - outflows`) against `measuredWorldEnergy`. */
  public audit(measuredWorldEnergy: number, tolerance = 1e-2): EnergyAuditResult {
    assertFiniteNumber('measuredWorldEnergy', measuredWorldEnergy, 'EnergyLedger.audit');
    const totalInflow = this.initialSpawn + this.lightInput;
    const totalOutflow =
      this.basalMetabolism +
      this.actuatorWork +
      this.brainUpkeep +
      this.feedingWaste +
      this.reproductionCost;
    const expectedWorldEnergy = totalInflow - totalOutflow;
    const discrepancy = measuredWorldEnergy - expectedWorldEnergy;
    return {
      totalInflow,
      totalOutflow,
      expectedWorldEnergy,
      measuredWorldEnergy,
      discrepancy,
      balanced: Math.abs(discrepancy) <= tolerance,
    };
  }

  /** Resets all counters to zero. */
  public reset(): void {
    this.initialSpawn = 0;
    this.lightInput = 0;
    this.basalMetabolism = 0;
    this.actuatorWork = 0;
    this.brainUpkeep = 0;
    this.feedingWaste = 0;
    this.reproductionCost = 0;
    this.feedingTransfer = 0;
    this.corpseConversion = 0;
    this.decompositionToSoil = 0;
    this.reproductionTransfer = 0;
  }
}

/**
 * Sums all energy currently present in `world`:
 * - living entities (`energy.current + energy.structuralEnergy`)
 * - decomposing corpses (`corpse.energy`)
 * - soil nutrient field (`soil.nutrients.totalMass() * nutrientEnergyPerUnit`)
 */
export function computeWorldEnergy(world: World, nutrientEnergyPerUnit = 1): number {
  let total = 0;
  for (const entity of world.ecs.query(EnergyComponent)) {
    const e = world.ecs.requireComponent(entity, EnergyComponent);
    total += e.current + e.structuralEnergy;
  }
  for (const entity of world.ecs.query(CorpseComponent)) {
    const c = world.ecs.requireComponent(entity, CorpseComponent);
    total += c.energy;
  }
  total += world.fields.get('soil.nutrients').totalMass() * nutrientEnergyPerUnit;
  return total;
}
