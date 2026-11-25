import { describe, expect, it } from 'vitest';
import { initRapier, isRapierInitialized } from './rapier-init';

describe('rapier-init', () => {
  it('initializes Rapier WASM idempotently', async () => {
    const [a, b] = await Promise.all([initRapier(), initRapier()]);
    expect(a).toBe(b);
    expect(isRapierInitialized()).toBe(true);
    const c = await initRapier();
    expect(c).toBe(a);
  });
});
