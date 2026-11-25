import { createSeededRng, type SeededRng } from '@core/index';

/**
 * Creates a deterministic {@link SeededRng} for tests (default seed `1337`).
 *
 * @param seed - Integer seed.
 */
export function createTestRng(seed = 1337): SeededRng {
  return createSeededRng(seed);
}
