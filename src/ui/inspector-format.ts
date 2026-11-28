import type { EntityInspection } from '@sim/inspector';

/**
 * Single label/value row displayed inside an Inspector collapsible section.
 */
export interface InspectorRow {
  readonly label: string;
  readonly value: string;
}

/**
 * Collapsible section rendered by the live Entity Inspector panel.
 */
export interface InspectorSection {
  readonly id: string;
  readonly title: string;
  readonly defaultOpen: boolean;
  readonly rows: readonly InspectorRow[];
}

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : 'NaN';
}

function summarizeModuleState(state: unknown): string {
  if (state === null || state === undefined) return 'stateless';
  const raw = JSON.stringify(state);
  return raw.length > 96 ? `${raw.slice(0, 93)}...` : raw;
}

/**
 * Formats an {@link EntityInspection} snapshot into structured, display-ready
 * {@link InspectorSection}s covering vitals, neuromodulators, SignalBus channels,
 * brain module `serialize()` state, and Constraint Rule diagnostics.
 */
export function formatInspectionSections(
  inspection: EntityInspection,
): readonly InspectorSection[] {
  const sections: InspectorSection[] = [];

  sections.push({
    id: 'overview',
    title: 'Overview',
    defaultOpen: true,
    rows: [
      { label: 'Entity ID', value: `#${inspection.entityId}` },
      { label: 'Kind', value: inspection.kingdom },
      { label: 'Species', value: inspection.speciesId ?? 'none' },
      {
        label: 'Position',
        value: `(${fmt(inspection.position.x)}, ${fmt(inspection.position.y)}) m`,
      },
      { label: 'Heading', value: `${fmt((inspection.angle * 180) / Math.PI, 1)}°` },
      { label: 'Tags', value: inspection.tags.length > 0 ? inspection.tags.join(', ') : '—' },
    ],
  });

  const vitalRows: InspectorRow[] = [];
  if (inspection.energy !== undefined) {
    vitalRows.push({
      label: 'Energy',
      value: `${fmt(inspection.energy.current, 1)} / ${fmt(inspection.energy.max, 1)} EU`,
    });
    vitalRows.push({
      label: 'Mass / Upkeep',
      value: `${fmt(inspection.energy.massKg, 2)} kg (${fmt(inspection.energy.brainUpkeepPerSecond, 2)} EU/s brain)`,
    });
  }
  if (inspection.health !== undefined) {
    vitalRows.push({
      label: 'Health',
      value: `${fmt(inspection.health.current, 1)} / ${fmt(inspection.health.max, 1)}${inspection.health.dead ? ` (${inspection.health.deathCause})` : ''}`,
    });
  }
  if (inspection.lifecycle !== undefined) {
    vitalRows.push({
      label: 'Age / Scale',
      value: `${fmt(inspection.lifecycle.ageSeconds, 1)}s / ${fmt(inspection.lifecycle.maxAgeSeconds, 0)}s (×${fmt(inspection.lifecycle.currentScale, 2)})`,
    });
  }
  if (inspection.plant !== undefined) {
    vitalRows.push({ label: 'Plant Stage', value: inspection.plant.stage });
    vitalRows.push({
      label: 'Organs',
      value: `leaf ${fmt(inspection.plant.leafArea, 2)} m², flowers ${inspection.plant.flowerCount}, fruits ${inspection.plant.totalFruitsProduced}`,
    });
  }
  if (inspection.fruit !== undefined) {
    vitalRows.push({
      label: 'Fruit',
      value: `age ${fmt(inspection.fruit.ageSeconds, 1)}s, seed ${fmt(inspection.fruit.seedEnergy, 1)} EU`,
    });
  }
  if (inspection.corpse !== undefined) {
    vitalRows.push({
      label: 'Corpse Energy',
      value: `${fmt(inspection.corpse.energy, 1)} / ${fmt(inspection.corpse.initialEnergy, 1)} EU`,
    });
  }
  if (inspection.reproduction !== undefined) {
    vitalRows.push({
      label: 'Lineage',
      value: `Gen ${inspection.reproduction.generation} · ${inspection.reproduction.offspringCount} offspring (${inspection.reproduction.mode})`,
    });
  }
  if (inspection.reproductiveOrgan !== undefined) {
    vitalRows.push({
      label: 'Reproductive Organ',
      value: `${inspection.reproductiveOrgan.organId} (${inspection.reproductiveOrgan.sex})${inspection.reproductiveOrgan.inContact ? ' · contact' : ''}`,
    });
  }
  if (vitalRows.length > 0) {
    sections.push({
      id: 'vitals',
      title: 'Vitals & Lifecycle',
      defaultOpen: true,
      rows: vitalRows,
    });
  }

  if (inspection.neuromodulators !== undefined) {
    sections.push({
      id: 'neuromodulators',
      title: 'Neuromodulators',
      defaultOpen: true,
      rows: [
        { label: 'hormone.reward', value: fmt(inspection.neuromodulators.reward, 3) },
        { label: 'hormone.aversive', value: fmt(inspection.neuromodulators.aversive, 3) },
      ],
    });
  }

  if (inspection.signalBus !== undefined) {
    const entries = Object.entries(inspection.signalBus).sort(([a], [b]) => a.localeCompare(b));
    sections.push({
      id: 'signal-bus',
      title: `SignalBus (${entries.length})`,
      defaultOpen: false,
      rows: entries.map(([channel, value]) => ({ label: channel, value: fmt(value, 3) })),
    });
  }

  if (inspection.brainModules !== undefined && inspection.brainModules.length > 0) {
    sections.push({
      id: 'brain-modules',
      title: `Brain Modules (${inspection.brainModules.length})`,
      defaultOpen: false,
      rows: inspection.brainModules.map((mod) => ({
        label: mod.instanceId,
        value: summarizeModuleState(mod.state),
      })),
    });
  }

  if (inspection.ruleViolations !== undefined) {
    sections.push({
      id: 'rules',
      title: `Constraint Rules (${inspection.ruleViolations.length})`,
      defaultOpen: inspection.ruleViolations.length > 0,
      rows:
        inspection.ruleViolations.length === 0
          ? [{ label: 'Status', value: 'All rules satisfied' }]
          : inspection.ruleViolations.map((v) => ({
              label: `[${v.severity}] ${v.ruleId}`,
              value: v.message,
            })),
    });
  }

  return sections;
}
