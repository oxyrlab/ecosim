import type { ResolvedBodyLayout, ResolvedPart } from '@appearance/types';

/**
 * Partitioned visual layers of a {@link ResolvedBodyLayout}:
 * - `staticParts`: baked once per `appearanceSignature` into a cached texture.
 * - `dynamicParts`: animated or jointed parts rendered as separate dynamic sprites.
 */
export interface SplitAppearanceLayers {
  readonly staticParts: readonly ResolvedPart[];
  readonly dynamicParts: readonly ResolvedPart[];
}

/**
 * Splits a resolved body layout into static (bakeable) and dynamic (animated/jointed) layers,
 * each sorted by draw order `z`.
 */
export function splitAppearanceLayers(layout: ResolvedBodyLayout): SplitAppearanceLayers {
  const staticParts: ResolvedPart[] = [];
  const dynamicParts: ResolvedPart[] = [];
  for (const part of layout.parts) {
    if (part.isDynamicVisual) {
      dynamicParts.push(part);
    } else {
      staticParts.push(part);
    }
  }
  staticParts.sort((a, b) => a.z - b.z);
  dynamicParts.sort((a, b) => a.z - b.z);
  return { staticParts, dynamicParts };
}

/**
 * Cache entry storing a baked texture handle alongside the layout signature it represents.
 */
export interface BakedTextureEntry<TTexture> {
  readonly signature: string;
  readonly texture: TTexture;
  readonly staticPartCount: number;
}

/**
 * Deterministic cache that bakes non-animated, fixed body parts once per `appearanceSignature`
 * (ADR 0006). Parameterized by `TTexture` so baking logic is 100% unit-testable in Node.js while
 * accepting PixiJS `Texture` objects in the browser.
 *
 * @typeParam TTexture - Backend texture handle (e.g. PixiJS `Texture`).
 */
export class AppearanceTextureCache<TTexture> {
  private readonly entries = new Map<string, BakedTextureEntry<TTexture>>();
  private readonly bakeFn: (
    staticParts: readonly ResolvedPart[],
    layout: ResolvedBodyLayout,
  ) => TTexture;
  private readonly disposeFn: ((texture: TTexture) => void) | undefined;

  /**
   * Creates an {@link AppearanceTextureCache}.
   *
   * @param bakeFn - Function that renders `staticParts` into a reusable texture.
   * @param disposeFn - Optional destructor invoked when clearing the cache.
   */
  public constructor(
    bakeFn: (staticParts: readonly ResolvedPart[], layout: ResolvedBodyLayout) => TTexture,
    disposeFn?: (texture: TTexture) => void,
  ) {
    this.bakeFn = bakeFn;
    this.disposeFn = disposeFn;
  }

  /** Number of unique cached appearance signatures. */
  public get size(): number {
    return this.entries.size;
  }

  /**
   * Returns the cached baked texture for `layout.appearanceSignature`, baking it once on cache miss.
   */
  public getOrBake(layout: ResolvedBodyLayout): BakedTextureEntry<TTexture> {
    const existing = this.entries.get(layout.appearanceSignature);
    if (existing !== undefined) {
      return existing;
    }

    const { staticParts } = splitAppearanceLayers(layout);
    const texture = this.bakeFn(staticParts, layout);
    const entry: BakedTextureEntry<TTexture> = {
      signature: layout.appearanceSignature,
      texture,
      staticPartCount: staticParts.length,
    };
    this.entries.set(layout.appearanceSignature, entry);
    return entry;
  }

  /** Returns `true` if a texture for `signature` is currently cached. */
  public has(signature: string): boolean {
    return this.entries.has(signature);
  }

  /** Disposes and clears all cached textures. */
  public clear(): void {
    if (this.disposeFn !== undefined) {
      for (const entry of this.entries.values()) {
        this.disposeFn(entry.texture);
      }
    }
    this.entries.clear();
  }
}
