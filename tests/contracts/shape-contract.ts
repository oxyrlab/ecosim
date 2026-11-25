import { describe, expect, it } from 'vitest';
import {
  isSimplePolygonConvex,
  type ConcaveStrategy,
  type PathCommand,
  type ShapeDef,
} from '@appearance/index';
import { isKebabCaseId } from '@core/index';

/**
 * Fixtures required by {@link runShapeContract} to verify any registered {@link ShapeDef}.
 */
export interface ShapeContractFixtures {
  /** Valid parameters expected to pass Zod validation. */
  readonly validParams: unknown;
  /** Invalid parameters expected to be rejected by Zod validation. */
  readonly invalidParams: unknown;
}

function assertPathClosedAndFinite(commands: readonly PathCommand[]): void {
  expect(commands.length).toBeGreaterThanOrEqual(2);
  expect(commands[commands.length - 1]?.kind).toBe('closePath');
  for (const cmd of commands) {
    if (cmd.kind === 'moveTo' || cmd.kind === 'lineTo') {
      expect(Number.isFinite(cmd.x)).toBe(true);
      expect(Number.isFinite(cmd.y)).toBe(true);
    } else if (cmd.kind === 'arc') {
      expect(Number.isFinite(cmd.cx)).toBe(true);
      expect(Number.isFinite(cmd.cy)).toBe(true);
      expect(Number.isFinite(cmd.radius) && cmd.radius > 0).toBe(true);
      expect(Number.isFinite(cmd.startAngle)).toBe(true);
      expect(Number.isFinite(cmd.endAngle)).toBe(true);
    }
  }
}

/**
 * Shared contract suite that every registered {@link ShapeDef} must satisfy (Section 9.3):
 * 1. Valid kebab-case id and non-empty description.
 * 2. Accepts valid params and rejects invalid params via Zod.
 * 3. Positive finite bounds and positive finite area.
 * 4. `toPath` is closed (`closePath`) and NaN-free.
 * 5. `toColliders` produces convex colliders for every applicable `ConcaveStrategy`.
 * 6. `scaleParams(p, 2)` doubles linear bounds and quadruples area.
 */
export function runShapeContract(def: ShapeDef<unknown>, fixtures: ShapeContractFixtures): void {
  describe(`ShapeContract(${def.id})`, () => {
    it('declares valid metadata and Zod parameter validation', () => {
      expect(isKebabCaseId(def.id)).toBe(true);
      expect(def.description.trim().length).toBeGreaterThan(0);
      expect(() => def.params.parse(fixtures.validParams)).not.toThrow();
      expect(() => def.params.parse(fixtures.invalidParams)).toThrow();
    });

    it('produces positive finite bounds, closed NaN-free path, and consistent scaling', () => {
      const parsed = def.params.parse(fixtures.validParams);
      const bounds = def.bounds(parsed);
      expect(Number.isFinite(bounds.w) && bounds.w > 0).toBe(true);
      expect(Number.isFinite(bounds.h) && bounds.h > 0).toBe(true);

      const area = def.area(parsed);
      expect(Number.isFinite(area) && area > 0).toBe(true);

      assertPathClosedAndFinite(def.toPath(parsed));

      const doubled = def.scaleParams(parsed, 2);
      const doubledBounds = def.bounds(doubled);
      expect(doubledBounds.w).toBeCloseTo(bounds.w * 2, 5);
      expect(doubledBounds.h).toBeCloseTo(bounds.h * 2, 5);
      expect(def.area(doubled)).toBeCloseTo(area * 4, 5);
    });

    it('outputs convex colliders under every strategy (reject, hull, decompose)', () => {
      const parsed = def.params.parse(fixtures.validParams);
      const strategies: readonly ConcaveStrategy[] = ['reject', 'hull', 'decompose'];
      for (const strategy of strategies) {
        const colliders = def.toColliders(parsed, strategy);
        expect(colliders.length).toBeGreaterThan(0);
        for (const col of colliders) {
          if (col.shape.kind === 'convex') {
            expect(isSimplePolygonConvex(col.shape.vertices)).toBe(true);
          }
        }
      }
    });
  });
}
