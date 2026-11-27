import { describe, expect, it } from 'vitest';
import {
  buildCanvasActionCommand,
  createInitialSandboxState,
  isWithinWorldBounds,
  SPEED_PRESETS,
} from './sandbox-state';

describe('sandbox-state', () => {
  it('builds deterministic SimCommands for spawn, remove, and brush tools', () => {
    const state = createInitialSandboxState();
    expect(SPEED_PRESETS).toContain(1);
    expect(isWithinWorldBounds({ x: 5, y: 5 }, 40, 40)).toBe(true);
    expect(isWithinWorldBounds({ x: 0.1, y: 5 }, 40, 40)).toBe(false);

    // Inspect returns null
    expect(buildCanvasActionCommand(state, { x: 10, y: 10 }, 40, 40, 1)).toBeNull();
    // Out of bounds returns null
    expect(
      buildCanvasActionCommand({ ...state, tool: 'spawn' }, { x: -1, y: 10 }, 40, 40, null),
    ).toBeNull();

    expect(
      buildCanvasActionCommand(
        { ...state, tool: 'spawn', selectedSpeciesId: 'fox' },
        { x: 8, y: 9 },
        40,
        40,
        null,
      ),
    ).toEqual({
      type: 'spawn-species',
      speciesId: 'fox',
      position: { x: 8, y: 9 },
    });

    expect(
      buildCanvasActionCommand({ ...state, tool: 'remove' }, { x: 8, y: 9 }, 40, 40, null),
    ).toBeNull();
    expect(
      buildCanvasActionCommand({ ...state, tool: 'remove' }, { x: 8, y: 9 }, 40, 40, 4),
    ).toEqual({
      type: 'remove-entity',
      entityId: 4,
    });

    expect(
      buildCanvasActionCommand({ ...state, tool: 'brush' }, { x: 12, y: 15 }, 40, 40, null),
    ).toEqual({
      type: 'paint-field',
      fieldName: 'soil.nutrients',
      x: 12,
      y: 15,
      radiusMeters: 2.5,
      value: 6,
      mode: 'add',
    });
  });
});
