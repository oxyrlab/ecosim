import { z } from 'zod';
import { clamp, type SeededRng } from '@core/index';
import type { AnimalSpeciesBlueprint } from '@species/blueprint';

/**
 * Specification of a single numeric gene path inside an {@link AnimalSpeciesBlueprint}
 * eligible for evolutionary mutation and crossover (Section 5.4 & Phase 6).
 */
export interface MutableGeneSpec {
  /** Dot-separated path inside the Blueprint (e.g. `'metabolism.basalRatePerKgPerSecond'`, `'brain.modules.0.params.learningRate'`). */
  readonly path: string;
  /** Inclusive lower clamp bound for the mutated value. */
  readonly min: number;
  /** Inclusive upper clamp bound for the mutated value. */
  readonly max: number;
  /** Standard deviation of Gaussian perturbation applied on mutation (`> 0`). */
  readonly sigma: number;
  /** When `true`, rounds mutated value to the nearest integer. */
  readonly integer?: boolean | undefined;
}

/**
 * Species-level mutation parameters controlling evolutionary drift across generations.
 */
export interface MutationSpec {
  /** Per-gene probability of applying Gaussian mutation in `[0, 1]`. */
  readonly rate: number;
  /** List of mutable numeric parameter genes. */
  readonly mutable: readonly MutableGeneSpec[];
}

/**
 * Zod schema validating a {@link MutationSpec}.
 */
export const mutationSpecSchema = z.object({
  rate: z.number().finite().min(0).max(1).default(0.25),
  mutable: z
    .array(
      z.object({
        path: z.string().min(1),
        min: z.number().finite(),
        max: z.number().finite(),
        sigma: z.number().finite().positive(),
        integer: z.boolean().optional(),
      }),
    )
    .default([]),
});

/**
 * Reads a numeric value at a dot-separated `path` inside `root`, or returns `undefined` if
 * missing or non-numeric.
 */
export function getNumberAtPath(root: unknown, path: string): number | undefined {
  const segments = path.split('.');
  let cursor: unknown = root;
  for (const seg of segments) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    if (Array.isArray(cursor)) {
      const idx = Number.parseInt(seg, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) return undefined;
      cursor = cursor[idx];
    } else {
      cursor = (cursor as Record<string, unknown>)[seg];
    }
  }
  return typeof cursor === 'number' && Number.isFinite(cursor) ? cursor : undefined;
}

/**
 * Writes a finite numeric `value` at a dot-separated `path` inside a cloned object `root`.
 * Returns `true` if the target leaf existed (or parent object existed) and was updated.
 */
export function setNumberAtPath(root: unknown, path: string, value: number): boolean {
  const segments = path.split('.');
  if (segments.length === 0) return false;
  let cursor: unknown = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i] as string;
    if (cursor === null || typeof cursor !== 'object') return false;
    if (Array.isArray(cursor)) {
      const idx = Number.parseInt(seg, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) return false;
      cursor = cursor[idx];
    } else {
      const next = (cursor as Record<string, unknown>)[seg];
      if (next === null || typeof next !== 'object') return false;
      cursor = next;
    }
  }
  if (cursor === null || typeof cursor !== 'object') return false;
  const last = segments[segments.length - 1] as string;
  if (Array.isArray(cursor)) {
    const idx = Number.parseInt(last, 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) return false;
    cursor[idx] = value;
    return true;
  }
  (cursor as Record<string, unknown>)[last] = value;
  return true;
}

/**
 * Deep-clones an {@link AnimalSpeciesBlueprint} via JSON-safe structured clone so mutations
 * never alias parent blueprints.
 */
export function cloneBlueprint(blueprint: AnimalSpeciesBlueprint): AnimalSpeciesBlueprint {
  return structuredClone(blueprint);
}

/**
 * Produces a mutated deep clone of `blueprint` by perturbing each gene listed in `mutation.mutable`
 * with probability `mutation.rate` using Gaussian noise clamped to `[gene.min, gene.max]`.
 *
 * Also mutates numeric `weights` arrays inside `nn` modules when a gene path points to an element
 * or when `mutateWeights` is explicitly listed.
 */
export function mutateBlueprint(
  blueprint: AnimalSpeciesBlueprint,
  mutation: MutationSpec,
  rng: SeededRng,
): AnimalSpeciesBlueprint {
  const clone = cloneBlueprint(blueprint);
  for (const gene of mutation.mutable) {
    if (!rng.nextBool(mutation.rate)) continue;
    const current = getNumberAtPath(clone, gene.path);
    if (current === undefined) continue;
    let next = clamp(current + rng.nextGaussian(0, gene.sigma), gene.min, gene.max);
    if (gene.integer === true) {
      next = clamp(Math.round(next), gene.min, gene.max);
    }
    setNumberAtPath(clone, gene.path, next);
  }
  return clone;
}

/**
 * Performs uniform per-gene crossover between two same-species parent blueprints (`parentA` and
 * `parentB`), then applies {@link mutateBlueprint} to produce an offspring Blueprint.
 */
export function crossoverBlueprints(
  parentA: AnimalSpeciesBlueprint,
  parentB: AnimalSpeciesBlueprint,
  mutation: MutationSpec,
  rng: SeededRng,
): AnimalSpeciesBlueprint {
  const child = cloneBlueprint(parentA);
  for (const gene of mutation.mutable) {
    if (rng.nextBool(0.5)) {
      const fromB = getNumberAtPath(parentB, gene.path);
      if (fromB !== undefined) {
        setNumberAtPath(child, gene.path, clamp(fromB, gene.min, gene.max));
      }
    }
  }
  return mutateBlueprint(child, mutation, rng);
}
