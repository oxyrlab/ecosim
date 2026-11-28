import './hud.css';
import type { EntityInspection } from '@sim/inspector';
import type { ScenarioPresetSummary } from '@sim/scenario-registry';
import type { SimulationStatsSnapshot } from '@sim/stats';
import type { SpeciesSummary } from '@sim/worker';
import { createInspectorPanel, type InspectorPanelHandle } from './panels/inspector-panel';
import {
  createPlaybackBar,
  type PlaybackBarCallbacks,
  type PlaybackBarHandle,
} from './panels/playback-bar';
import {
  createSandboxToolbar,
  type SandboxToolbarCallbacks,
  type SandboxToolbarHandle,
} from './panels/sandbox-toolbar';
import type { SandboxState } from './sandbox-state';

/**
 * Combined callbacks for {@link EcoSimHud}.
 */
export interface EcoSimHudCallbacks extends PlaybackBarCallbacks, SandboxToolbarCallbacks {}

/**
 * Composed Observation & Sandbox HUD mounted over the PixiJS viewport container.
 */
export class EcoSimHud {
  /** Dedicated child container where {@link EcoSimRenderer} mounts its canvas. */
  public readonly canvasHost: HTMLDivElement;

  private readonly shell: HTMLDivElement;
  private readonly playback: PlaybackBarHandle;
  private readonly toolbar: SandboxToolbarHandle;
  private readonly inspector: InspectorPanelHandle;
  private readonly statusRegion: HTMLParagraphElement;

  /**
   * Mounts the EcoSim HUD shell inside `rootContainer`.
   */
  public constructor(
    rootContainer: HTMLElement,
    species: readonly SpeciesSummary[],
    fields: readonly string[],
    scenarios: readonly ScenarioPresetSummary[],
    callbacks: EcoSimHudCallbacks,
  ) {
    this.shell = document.createElement('div');
    this.shell.className = 'ecosim-shell';

    this.canvasHost = document.createElement('div');
    this.canvasHost.className = 'ecosim-canvas-host';

    const topBar = document.createElement('div');
    topBar.className = 'ecosim-hud-top';

    this.playback = createPlaybackBar(callbacks);
    this.toolbar = createSandboxToolbar(species, fields, scenarios, callbacks);
    topBar.append(this.playback.element, this.toolbar.element);

    this.inspector = createInspectorPanel();

    this.statusRegion = document.createElement('p');
    this.statusRegion.className = 'ecosim-panel ecosim-status-region';
    this.statusRegion.setAttribute('role', 'status');
    this.statusRegion.style.display = 'none';

    this.shell.append(this.canvasHost, topBar, this.inspector.element, this.statusRegion);
    rootContainer.replaceChildren(this.shell);
  }

  /** Synchronizes playback and Sandbox toolbar states. */
  public syncState(state: Readonly<SandboxState>): void {
    this.playback.updatePlaybackState(state.paused, state.speedMultiplier);
    this.toolbar.syncState(state);
  }

  /** Updates live telemetry readout and population chart. */
  public updateTelemetry(
    stats: SimulationStatsSnapshot,
    history: readonly SimulationStatsSnapshot[],
  ): void {
    this.playback.updateTelemetry(stats);
    this.inspector.updateChart(history);
  }

  /** Updates the right-hand Entity Inspector panel. */
  public updateInspection(inspection: EntityInspection | null): void {
    this.inspector.updateInspection(inspection);
  }

  /** Announces a brief non-blocking status message in the accessible live region. */
  public announce(message: string): void {
    this.statusRegion.textContent = message;
    this.statusRegion.style.display = '';
    window.setTimeout(() => {
      if (this.statusRegion.textContent === message) {
        this.statusRegion.style.display = 'none';
      }
    }, 3500);
  }

  /** Detaches listeners and removes HUD DOM elements. */
  public destroy(): void {
    this.playback.destroy();
    this.toolbar.destroy();
    this.shell.remove();
  }
}
