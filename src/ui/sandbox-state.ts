import { createEntityId, type Vec2 } from '@core/index';
import type { SimCommand } from '@sim/commands';
import type { FieldBrushMode } from '@world/index';

/**
 * Interactive canvas tool selected in the Sandbox toolbar.
 */
export type SandboxTool = 'inspect' | 'spawn' | 'remove' | 'brush';

/**
 * Supported playback speed multipliers in the Observation HUD.
 */
export const SPEED_PRESETS = Object.freeze([0.25, 0.5, 1, 2, 4] as const);

/**
 * Serializable UI state governing playback, heatmap selection, and Sandbox editing.
 */
export interface SandboxState {
  tool: SandboxTool;
  paused: boolean;
  speedMultiplier: number;
  selectedSpeciesId: string;
  selectedEntityId: number | null;
  heatmapField: string | null;
  brushField: string;
  brushRadius: number;
  brushValue: number;
  brushMode: FieldBrushMode;
}

/**
 * Creates the initial Observation & Sandbox HUD state.
 */
export function createInitialSandboxState(): SandboxState {
  return {
    tool: 'inspect',
    paused: false,
    speedMultiplier: 1,
    selectedSpeciesId: 'rabbit',
    selectedEntityId: null,
    heatmapField: null,
    brushField: 'soil.nutrients',
    brushRadius: 2.5,
    brushValue: 6,
    brushMode: 'add',
  };
}

/**
 * Checks whether a world-space point lies inside the playable arena margin.
 */
export function isWithinWorldBounds(
  position: Vec2,
  worldWidth: number,
  worldHeight: number,
  marginMeters = 0.5,
): boolean {
  return (
    position.x >= marginMeters &&
    position.x <= worldWidth - marginMeters &&
    position.y >= marginMeters &&
    position.y <= worldHeight - marginMeters
  );
}

/**
 * Converts a canvas interaction at `worldPosition` into a deterministic {@link SimCommand}
 * according to the active Sandbox tool (or `null` when the tool is `'inspect'` or out of bounds).
 */
export function buildCanvasActionCommand(
  state: Readonly<SandboxState>,
  worldPosition: Vec2,
  worldWidth: number,
  worldHeight: number,
  pickedEntityId: number | null,
): SimCommand | null {
  if (!isWithinWorldBounds(worldPosition, worldWidth, worldHeight)) {
    return null;
  }

  switch (state.tool) {
    case 'inspect':
      return null;

    case 'spawn':
      return {
        type: 'spawn-species',
        speciesId: state.selectedSpeciesId,
        position: worldPosition,
      };

    case 'remove':
      if (pickedEntityId === null) return null;
      return {
        type: 'remove-entity',
        entityId: createEntityId(pickedEntityId),
      };

    case 'brush':
      return {
        type: 'paint-field',
        fieldName: state.brushField,
        x: worldPosition.x,
        y: worldPosition.y,
        radiusMeters: state.brushRadius,
        value: state.brushValue,
        mode: state.brushMode,
      };
  }
}
