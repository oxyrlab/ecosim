import type { ScenarioPresetSummary } from '@sim/scenario-registry';
import type { SpeciesSummary } from '@sim/worker';
import type { SandboxState, SandboxTool } from '../sandbox-state';
import { attachToolbarRovingTabindexFallback } from './toolbar-a11y';

/**
 * Callbacks wired from the Sandbox editor toolbar to the main application controller.
 */
export interface SandboxToolbarCallbacks {
  readonly onToolChange: (tool: SandboxTool) => void;
  readonly onSpeciesChange: (speciesId: string) => void;
  readonly onHeatmapChange: (fieldName: string | null) => void;
  readonly onBrushFieldChange: (fieldName: string) => void;
  readonly onBrushRadiusChange: (radius: number) => void;
  readonly onBrushValueChange: (value: number) => void;
  readonly onSelectScenario: (scenarioId: string) => void;
  readonly onResetScenario: () => void;
  readonly onSeedChange: (seed: number) => void;
  readonly onRandomizeSeed: () => void;
  readonly onSaveScenario: () => void;
  readonly onLoadScenarioJson: (jsonText: string) => void;
}

/**
 * Live handle returned by {@link createSandboxToolbar}.
 */
export interface SandboxToolbarHandle {
  readonly element: HTMLElement;
  syncState(state: Readonly<SandboxState>): void;
  destroy(): void;
}

const TOOL_SPECS: ReadonlyArray<{ readonly id: SandboxTool; readonly label: string }> = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'spawn', label: 'Spawn' },
  { id: 'remove', label: 'Remove' },
  { id: 'brush', label: 'Brush' },
];

/**
 * Creates the accessible Sandbox World Editor toolbar (ADR 0009): tool picker, species palette,
 * field brush controls, heatmap overlay selector, and Scenario JSON Save/Load.
 */
export function createSandboxToolbar(
  species: readonly SpeciesSummary[],
  fields: readonly string[],
  scenarios: readonly ScenarioPresetSummary[],
  callbacks: SandboxToolbarCallbacks,
): SandboxToolbarHandle {
  const bar = document.createElement('div');
  bar.className = 'ecosim-panel ecosim-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Sandbox editor and overlay tools');
  bar.setAttribute('focusgroup', 'toolbar wrap');

  const toolGroup = document.createElement('div');
  toolGroup.setAttribute('role', 'group');
  toolGroup.setAttribute('aria-label', 'Canvas tool');

  const toolButtons = new Map<SandboxTool, HTMLButtonElement>();
  for (const spec of TOOL_SPECS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ecosim-btn';
    btn.textContent = spec.label;
    btn.setAttribute('aria-pressed', spec.id === 'inspect' ? 'true' : 'false');
    btn.addEventListener('click', () => callbacks.onToolChange(spec.id));
    toolButtons.set(spec.id, btn);
    toolGroup.append(btn);
  }

  const sep1 = document.createElement('span');
  sep1.setAttribute('role', 'separator');
  sep1.setAttribute('aria-orientation', 'vertical');

  const speciesSelect = document.createElement('select');
  speciesSelect.className = 'ecosim-select';
  speciesSelect.setAttribute('aria-label', 'Species to spawn');
  for (const sp of species) {
    const opt = document.createElement('option');
    opt.value = sp.id;
    opt.textContent = `${sp.name} (${sp.kingdom})`;
    speciesSelect.append(opt);
  }
  speciesSelect.addEventListener('change', () => callbacks.onSpeciesChange(speciesSelect.value));

  const heatmapSelect = document.createElement('select');
  heatmapSelect.className = 'ecosim-select';
  heatmapSelect.setAttribute('aria-label', 'Field heatmap overlay');
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'Heatmap: Off';
  heatmapSelect.append(noneOpt);
  for (const field of fields) {
    const opt = document.createElement('option');
    opt.value = field;
    opt.textContent = `Heatmap: ${field}`;
    heatmapSelect.append(opt);
  }
  heatmapSelect.addEventListener('change', () =>
    callbacks.onHeatmapChange(heatmapSelect.value === '' ? null : heatmapSelect.value),
  );

  const brushSelect = document.createElement('select');
  brushSelect.className = 'ecosim-select';
  brushSelect.setAttribute('aria-label', 'Brush target field');
  for (const field of fields) {
    const opt = document.createElement('option');
    opt.value = field;
    opt.textContent = `Brush: ${field}`;
    brushSelect.append(opt);
  }
  brushSelect.addEventListener('change', () => callbacks.onBrushFieldChange(brushSelect.value));

  const radiusInput = document.createElement('input');
  radiusInput.type = 'number';
  radiusInput.className = 'ecosim-input';
  radiusInput.min = '0.5';
  radiusInput.max = '15';
  radiusInput.step = '0.5';
  radiusInput.style.width = '56px';
  radiusInput.title = 'Brush radius (m)';
  radiusInput.setAttribute('aria-label', 'Brush radius in meters');
  radiusInput.addEventListener('change', () => {
    const v = Number(radiusInput.value);
    if (Number.isFinite(v) && v > 0) callbacks.onBrushRadiusChange(v);
  });

  const valueInput = document.createElement('input');
  valueInput.type = 'number';
  valueInput.className = 'ecosim-input';
  valueInput.min = '0.1';
  valueInput.max = '100';
  valueInput.step = '0.5';
  valueInput.style.width = '56px';
  valueInput.title = 'Brush intensity value';
  valueInput.setAttribute('aria-label', 'Brush value');
  valueInput.addEventListener('change', () => {
    const v = Number(valueInput.value);
    if (Number.isFinite(v) && v >= 0) callbacks.onBrushValueChange(v);
  });

  const sep2 = document.createElement('span');
  sep2.setAttribute('role', 'separator');
  sep2.setAttribute('aria-orientation', 'vertical');

  const scenarioGroup = document.createElement('div');
  scenarioGroup.setAttribute('role', 'group');
  scenarioGroup.setAttribute('aria-label', 'Scenario presets and save/load');

  const scenarioSelect = document.createElement('select');
  scenarioSelect.className = 'ecosim-select';
  scenarioSelect.setAttribute('aria-label', 'Scenario preset');
  for (const preset of scenarios) {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.label;
    opt.title = preset.description;
    scenarioSelect.append(opt);
  }
  scenarioSelect.addEventListener('change', () => callbacks.onSelectScenario(scenarioSelect.value));

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'ecosim-btn';
  resetBtn.textContent = 'Reset';
  resetBtn.title = 'Reload the selected scenario with the current seed (deterministic replay)';
  resetBtn.addEventListener('click', callbacks.onResetScenario);

  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.className = 'ecosim-input';
  seedInput.min = '1';
  seedInput.max = '2147483647';
  seedInput.step = '1';
  seedInput.style.width = '72px';
  seedInput.title = 'Deterministic world seed (same seed = identical run)';
  seedInput.setAttribute('aria-label', 'Simulation seed');
  seedInput.addEventListener('change', () => {
    const parsed = Math.trunc(Number(seedInput.value));
    if (Number.isFinite(parsed) && parsed > 0) {
      callbacks.onSeedChange(parsed);
    }
  });

  const randomSeedBtn = document.createElement('button');
  randomSeedBtn.type = 'button';
  randomSeedBtn.className = 'ecosim-btn';
  randomSeedBtn.textContent = 'Random Seed';
  randomSeedBtn.title = 'Pick a new random seed and reload scenario for a fresh non-repeating run';
  randomSeedBtn.addEventListener('click', callbacks.onRandomizeSeed);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'ecosim-btn';
  saveBtn.textContent = 'Save JSON';
  saveBtn.addEventListener('click', callbacks.onSaveScenario);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file === undefined) return;
    void file.text().then((text) => {
      callbacks.onLoadScenarioJson(text);
      fileInput.value = '';
    });
  });

  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.className = 'ecosim-btn';
  loadBtn.textContent = 'Load JSON';
  loadBtn.addEventListener('click', () => fileInput.click());

  scenarioGroup.append(scenarioSelect, seedInput, randomSeedBtn, resetBtn, saveBtn, loadBtn);

  bar.append(
    toolGroup,
    sep1,
    speciesSelect,
    heatmapSelect,
    brushSelect,
    radiusInput,
    valueInput,
    sep2,
    scenarioGroup,
    fileInput,
  );
  const detachA11y = attachToolbarRovingTabindexFallback(bar);

  return {
    element: bar,
    syncState(state: Readonly<SandboxState>): void {
      for (const [id, btn] of toolButtons.entries()) {
        btn.setAttribute('aria-pressed', String(id === state.tool));
      }
      speciesSelect.value = state.selectedSpeciesId;
      scenarioSelect.value = state.selectedScenarioId;
      seedInput.value = String(state.seed);
      heatmapSelect.value = state.heatmapField ?? '';
      brushSelect.value = state.brushField;
      radiusInput.value = String(state.brushRadius);
      valueInput.value = String(state.brushValue);
      speciesSelect.style.display = state.tool === 'spawn' ? '' : 'none';
      const showBrush = state.tool === 'brush';
      brushSelect.style.display = showBrush ? '' : 'none';
      radiusInput.style.display = showBrush ? '' : 'none';
      valueInput.style.display = showBrush ? '' : 'none';
    },
    destroy(): void {
      detachA11y();
    },
  };
}
