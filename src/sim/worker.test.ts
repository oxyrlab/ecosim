import { describe, expect, it } from 'vitest';
import { InvariantViolationError } from '@core/index';
import { readSnapshotEntity } from './snapshot';
import { createSimWorkerController } from './worker';

describe('SimWorkerController', () => {
  it('initializes Rapier, executes queued commands, advances, and disposes cleanly', async () => {
    const controller = createSimWorkerController(false);
    expect(() => controller.getSnapshot()).toThrow(InvariantViolationError);

    const initial = await controller.init({
      world: { seed: 7, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
    });
    expect(initial.tick).toBe(0);
    expect(initial.entityCount).toBe(0);

    controller.enqueueCommand({
      type: 'spawn-body',
      position: { x: 6, y: 8 },
      radius: 0.4,
      linearVelocity: { x: 2, y: 0 },
      color: 0xf472b6,
    });

    const afterStep = controller.stepFixed(3);
    expect(afterStep.tick).toBe(3);
    expect(afterStep.entityCount).toBe(1);
    expect(readSnapshotEntity(afterStep, 0).x).toBeGreaterThan(6);

    const afterSingleStep = controller.stepFixed();
    expect(afterSingleStep.tick).toBe(4);

    const afterAdvance = controller.advance(0.1);
    expect(afterAdvance.tick).toBe(7);
    expect(controller.getCommandHistory()).toHaveLength(1);
    expect(controller.computeStateHash()).toBeGreaterThanOrEqual(0);
    expect(controller.getSnapshot().tick).toBe(7);

    // Default transfer mode also wraps snapshots cleanly
    const transferring = createSimWorkerController();
    const tSnap = await transferring.init({
      world: { seed: 9, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
    });
    expect(tSnap.tick).toBe(0);
    transferring.dispose();

    // Re-init disposes previous simulation safely
    const reset = await controller.init({
      world: { seed: 7, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
    });
    expect(reset.tick).toBe(0);

    controller.dispose();
    controller.dispose(); // idempotent
    expect(() => controller.getSnapshot()).toThrow(InvariantViolationError);
  });
});
