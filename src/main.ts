import * as Comlink from 'comlink';
import type { Vec2 } from '@core/index';
import { EcoSimRenderer } from '@render/index';
import {
  createDefaultMeadowScenario,
  createEmptySandboxScenario,
  parseScenarioJson,
  serializeScenario,
  type RenderSnapshot,
  type SimWorkerApi,
} from '@sim/index';
import SimWorker from '@sim/worker?worker';
import { buildCanvasActionCommand, createInitialSandboxState, EcoSimHud } from '@ui/index';

const DEFAULT_SEED = 42;
const HUD_REFRESH_INTERVAL_MS = 250;

function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function bootstrap(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#app');
  if (container === null) return;

  const rawWorker = new SimWorker();
  const worker = Comlink.wrap<SimWorkerApi>(rawWorker);
  const state = createInitialSandboxState();

  const initialScenario = createDefaultMeadowScenario(DEFAULT_SEED);
  let latestSnapshot: RenderSnapshot = await worker.loadScenario(initialScenario);
  const [species, fields] = await Promise.all([worker.listSpecies(), worker.listFields()]);

  let renderer: EcoSimRenderer | null = null;

  const refreshOverlays = async (): Promise<void> => {
    const [stats, history] = await Promise.all([worker.getStats(), worker.getStatsHistory()]);
    hud.updateTelemetry(stats, history);

    if (state.selectedEntityId !== null) {
      const inspected = await worker.inspectEntity(state.selectedEntityId);
      if (inspected === null) {
        state.selectedEntityId = null;
        renderer?.setSelectedEntityId(null);
      }
      hud.updateInspection(inspected);
    } else {
      hud.updateInspection(null);
    }

    if (state.heatmapField !== null) {
      const heatmap = await worker.getFieldHeatmap(state.heatmapField);
      renderer?.setHeatmap(heatmap);
    } else {
      renderer?.setHeatmap(null);
    }
  };

  const handleWorldPointer = async (worldPos: Vec2): Promise<void> => {
    if (state.tool === 'inspect') {
      const picked = await worker.pickEntity(worldPos);
      state.selectedEntityId = picked;
      renderer?.setSelectedEntityId(picked);
      hud.updateInspection(picked !== null ? await worker.inspectEntity(picked) : null);
      return;
    }

    const picked = state.tool === 'remove' ? await worker.pickEntity(worldPos) : null;
    const cmd = buildCanvasActionCommand(
      state,
      worldPos,
      latestSnapshot.worldWidth,
      latestSnapshot.worldHeight,
      picked,
    );
    if (cmd === null) return;
    await worker.enqueueCommand(cmd);
    if (state.paused) {
      latestSnapshot = await worker.stepFixed(1);
      await refreshOverlays();
    }
  };

  const hud = new EcoSimHud(container, species, fields, {
    onTogglePause() {
      state.paused = !state.paused;
      hud.syncState(state);
    },
    onSingleStep() {
      state.paused = true;
      hud.syncState(state);
      void worker.stepFixed(1).then(async (snap) => {
        latestSnapshot = snap;
        await refreshOverlays();
      });
    },
    onSpeedChange(multiplier) {
      state.speedMultiplier = multiplier;
      hud.syncState(state);
    },
    onToolChange(tool) {
      state.tool = tool;
      renderer?.setInteractionMode(tool === 'brush' ? 'brush' : 'pan');
      hud.syncState(state);
    },
    onSpeciesChange(speciesId) {
      state.selectedSpeciesId = speciesId;
      hud.syncState(state);
    },
    onHeatmapChange(fieldName) {
      state.heatmapField = fieldName;
      hud.syncState(state);
      void refreshOverlays();
    },
    onBrushFieldChange(fieldName) {
      state.brushField = fieldName;
      hud.syncState(state);
    },
    onBrushRadiusChange(radius) {
      state.brushRadius = radius;
      hud.syncState(state);
    },
    onBrushValueChange(value) {
      state.brushValue = value;
      hud.syncState(state);
    },
    onLoadPreset(preset) {
      const scenario =
        preset === 'default'
          ? createDefaultMeadowScenario(DEFAULT_SEED)
          : createEmptySandboxScenario(DEFAULT_SEED);
      state.selectedEntityId = null;
      renderer?.setSelectedEntityId(null);
      void worker.loadScenario(scenario).then(async (snap) => {
        latestSnapshot = snap;
        renderer?.fitWorld(snap.worldWidth, snap.worldHeight);
        await refreshOverlays();
        hud.announce(`Loaded scenario "${scenario.name}".`);
      });
    },
    onSaveScenario() {
      void worker.exportScenario().then((exported) => {
        downloadJsonFile(
          `${exported.name}-tick-${latestSnapshot.tick}.json`,
          serializeScenario(exported),
        );
        hud.announce(`Saved scenario with ${exported.commands.length} recorded commands.`);
      });
    },
    onLoadScenarioJson(jsonText) {
      try {
        const scenario = parseScenarioJson(jsonText);
        state.selectedEntityId = null;
        renderer?.setSelectedEntityId(null);
        void worker.loadScenario(scenario).then(async (snap) => {
          latestSnapshot = snap;
          renderer?.fitWorld(snap.worldWidth, snap.worldHeight);
          await refreshOverlays();
          hud.announce(`Loaded "${scenario.name}" (${scenario.commands.length} replay commands).`);
        });
      } catch (err) {
        hud.announce(
          `Failed to load scenario: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });

  hud.syncState(state);

  renderer = await EcoSimRenderer.create({
    container: hud.canvasHost,
    worldWidthMeters: latestSnapshot.worldWidth,
    worldHeightMeters: latestSnapshot.worldHeight,
    onWorldClick(pos) {
      void handleWorldPointer(pos);
    },
    onWorldDrag(pos) {
      if (state.tool === 'brush') {
        void handleWorldPointer(pos);
      }
    },
  });

  await refreshOverlays();

  let lastTimeMs = performance.now();
  let lastHudRefreshMs = lastTimeMs;
  let stepping = false;
  let refreshing = false;

  const frame = (nowMs: number): void => {
    const dtSeconds = Math.min(0.1, Math.max(0, (nowMs - lastTimeMs) / 1000));
    lastTimeMs = nowMs;

    renderer?.render(latestSnapshot);

    if (!state.paused && !stepping) {
      stepping = true;
      void worker
        .advance(dtSeconds * state.speedMultiplier)
        .then((snap) => {
          latestSnapshot = snap;
        })
        .finally(() => {
          stepping = false;
        });
    }

    if (nowMs - lastHudRefreshMs >= HUD_REFRESH_INTERVAL_MS && !refreshing) {
      lastHudRefreshMs = nowMs;
      refreshing = true;
      void refreshOverlays().finally(() => {
        refreshing = false;
      });
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

void bootstrap();
