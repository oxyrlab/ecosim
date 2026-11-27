import { colorGeneToHex, resolveLayout } from '@appearance/index';
import type { PathCommand } from '@appearance/shapes';
import type { BodyPartSpec, ResolvedBodyLayout, ResolvedPart } from '@appearance/types';
import { FOX_BLUEPRINT } from '@species/fox/blueprint';
import { RABBIT_BLUEPRINT } from '@species/rabbit/blueprint';

/**
 * Compact numeric `RenderableStubComponent.kind` codes transmitted in `RenderSnapshot`.
 */
export const RENDER_KIND = Object.freeze({
  BODY: 1,
  PLANT: 2,
  FRUIT: 3,
  BUSH: 4,
  CORPSE: 5,
  RABBIT: 10,
  FOX: 11,
} as const);

/**
 * One resolved vector path layer ready to draw onto a PixiJS `Graphics` or bake into a texture.
 */
export interface ProceduralDrawPart {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly z: number;
  readonly fillColor: number;
  readonly strokeColor: number | null;
  readonly strokeWidth: number;
  readonly commands: readonly PathCommand[];
}

/**
 * Maps a registered species ID and kingdom into a compact numeric {@link RENDER_KIND} code.
 */
export function resolveSpeciesRenderKind(speciesId: string, kingdom: 'animal' | 'plant'): number {
  if (speciesId === 'rabbit') return RENDER_KIND.RABBIT;
  if (speciesId === 'fox') return RENDER_KIND.FOX;
  if (speciesId === 'berry-bush') return RENDER_KIND.BUSH;
  return kingdom === 'plant' ? RENDER_KIND.PLANT : RENDER_KIND.BODY;
}

/**
 * Converts a {@link ResolvedBodyLayout}'s parts into z-ordered {@link ProceduralDrawPart}s
 * ready for PixiJS vector drawing or texture baking. Pure & zero-DOM so it is unit-tested in Node.
 */
export function buildProceduralDrawParts(
  parts: readonly ResolvedPart[],
): readonly ProceduralDrawPart[] {
  const sorted = [...parts].sort((a, b) => a.z - b.z);
  return sorted.map((part) => {
    const style = part.part.style;
    const fillColor = style !== undefined ? colorGeneToHex(style.fill) : 0x94a3b8;
    const strokeColor = style?.stroke !== undefined ? colorGeneToHex(style.stroke) : null;
    return {
      id: part.id,
      x: part.position.x,
      y: part.position.y,
      angle: part.angle,
      z: part.z,
      fillColor,
      strokeColor,
      strokeWidth: 0.02,
      commands: part.path,
    };
  });
}

const layoutCache = new Map<number, ResolvedBodyLayout>();

function getPartsForAnimalKind(kind: number): readonly BodyPartSpec[] | null {
  if (kind === RENDER_KIND.RABBIT) return RABBIT_BLUEPRINT.body.parts;
  if (kind === RENDER_KIND.FOX) return FOX_BLUEPRINT.body.parts;
  return null;
}

/**
 * Resolves and caches the procedural {@link ResolvedBodyLayout} for a built-in animal
 * {@link RENDER_KIND}, or returns `null` for non-procedural kinds.
 */
export function getProceduralLayoutForKind(kind: number): ResolvedBodyLayout | null {
  const cached = layoutCache.get(kind);
  if (cached !== undefined) return cached;
  const bodyParts = getPartsForAnimalKind(kind);
  if (bodyParts === null) return null;
  const layout = resolveLayout(bodyParts, 1, 'decompose');
  layoutCache.set(kind, layout);
  return layout;
}
