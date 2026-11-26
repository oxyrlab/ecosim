export { computeGrowthScale, computeMetabolicEfficiency, stepAgingSystem } from './aging';
export {
  CorpseComponent,
  DietComponent,
  EnergyComponent,
  HealthComponent,
  LifecycleComponent,
  type CorpseData,
  type DeathCause,
  type DietData,
  type EnergyData,
  type HealthData,
  type LifecycleData,
} from './components';
export { stepDeathSystem, type DeathRecord, type DeathSystemConfig } from './death';
export { stepDecompositionSystem } from './decomposition';
export {
  computeWorldEnergy,
  EnergyLedger,
  type EnergyAuditResult,
  type EnergyLedgerSnapshot,
} from './energy-ledger';
export { applyDamage, stepHealthSystem } from './health';
export { stepInteractionSystem, type BiteResolution } from './interaction';
export { stepMetabolismSystem } from './metabolism';
