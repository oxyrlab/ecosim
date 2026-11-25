import { describe, expect, it } from 'vitest';
import { CommandQueue } from './commands';

describe('CommandQueue', () => {
  it('buffers commands FIFO, stamps execution ticks in history, and clears', () => {
    const queue = new CommandQueue(true);
    expect(queue.pendingCount).toBe(0);
    expect(queue.drainForTick(0)).toEqual([]);

    queue.enqueue({ type: 'spawn-body', position: { x: 2, y: 3 }, radius: 0.4 });
    queue.enqueue({
      type: 'paint-field',
      fieldName: 'soil.nutrients',
      x: 5,
      y: 5,
      radiusMeters: 2,
      value: 1,
    });
    expect(queue.pendingCount).toBe(2);

    const drained = queue.drainForTick(7);
    expect(drained).toHaveLength(2);
    expect(queue.pendingCount).toBe(0);
    expect(queue.getHistory()).toEqual([
      { tick: 7, command: drained[0] },
      { tick: 7, command: drained[1] },
    ]);

    queue.clear();
    expect(queue.getHistory()).toEqual([]);
  });

  it('can disable history recording', () => {
    const queue = new CommandQueue(false);
    queue.enqueue({ type: 'spawn-body', position: { x: 1, y: 1 }, radius: 0.5 });
    expect(queue.drainForTick(1)).toHaveLength(1);
    expect(queue.getHistory()).toEqual([]);
  });
});
