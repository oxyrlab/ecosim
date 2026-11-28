import { colorGeneToHex, resolveLayout } from '@appearance/index';
import type { PathCommand } from '@appearance/shapes';
import type { BodyPartSpec, ResolvedBodyLayout, ResolvedPart } from '@appearance/types';
import { FOX_BLUEPRINT } from '@species/fox/blueprint';
import { RABBIT_BLUEPRINT } from '@species/rabbit/blueprint';
import type { BakedSpriteSpec, VectorPrimitive } from './plant-shapes';

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
  GRASS_SEED: 20,
  GRASS_SPROUT: 21,
  GRASS_MATURE: 22,
  GRASS_FLOWERING: 23,
  GRASS_FRUITING: 24,
  GRASS_SENESCENCE: 25,
  BUSH_SEED: 30,
  BUSH_SPROUT: 31,
  BUSH_MATURE: 32,
  BUSH_FLOWERING: 33,
  BUSH_FRUITING: 34,
  BUSH_SENESCENCE: 35,
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
  if (speciesId === 'berry-bush') return RENDER_KIND.BUSH_MATURE;
  return kingdom === 'plant' ? RENDER_KIND.GRASS_MATURE : RENDER_KIND.BODY;
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

function buildRabbitSpriteSpec(): BakedSpriteSpec {
  const stroke = 0x57463a;
  const furMain = 0xe7dfd5;
  const furLight = 0xf5f0ea;
  const furPaw = 0xc8b9a6;
  const earPink = 0xf9a8d4;

  const primitives: VectorPrimitive[] = [
    // Soft ground contact shadow
    { shape: 'ellipse', x: 0.0, y: 0.04, rx: 0.36, ry: 0.22, fill: 0x020617, alpha: 0.3 },
    // Fluffy white cotton tail puff at rear (-X)
    {
      shape: 'circle',
      x: -0.29,
      y: 0,
      r: 0.088,
      fill: 0xffffff,
      stroke: 0x94a3b8,
      strokeWidth: 0.018,
    },
    // Back & front tucked paws
    {
      shape: 'ellipse',
      x: -0.1,
      y: -0.165,
      rx: 0.075,
      ry: 0.048,
      angle: -0.25,
      fill: furPaw,
      stroke,
      strokeWidth: 0.018,
    },
    {
      shape: 'ellipse',
      x: -0.1,
      y: 0.165,
      rx: 0.075,
      ry: 0.048,
      angle: 0.25,
      fill: furPaw,
      stroke,
      strokeWidth: 0.018,
    },
    {
      shape: 'ellipse',
      x: 0.14,
      y: -0.14,
      rx: 0.06,
      ry: 0.04,
      angle: 0.2,
      fill: furPaw,
      stroke,
      strokeWidth: 0.016,
    },
    {
      shape: 'ellipse',
      x: 0.14,
      y: 0.14,
      rx: 0.06,
      ry: 0.04,
      angle: -0.2,
      fill: furPaw,
      stroke,
      strokeWidth: 0.016,
    },
    // Plump oval torso
    {
      shape: 'ellipse',
      x: -0.02,
      y: 0,
      rx: 0.25,
      ry: 0.17,
      fill: furMain,
      stroke,
      strokeWidth: 0.024,
    },
    // Subtle lighter dorsal coat highlight
    { shape: 'ellipse', x: -0.04, y: 0, rx: 0.16, ry: 0.095, fill: furLight, alpha: 0.7 },
    // Rounded head (+X)
    {
      shape: 'ellipse',
      x: 0.22,
      y: 0,
      rx: 0.145,
      ry: 0.13,
      fill: furLight,
      stroke,
      strokeWidth: 0.022,
    },
    // Long swept-back ears (outer fur + soft pink inner ear)
    {
      shape: 'ellipse',
      x: 0.08,
      y: -0.125,
      rx: 0.14,
      ry: 0.048,
      angle: 0.34,
      fill: furLight,
      stroke,
      strokeWidth: 0.018,
    },
    { shape: 'ellipse', x: 0.075, y: -0.122, rx: 0.095, ry: 0.024, angle: 0.34, fill: earPink },
    {
      shape: 'ellipse',
      x: 0.08,
      y: 0.125,
      rx: 0.14,
      ry: 0.048,
      angle: -0.34,
      fill: furLight,
      stroke,
      strokeWidth: 0.018,
    },
    { shape: 'ellipse', x: 0.075, y: 0.122, rx: 0.095, ry: 0.024, angle: -0.34, fill: earPink },
    // Glossy dark eyes + white catchlights
    { shape: 'circle', x: 0.275, y: -0.068, r: 0.026, fill: 0x0f172a },
    { shape: 'circle', x: 0.284, y: -0.074, r: 0.009, fill: 0xffffff },
    { shape: 'circle', x: 0.275, y: 0.068, r: 0.026, fill: 0x0f172a },
    { shape: 'circle', x: 0.284, y: 0.062, r: 0.009, fill: 0xffffff },
    // Pink bunny nose tip
    {
      shape: 'ellipse',
      x: 0.355,
      y: 0,
      rx: 0.024,
      ry: 0.032,
      fill: 0xf472b6,
      stroke: 0x9d174d,
      strokeWidth: 0.012,
    },
  ];

  return {
    key: 'animal-rabbit',
    halfExtent: 0.46,
    referenceRadius: 0.36,
    primitives,
  };
}

function buildFoxSpriteSpec(): BakedSpriteSpec {
  const stroke = 0x7c2d12;
  const furMain = 0xea580c;
  const furBright = 0xfb923c;
  const furCream = 0xfef3c7;
  const darkCharcoal = 0x1e293b;

  const primitives: VectorPrimitive[] = [
    // Soft ground contact shadow
    { shape: 'ellipse', x: -0.04, y: 0.05, rx: 0.54, ry: 0.24, fill: 0x020617, alpha: 0.32 },
    // Long bushy tail (-X) with signature creamy-white tip
    {
      shape: 'ellipse',
      x: -0.44,
      y: 0,
      rx: 0.25,
      ry: 0.095,
      fill: furMain,
      stroke,
      strokeWidth: 0.022,
    },
    {
      shape: 'polygon',
      points: [
        [-0.53, -0.075],
        [-0.71, 0],
        [-0.53, 0.075],
        [-0.49, 0],
      ],
      fill: 0xf8fafc,
      stroke: 0x94a3b8,
      strokeWidth: 0.015,
    },
    // Four dark fox paws
    {
      shape: 'ellipse',
      x: -0.16,
      y: -0.18,
      rx: 0.085,
      ry: 0.045,
      angle: -0.2,
      fill: darkCharcoal,
      stroke: 0x0f172a,
      strokeWidth: 0.015,
    },
    {
      shape: 'ellipse',
      x: -0.16,
      y: 0.18,
      rx: 0.085,
      ry: 0.045,
      angle: 0.2,
      fill: darkCharcoal,
      stroke: 0x0f172a,
      strokeWidth: 0.015,
    },
    {
      shape: 'ellipse',
      x: 0.16,
      y: -0.165,
      rx: 0.08,
      ry: 0.042,
      angle: 0.2,
      fill: darkCharcoal,
      stroke: 0x0f172a,
      strokeWidth: 0.015,
    },
    {
      shape: 'ellipse',
      x: 0.16,
      y: 0.165,
      rx: 0.08,
      ry: 0.042,
      angle: -0.2,
      fill: darkCharcoal,
      stroke: 0x0f172a,
      strokeWidth: 0.015,
    },
    // Sleek elongated russet torso
    {
      shape: 'ellipse',
      x: -0.02,
      y: 0,
      rx: 0.33,
      ry: 0.175,
      fill: furMain,
      stroke,
      strokeWidth: 0.024,
    },
    // Warm amber back highlight
    { shape: 'ellipse', x: -0.04, y: 0, rx: 0.22, ry: 0.085, fill: furBright, alpha: 0.72 },
    // Creamy cheek ruffs framing the head
    {
      shape: 'ellipse',
      x: 0.29,
      y: -0.095,
      rx: 0.095,
      ry: 0.068,
      angle: -0.35,
      fill: furCream,
      stroke,
      strokeWidth: 0.016,
    },
    {
      shape: 'ellipse',
      x: 0.29,
      y: 0.095,
      rx: 0.095,
      ry: 0.068,
      angle: 0.35,
      fill: furCream,
      stroke,
      strokeWidth: 0.016,
    },
    // Sleek triangular fox head & pointed snout (+X)
    {
      shape: 'polygon',
      points: [
        [0.19, -0.135],
        [0.54, 0],
        [0.19, 0.135],
        [0.14, 0],
      ],
      fill: furBright,
      stroke,
      strokeWidth: 0.022,
    },
    // Pointed triangular ears with black tips
    {
      shape: 'polygon',
      points: [
        [0.24, -0.08],
        [0.13, -0.21],
        [0.31, -0.125],
      ],
      fill: furMain,
      stroke,
      strokeWidth: 0.018,
    },
    {
      shape: 'polygon',
      points: [
        [0.175, -0.155],
        [0.13, -0.21],
        [0.215, -0.165],
      ],
      fill: darkCharcoal,
    },
    {
      shape: 'polygon',
      points: [
        [0.24, 0.08],
        [0.13, 0.21],
        [0.31, 0.125],
      ],
      fill: furMain,
      stroke,
      strokeWidth: 0.018,
    },
    {
      shape: 'polygon',
      points: [
        [0.175, 0.155],
        [0.13, 0.21],
        [0.215, 0.165],
      ],
      fill: darkCharcoal,
    },
    // Sharp predator eyes (amber ring + dark pupil + glint)
    // Sharp dark predator eyes with white catchlights
    { shape: 'circle', x: 0.34, y: -0.058, r: 0.024, fill: 0x0f172a },
    { shape: 'circle', x: 0.348, y: -0.064, r: 0.008, fill: 0xffffff },
    { shape: 'circle', x: 0.34, y: 0.058, r: 0.024, fill: 0x0f172a },
    { shape: 'circle', x: 0.348, y: 0.052, r: 0.008, fill: 0xffffff },
    // Crisp black nose at tip of snout
    { shape: 'circle', x: 0.525, y: 0, r: 0.032, fill: 0x0f172a },
  ];

  return {
    key: 'animal-fox',
    halfExtent: 0.78,
    referenceRadius: 0.56,
    primitives,
  };
}

const animalSpriteCache = new Map<number, BakedSpriteSpec>();

/**
 * Resolves and caches the rich top-down {@link BakedSpriteSpec} for built-in animal render kinds
 * (`RENDER_KIND.RABBIT` and `RENDER_KIND.FOX`), or returns `null` for other kinds.
 */
export function getAnimalSpriteSpecForKind(kind: number): BakedSpriteSpec | null {
  const cached = animalSpriteCache.get(kind);
  if (cached !== undefined) return cached;
  let spec: BakedSpriteSpec | null = null;
  if (kind === RENDER_KIND.RABBIT) {
    spec = buildRabbitSpriteSpec();
  } else if (kind === RENDER_KIND.FOX) {
    spec = buildFoxSpriteSpec();
  }
  if (spec !== null) {
    animalSpriteCache.set(kind, spec);
  }
  return spec;
}
