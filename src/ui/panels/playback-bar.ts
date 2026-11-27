import type { SimulationStatsSnapshot } from '@sim/stats';
import { SPEED_PRESETS } from '../sandbox-state';
import { attachToolbarRovingTabindexFallback } from './toolbar-a11y';

/**
 * Callbacks wired from the playback control bar to the main application controller.
 */
export interface PlaybackBarCallbacks {
  readonly onTogglePause: () => void;
  readonly onSingleStep: () => void;
  readonly onSpeedChange: (multiplier: number) => void;
}

/**
 * Live handle returned by {@link createPlaybackBar}.
 */
export interface PlaybackBarHandle {
  readonly element: HTMLElement;
  updatePlaybackState(paused: boolean, speedMultiplier: number): void;
  updateTelemetry(stats: SimulationStatsSnapshot): void;
  destroy(): void;
}

/**
 * Creates an accessible playback control bar (`Play/Pause`, `Step`, speed presets, and live
 * tick/time/energy telemetry readout).
 */
export function createPlaybackBar(callbacks: PlaybackBarCallbacks): PlaybackBarHandle {
  const bar = document.createElement('div');
  bar.className = 'ecosim-panel ecosim-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Simulation playback controls');
  bar.setAttribute('focusgroup', 'toolbar wrap');

  const transportGroup = document.createElement('div');
  transportGroup.setAttribute('role', 'group');
  transportGroup.setAttribute('aria-label', 'Transport');

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'ecosim-btn';
  pauseBtn.textContent = 'Pause';
  pauseBtn.setAttribute('aria-pressed', 'false');
  pauseBtn.addEventListener('click', callbacks.onTogglePause);

  const stepBtn = document.createElement('button');
  stepBtn.type = 'button';
  stepBtn.className = 'ecosim-btn';
  stepBtn.textContent = 'Step';
  stepBtn.title = 'Advance by 1 fixed simulation tick';
  stepBtn.addEventListener('click', callbacks.onSingleStep);

  transportGroup.append(pauseBtn, stepBtn);

  const sep1 = document.createElement('span');
  sep1.setAttribute('role', 'separator');
  sep1.setAttribute('aria-orientation', 'vertical');

  const speedGroup = document.createElement('div');
  speedGroup.setAttribute('role', 'group');
  speedGroup.setAttribute('aria-label', 'Playback speed');

  const speedButtons = new Map<number, HTMLButtonElement>();
  for (const preset of SPEED_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ecosim-btn';
    btn.textContent = `${preset}×`;
    btn.setAttribute('aria-pressed', preset === 1 ? 'true' : 'false');
    btn.addEventListener('click', () => callbacks.onSpeedChange(preset));
    speedButtons.set(preset, btn);
    speedGroup.append(btn);
  }

  const sep2 = document.createElement('span');
  sep2.setAttribute('role', 'separator');
  sep2.setAttribute('aria-orientation', 'vertical');

  const telemetry = document.createElement('span');
  telemetry.className = 'ecosim-stat-pill';
  telemetry.textContent = 'Tick 0 · 0.0s · 0 EU';

  bar.append(transportGroup, sep1, speedGroup, sep2, telemetry);
  const detachA11y = attachToolbarRovingTabindexFallback(bar);

  return {
    element: bar,
    updatePlaybackState(paused: boolean, speedMultiplier: number): void {
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.textContent = paused ? 'Paused' : 'Pause';
      for (const [preset, btn] of speedButtons.entries()) {
        btn.setAttribute('aria-pressed', String(preset === speedMultiplier));
      }
    },
    updateTelemetry(stats: SimulationStatsSnapshot): void {
      telemetry.textContent = `Tick ${stats.tick} · ${stats.timeSeconds.toFixed(1)}s · ${stats.totalEntities} ent · ${stats.totalWorldEnergy.toFixed(0)} EU`;
    },
    destroy(): void {
      detachA11y();
    },
  };
}
