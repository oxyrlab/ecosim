/**
 * Pure, engine-independent 2D vector drawing primitive used to bake crisp top-down textures
 * for animals and multi-stage plants. Zero DOM or PixiJS dependencies.
 */
export type VectorPrimitive =
  | {
      readonly shape: 'circle';
      readonly x: number;
      readonly y: number;
      readonly r: number;
      readonly fill: number;
      readonly alpha?: number;
      readonly stroke?: number;
      readonly strokeWidth?: number;
    }
  | {
      readonly shape: 'ellipse';
      readonly x: number;
      readonly y: number;
      readonly rx: number;
      readonly ry: number;
      readonly angle?: number;
      readonly fill: number;
      readonly alpha?: number;
      readonly stroke?: number;
      readonly strokeWidth?: number;
    }
  | {
      readonly shape: 'polygon';
      readonly points: readonly (readonly [number, number])[];
      readonly fill: number;
      readonly alpha?: number;
      readonly stroke?: number;
      readonly strokeWidth?: number;
    };

/**
 * Baked top-down visual sprite specification in either SI meters (animals) or normalized
 * unit-radius space (plants).
 */
export interface BakedSpriteSpec {
  /** Cache key uniquely identifying this visual variant. */
  readonly key: string;
  /** Half-extent of the centered square texture frame in the same units as `primitives`. */
  readonly halfExtent: number;
  /** Reference world radius (meters) corresponding to scale `1.0` (`1` for unit-radius plants). */
  readonly referenceRadius: number;
  /** Ordered back-to-front vector primitives. */
  readonly primitives: readonly VectorPrimitive[];
}

function makeGrassBlade(
  angleRad: number,
  length: number,
  halfWidth: number,
  fill: number,
  stroke: number,
): VectorPrimitive {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const px = -sin * halfWidth;
  const py = cos * halfWidth;
  const midL = length * 0.48;
  return {
    shape: 'polygon',
    points: [
      [0, 0],
      [cos * midL + px, sin * midL + py],
      [cos * length, sin * length],
      [cos * midL - px, sin * midL - py],
    ],
    fill,
    stroke,
    strokeWidth: 0.045,
  };
}

function makeBlossom(cx: number, cy: number, petalR: number): VectorPrimitive[] {
  const out: VectorPrimitive[] = [];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    out.push({
      shape: 'circle',
      x: cx + Math.cos(a) * petalR * 0.85,
      y: cy + Math.sin(a) * petalR * 0.85,
      r: petalR * 0.72,
      fill: i % 2 === 0 ? 0xfbcfe8 : 0xf9a8d4,
      stroke: 0x9d174d,
      strokeWidth: 0.025,
    });
  }
  out.push({
    shape: 'circle',
    x: cx,
    y: cy,
    r: petalR * 0.52,
    fill: 0xfde047,
  });
  return out;
}

function makeBerry(cx: number, cy: number, r: number): VectorPrimitive[] {
  return [
    {
      shape: 'circle',
      x: cx,
      y: cy,
      r,
      fill: 0xe11d48,
      stroke: 0x4c0519,
      strokeWidth: 0.035,
    },
    {
      shape: 'circle',
      x: cx - r * 0.3,
      y: cy - r * 0.3,
      r: r * 0.32,
      fill: 0xfda4af,
    },
  ];
}

function buildGrassSpec(stageIndex: number): BakedSpriteSpec {
  const primitives: VectorPrimitive[] = [];
  const shadow: VectorPrimitive = {
    shape: 'circle',
    x: 0.06,
    y: 0.08,
    r: 0.82,
    fill: 0x020617,
    alpha: 0.28,
  };

  if (stageIndex === 0) {
    // Seed: warm golden-brown grain
    primitives.push(
      { shape: 'ellipse', x: 0.05, y: 0.08, rx: 0.85, ry: 0.56, fill: 0x020617, alpha: 0.25 },
      {
        shape: 'ellipse',
        x: 0,
        y: 0,
        rx: 0.85,
        ry: 0.52,
        angle: -0.35,
        fill: 0xb45309,
        stroke: 0x451a03,
        strokeWidth: 0.09,
      },
      {
        shape: 'ellipse',
        x: -0.12,
        y: -0.12,
        rx: 0.42,
        ry: 0.16,
        angle: -0.35,
        fill: 0xfde68a,
        alpha: 0.65,
      },
    );
  } else if (stageIndex === 1) {
    // Sprout: tiny root dot + 3 fresh bright lime blades
    primitives.push(
      { shape: 'circle', x: 0.04, y: 0.06, r: 0.55, fill: 0x020617, alpha: 0.22 },
      makeGrassBlade(-2.35, 0.92, 0.22, 0x65a30d, 0x14532d),
      makeGrassBlade(-0.75, 0.98, 0.24, 0x84cc16, 0x14532d),
      makeGrassBlade(1.45, 0.86, 0.21, 0xa3e635, 0x14532d),
      { shape: 'circle', x: 0, y: 0, r: 0.18, fill: 0x3f6212 },
    );
  } else if (stageIndex === 5) {
    // Senescence: sparse golden-ochre dried grass tuft
    primitives.push(shadow);
    const angles = [-2.7, -1.9, -1.0, -0.2, 0.7, 1.6, 2.5];
    angles.forEach((a, i) => {
      primitives.push(
        makeGrassBlade(a, 0.76 + (i % 3) * 0.11, 0.14, i % 2 === 0 ? 0xca8a04 : 0xa16207, 0x422006),
      );
    });
    primitives.push({ shape: 'circle', x: 0, y: 0, r: 0.2, fill: 0x713f12 });
  } else {
    // Mature (2), Flowering (3), Fruiting (4): lush radial tuft of curved grass blades
    primitives.push(shadow);
    const outerCount = 8;
    for (let i = 0; i < outerCount; i += 1) {
      const a = (i / outerCount) * Math.PI * 2 + 0.18;
      const len = i % 2 === 0 ? 1.05 : 0.9;
      primitives.push(makeGrassBlade(a, len, 0.21, i % 2 === 0 ? 0x16a34a : 0x22c55e, 0x052e16));
    }
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.55;
      primitives.push(makeGrassBlade(a, 0.72, 0.17, 0x4ade80, 0x14532d));
    }
    primitives.push({ shape: 'circle', x: 0, y: 0, r: 0.22, fill: 0x15803d });

    if (stageIndex === 3) {
      // Flowering: cream-yellow pollen tips
      const tips: readonly (readonly [number, number])[] = [
        [0.48, -0.45],
        [-0.52, -0.32],
        [0.12, 0.58],
        [-0.35, 0.42],
      ];
      for (const [tx, ty] of tips) {
        primitives.push({
          shape: 'circle',
          x: tx,
          y: ty,
          r: 0.15,
          fill: 0xfef08a,
          stroke: 0x854d0e,
          strokeWidth: 0.035,
        });
      }
    } else if (stageIndex === 4) {
      // Fruiting: golden seed heads
      const seeds: readonly (readonly [number, number])[] = [
        [0.54, -0.34],
        [-0.48, -0.44],
        [0.36, 0.48],
        [-0.45, 0.36],
      ];
      for (const [sx, sy] of seeds) {
        primitives.push({
          shape: 'ellipse',
          x: sx,
          y: sy,
          rx: 0.17,
          ry: 0.11,
          angle: Math.atan2(sy, sx),
          fill: 0xfacc15,
          stroke: 0x713f12,
          strokeWidth: 0.04,
        });
      }
    }
  }

  return {
    key: `grass-stage-${stageIndex}`,
    halfExtent: 1.25,
    referenceRadius: 1,
    primitives,
  };
}

function buildBushSpec(stageIndex: number): BakedSpriteSpec {
  const primitives: VectorPrimitive[] = [];

  if (stageIndex === 0) {
    // Woody pip seed
    primitives.push(
      { shape: 'circle', x: 0.06, y: 0.08, r: 0.78, fill: 0x020617, alpha: 0.25 },
      {
        shape: 'ellipse',
        x: 0,
        y: 0,
        rx: 0.8,
        ry: 0.64,
        angle: 0.3,
        fill: 0x78350f,
        stroke: 0x451a03,
        strokeWidth: 0.09,
      },
      { shape: 'circle', x: -0.2, y: -0.18, r: 0.22, fill: 0xd97706, alpha: 0.65 },
    );
  } else if (stageIndex === 1) {
    // Sprout: 4 rounded young shrub leaves around woody stem
    primitives.push({ shape: 'circle', x: 0.06, y: 0.08, r: 0.78, fill: 0x020617, alpha: 0.22 });
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      primitives.push({
        shape: 'ellipse',
        x: Math.cos(a) * 0.45,
        y: Math.sin(a) * 0.45,
        rx: 0.44,
        ry: 0.28,
        angle: a,
        fill: i % 2 === 0 ? 0x22c55e : 0x4ade80,
        stroke: 0x052e16,
        strokeWidth: 0.055,
      });
    }
    primitives.push({ shape: 'circle', x: 0, y: 0, r: 0.18, fill: 0x78350f });
  } else {
    // Mature (2), Flowering (3), Fruiting (4), Senescence (5)
    const isSenescent = stageIndex === 5;
    const outerFill = isSenescent ? 0x78716c : 0x14532d;
    const midFill = isSenescent ? 0xa16207 : 0x15803d;
    const topFill = isSenescent ? 0xca8a04 : 0x22c55e;
    const strokeCol = isSenescent ? 0x451a03 : 0x052e16;

    // Ground shadow
    primitives.push({ shape: 'circle', x: 0.08, y: 0.1, r: 1.0, fill: 0x020617, alpha: 0.32 });

    // Outer scalloped foliage lobes (7 lobes)
    const lobeCount = 7;
    for (let i = 0; i < lobeCount; i += 1) {
      const a = (i / lobeCount) * Math.PI * 2;
      primitives.push({
        shape: 'circle',
        x: Math.cos(a) * 0.56,
        y: Math.sin(a) * 0.56,
        r: 0.46,
        fill: outerFill,
        stroke: strokeCol,
        strokeWidth: 0.05,
      });
    }

    // Main bushy canopy fill
    primitives.push({ shape: 'circle', x: 0, y: 0, r: 0.72, fill: midFill });

    // Lighter inner leaf clusters for 3D crown volume
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      primitives.push({
        shape: 'circle',
        x: Math.cos(a) * 0.34 - 0.05,
        y: Math.sin(a) * 0.34 - 0.05,
        r: 0.32,
        fill: topFill,
        alpha: isSenescent ? 0.78 : 0.9,
      });
    }

    if (isSenescent) {
      // Exposed central woody twigs
      primitives.push(
        { shape: 'ellipse', x: 0, y: 0, rx: 0.48, ry: 0.06, angle: 0.4, fill: 0x451a03 },
        { shape: 'ellipse', x: 0, y: 0, rx: 0.44, ry: 0.06, angle: -1.1, fill: 0x451a03 },
      );
    } else if (stageIndex === 3) {
      // Flowering: 5 bright pink-white 5-petal blossoms
      const spots: readonly (readonly [number, number])[] = [
        [0.44, -0.34],
        [-0.46, -0.26],
        [0.12, 0.48],
        [-0.36, 0.38],
        [0.02, -0.06],
      ];
      for (const [bx, by] of spots) {
        primitives.push(...makeBlossom(bx, by, 0.14));
      }
    } else if (stageIndex === 4) {
      // Fruiting: 7 glossy crimson berries
      const berries: readonly (readonly [number, number])[] = [
        [0.48, -0.28],
        [0.34, -0.44],
        [-0.48, -0.22],
        [-0.3, -0.42],
        [0.24, 0.44],
        [-0.36, 0.38],
        [0.0, 0.04],
      ];
      for (const [bx, by] of berries) {
        primitives.push(...makeBerry(bx, by, 0.135));
      }
    }
  }

  return {
    key: `berry-bush-stage-${stageIndex}`,
    halfExtent: 1.25,
    referenceRadius: 1,
    primitives,
  };
}

const plantSpecCache = new Map<number, BakedSpriteSpec>();

/**
 * Resolves and caches the top-down {@link BakedSpriteSpec} for any stage-encoded plant render
 * kind (`20..25` for `grass`, `30..35` for `berry-bush`, plus fallback `2` / `4`).
 */
export function getPlantSpriteSpecForKind(kind: number): BakedSpriteSpec | null {
  const cached = plantSpecCache.get(kind);
  if (cached !== undefined) return cached;

  let spec: BakedSpriteSpec | null = null;
  if (kind === 2) {
    spec = buildGrassSpec(2);
  } else if (kind === 4) {
    spec = buildBushSpec(2);
  } else if (kind >= 20 && kind <= 25) {
    spec = buildGrassSpec(kind - 20);
  } else if (kind >= 30 && kind <= 35) {
    spec = buildBushSpec(kind - 30);
  }

  if (spec !== null) {
    plantSpecCache.set(kind, spec);
  }
  return spec;
}
