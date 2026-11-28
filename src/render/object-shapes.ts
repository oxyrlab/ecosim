import type { BakedSpriteSpec, VectorPrimitive } from './plant-shapes';
import { RENDER_KIND } from './species-shapes';

function buildFruitSpriteSpec(): BakedSpriteSpec {
  const primitives: VectorPrimitive[] = [
    // Soft ground contact shadow
    { shape: 'circle', x: 0.08, y: 0.12, r: 0.78, fill: 0x020617, alpha: 0.3 },
    // Plump ruby berry body
    {
      shape: 'circle',
      x: 0,
      y: 0.06,
      r: 0.76,
      fill: 0xe11d48,
      stroke: 0x4c0519,
      strokeWidth: 0.08,
    },
    // Warm rosy inner sheen
    {
      shape: 'ellipse',
      x: -0.18,
      y: -0.1,
      rx: 0.32,
      ry: 0.22,
      angle: -0.5,
      fill: 0xfb7185,
      alpha: 0.75,
    },
    // Crisp specular glint
    { shape: 'circle', x: -0.26, y: -0.2, r: 0.13, fill: 0xffffff, alpha: 0.9 },
    // Two small calyx leaves at top
    {
      shape: 'ellipse',
      x: -0.24,
      y: -0.62,
      rx: 0.3,
      ry: 0.13,
      angle: -0.45,
      fill: 0x22c55e,
      stroke: 0x052e16,
      strokeWidth: 0.05,
    },
    {
      shape: 'ellipse',
      x: 0.24,
      y: -0.62,
      rx: 0.3,
      ry: 0.13,
      angle: 0.45,
      fill: 0x16a34a,
      stroke: 0x052e16,
      strokeWidth: 0.05,
    },
    // Tiny woody stem nib
    {
      shape: 'ellipse',
      x: 0,
      y: -0.78,
      rx: 0.08,
      ry: 0.18,
      fill: 0x78350f,
      stroke: 0x451a03,
      strokeWidth: 0.04,
    },
  ];

  return {
    key: 'object-fruit',
    halfExtent: 1.15,
    referenceRadius: 1,
    primitives,
  };
}

function buildCorpseSpriteSpec(): BakedSpriteSpec {
  const boneFill = 0xe7e5e4;
  const boneStroke = 0x57534e;

  const primitives: VectorPrimitive[] = [
    // Subtle dark soil enrichment ring underneath
    { shape: 'ellipse', x: 0.04, y: 0.06, rx: 0.96, ry: 0.76, fill: 0x1c1917, alpha: 0.42 },
    // Decomposing organic mound
    {
      shape: 'ellipse',
      x: 0,
      y: 0,
      rx: 0.82,
      ry: 0.62,
      angle: 0.2,
      fill: 0x78716c,
      stroke: 0x44403c,
      strokeWidth: 0.07,
    },
    // Inner darker soil patch
    {
      shape: 'ellipse',
      x: 0.04,
      y: 0.04,
      rx: 0.54,
      ry: 0.4,
      angle: -0.15,
      fill: 0x57534e,
      alpha: 0.75,
    },
    // Classic clean bone silhouette (crossed subtle secondary bone + main bone)
    {
      shape: 'ellipse',
      x: 0,
      y: 0,
      rx: 0.56,
      ry: 0.13,
      angle: -0.45,
      fill: boneFill,
      stroke: boneStroke,
      strokeWidth: 0.055,
    },
    {
      shape: 'circle',
      x: -0.44,
      y: 0.14,
      r: 0.16,
      fill: boneFill,
      stroke: boneStroke,
      strokeWidth: 0.05,
    },
    {
      shape: 'circle',
      x: -0.32,
      y: 0.28,
      r: 0.16,
      fill: boneFill,
      stroke: boneStroke,
      strokeWidth: 0.05,
    },
    {
      shape: 'circle',
      x: 0.44,
      y: -0.14,
      r: 0.16,
      fill: boneFill,
      stroke: boneStroke,
      strokeWidth: 0.05,
    },
    {
      shape: 'circle',
      x: 0.32,
      y: -0.28,
      r: 0.16,
      fill: boneFill,
      stroke: boneStroke,
      strokeWidth: 0.05,
    },
    // Smooth shaft center over joint strokes
    { shape: 'ellipse', x: 0, y: 0, rx: 0.44, ry: 0.1, angle: -0.45, fill: 0xf5f5f4 },
  ];

  return {
    key: 'object-corpse',
    halfExtent: 1.15,
    referenceRadius: 1,
    primitives,
  };
}

function buildRockSpriteSpec(): BakedSpriteSpec {
  const primitives: VectorPrimitive[] = [
    // Soft contact shadow
    { shape: 'ellipse', x: 0.09, y: 0.12, rx: 0.94, ry: 0.78, fill: 0x020617, alpha: 0.34 },
    // Faceted stone silhouette
    {
      shape: 'polygon',
      points: [
        [-0.86, -0.22],
        [-0.48, -0.78],
        [0.26, -0.82],
        [0.86, -0.36],
        [0.88, 0.34],
        [0.36, 0.8],
        [-0.46, 0.76],
        [-0.88, 0.32],
      ],
      fill: 0x64748b,
      stroke: 0x1e293b,
      strokeWidth: 0.08,
    },
    // Sunlit top-left stone bevel facet
    {
      shape: 'polygon',
      points: [
        [-0.7, -0.18],
        [-0.42, -0.64],
        [0.2, -0.68],
        [0.54, -0.28],
        [0.08, 0.12],
        [-0.48, 0.16],
      ],
      fill: 0x94a3b8,
      alpha: 0.78,
    },
    // Crisp highlight ridge
    {
      shape: 'polygon',
      points: [
        [-0.48, -0.26],
        [-0.3, -0.52],
        [0.12, -0.54],
        [0.18, -0.22],
      ],
      fill: 0xcbd5e1,
      alpha: 0.55,
    },
  ];

  return {
    key: 'object-rock',
    halfExtent: 1.15,
    referenceRadius: 1,
    primitives,
  };
}

const objectSpecCache = new Map<number, BakedSpriteSpec>();

/**
 * Resolves and caches top-down {@link BakedSpriteSpec}s for biological and physical world objects:
 * dropped `fruit` (`RENDER_KIND.FRUIT`), decomposing `corpse` (`RENDER_KIND.CORPSE`), and
 * stone/generic body obstacles (`RENDER_KIND.BODY`).
 */
export function getObjectSpriteSpecForKind(kind: number): BakedSpriteSpec | null {
  const cached = objectSpecCache.get(kind);
  if (cached !== undefined) return cached;

  let spec: BakedSpriteSpec | null = null;
  if (kind === RENDER_KIND.FRUIT) {
    spec = buildFruitSpriteSpec();
  } else if (kind === RENDER_KIND.CORPSE) {
    spec = buildCorpseSpriteSpec();
  } else if (kind === RENDER_KIND.BODY) {
    spec = buildRockSpriteSpec();
  }

  if (spec !== null) {
    objectSpecCache.set(kind, spec);
  }
  return spec;
}
