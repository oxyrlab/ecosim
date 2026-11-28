import { z } from 'zod';
import type { ReproductiveOrganId } from '@body/organs';
import { createEntityId, createSeededRng, InvalidParameterError } from '@core/index';
import { mutationSpecSchema, ReproductionComponent, reproductionSpecSchema } from '@genome/index';
import { computeWorldEnergy, type EnergyLedger } from '@life/index';
import type { PlantStage } from '@plants/components';
import { spawnSpeciesEntity, speciesRegistry } from '@species/index';
import type { World, WorldConfig } from '@world/index';
import type { RecordedCommand, SimCommand } from './commands';

const vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const plantStageSchema = z.enum([
  'seed',
  'sprout',
  'mature',
  'flowering',
  'fruiting',
  'senescence',
]);

const reproductiveOrganSchema = z.enum(['reproductive-male', 'reproductive-female']);

const fieldBrushModeSchema = z.enum(['set', 'add']);

const simCommandSchema: z.ZodType<SimCommand> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('spawn-body'),
    position: vec2Schema,
    radius: z.number().finite().positive(),
    color: z.number().int().nonnegative().optional(),
    kind: z.number().int().optional(),
    linearVelocity: vec2Schema.optional(),
    tags: z.array(z.string()).readonly().optional(),
  }),
  z.object({
    type: z.literal('spawn-species'),
    speciesId: z.string().min(1),
    position: vec2Schema,
    angle: z.number().finite().optional(),
    plantStage: plantStageSchema.optional(),
    reproductiveOrgan: reproductiveOrganSchema.optional(),
    initialEnergy: z.number().finite().positive().optional(),
    initialAgeSeconds: z.number().finite().nonnegative().optional(),
    maxAgeSeconds: z.number().finite().positive().optional(),
  }),
  z.object({
    type: z.literal('remove-entity'),
    entityId: z
      .number()
      .int()
      .positive()
      .transform((id) => createEntityId(id)),
  }),
  z.object({
    type: z.literal('paint-field'),
    fieldName: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    radiusMeters: z.number().finite().positive(),
    value: z.number().finite(),
    mode: fieldBrushModeSchema.optional(),
  }),
  z.object({
    type: z.literal('apply-impulse'),
    entityId: z
      .number()
      .int()
      .positive()
      .transform((id) => createEntityId(id)),
    impulse: vec2Schema,
  }),
  z.object({
    type: z.literal('clear-world'),
  }),
]) as z.ZodType<SimCommand>;

const recordedCommandSchema: z.ZodType<RecordedCommand> = z.object({
  tick: z.number().int().nonnegative(),
  command: simCommandSchema,
});

/**
 * Initial field paint entry in a {@link ScenarioConfig}.
 */
export interface ScenarioFieldPaint {
  readonly fieldName: string;
  readonly x: number;
  readonly y: number;
  readonly radiusMeters: number;
  readonly value: number;
  readonly mode?: 'set' | 'add' | undefined;
}

/**
 * Initial species spawn entry in a {@link ScenarioConfig}.
 */
export interface ScenarioSpeciesSpawn {
  readonly speciesId: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly angle?: number | undefined;
  readonly plantStage?: PlantStage | undefined;
  readonly reproductiveOrgan?: ReproductiveOrganId | undefined;
  readonly initialEnergy?: number | undefined;
  readonly initialAgeSeconds?: number | undefined;
  readonly maxAgeSeconds?: number | undefined;
}

/**
 * Serializable, replayable EcoSim scenario definition (ADR 0009).
 */
export interface ScenarioConfig {
  readonly version: 1;
  readonly name: string;
  readonly description: string;
  readonly world: WorldConfig;
  readonly enableReproduction: boolean;
  readonly initialFields: readonly ScenarioFieldPaint[];
  readonly initialSpawns: readonly ScenarioSpeciesSpawn[];
  readonly commands: readonly RecordedCommand[];
}

/**
 * Zod schema validating a {@link ScenarioConfig}.
 */
export const scenarioConfigSchema = z.object({
  version: z.literal(1).default(1),
  name: z.string().min(1),
  description: z.string().default(''),
  world: z.object({
    seed: z.number().int(),
    widthMeters: z.number().finite().positive(),
    heightMeters: z.number().finite().positive(),
    gridCols: z.number().int().positive(),
    gridRows: z.number().int().positive(),
  }),
  enableReproduction: z.boolean().default(true),
  initialFields: z
    .array(
      z.object({
        fieldName: z.string().min(1),
        x: z.number().finite(),
        y: z.number().finite(),
        radiusMeters: z.number().finite().positive(),
        value: z.number().finite(),
        mode: fieldBrushModeSchema.optional(),
      }),
    )
    .default([]),
  initialSpawns: z
    .array(
      z.object({
        speciesId: z.string().min(1),
        position: vec2Schema,
        angle: z.number().finite().optional(),
        plantStage: plantStageSchema.optional(),
        reproductiveOrgan: reproductiveOrganSchema.optional(),
        initialEnergy: z.number().finite().positive().optional(),
        initialAgeSeconds: z.number().finite().nonnegative().optional(),
        maxAgeSeconds: z.number().finite().positive().optional(),
      }),
    )
    .default([]),
  commands: z.array(recordedCommandSchema).default([]),
});

/**
 * Parses and validates an unknown value as a {@link ScenarioConfig}.
 */
export function parseScenarioConfig(input: unknown): ScenarioConfig {
  return scenarioConfigSchema.parse(input);
}

/**
 * Parses a JSON string into a validated {@link ScenarioConfig}.
 */
export function parseScenarioJson(json: string): ScenarioConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch (err) {
    throw new InvalidParameterError(
      'json',
      err instanceof Error ? err.message : String(err),
      'valid ScenarioConfig JSON',
      'parseScenarioJson',
    );
  }
  return parseScenarioConfig(raw);
}

/**
 * Serializes a {@link ScenarioConfig} to formatted JSON suitable for saving or sharing.
 */
export function serializeScenario(scenario: ScenarioConfig): string {
  return JSON.stringify(scenario, null, 2);
}

/**
 * Builds the default balanced 40x40 m meadow scenario containing `grass`, `berry-bush`, `rabbit`,
 * and `fox` placed deterministically from `seed`.
 */
export function createDefaultMeadowScenario(seed = 42): ScenarioConfig {
  const rng = createSeededRng(seed);
  const width = 40;
  const height = 40;
  const margin = 3;

  const initialFields: ScenarioFieldPaint[] = [
    { fieldName: 'soil.nutrients', x: 20, y: 20, radiusMeters: 22, value: 8, mode: 'set' },
    { fieldName: 'soil.moisture', x: 20, y: 20, radiusMeters: 24, value: 0.7, mode: 'set' },
  ];

  const initialSpawns: ScenarioSpeciesSpawn[] = [];
  const randomPos = () => ({
    x: Number(rng.nextRange(margin, width - margin).toFixed(3)),
    y: Number(rng.nextRange(margin, height - margin).toFixed(3)),
  });

  const grassStages: readonly PlantStage[] = [
    'mature',
    'mature',
    'flowering',
    'sprout',
    'fruiting',
  ];
  for (let i = 0; i < 18; i += 1) {
    initialSpawns.push({
      speciesId: 'grass',
      position: randomPos(),
      plantStage: grassStages[i % grassStages.length],
    });
  }
  const bushStages: readonly PlantStage[] = [
    'fruiting',
    'flowering',
    'mature',
    'fruiting',
    'flowering',
    'sprout',
  ];
  for (let i = 0; i < 6; i += 1) {
    initialSpawns.push({
      speciesId: 'berry-bush',
      position: randomPos(),
      plantStage: bushStages[i % bushStages.length],
    });
  }
  for (let i = 0; i < 7; i += 1) {
    initialSpawns.push({
      speciesId: 'rabbit',
      position: randomPos(),
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
      reproductiveOrgan: i < 4 ? 'reproductive-female' : 'reproductive-male',
    });
  }
  for (let i = 0; i < 2; i += 1) {
    initialSpawns.push({
      speciesId: 'fox',
      position: randomPos(),
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
      reproductiveOrgan: i === 0 ? 'reproductive-female' : 'reproductive-male',
    });
  }

  return {
    version: 1,
    name: 'default-meadow',
    description: 'Balanced 40x40m meadow with grass, berry bushes, rabbits, and foxes.',
    world: {
      seed,
      widthMeters: width,
      heightMeters: height,
      gridCols: 40,
      gridRows: 40,
    },
    enableReproduction: true,
    initialFields,
    initialSpawns,
    commands: [],
  };
}

/**
 * Builds a minimal empty sandbox scenario ready for interactive painting and spawning.
 */
export function createEmptySandboxScenario(seed = 42): ScenarioConfig {
  return {
    version: 1,
    name: 'empty-sandbox',
    description: 'Blank 40x40m sandbox arena with fertile soil for custom experiments.',
    world: {
      seed,
      widthMeters: 40,
      heightMeters: 40,
      gridCols: 40,
      gridRows: 40,
    },
    enableReproduction: true,
    initialFields: [
      { fieldName: 'soil.nutrients', x: 20, y: 20, radiusMeters: 24, value: 6, mode: 'set' },
      { fieldName: 'soil.moisture', x: 20, y: 20, radiusMeters: 24, value: 0.65, mode: 'set' },
    ],
    initialSpawns: [],
    commands: [],
  };
}

/**
 * Builds the first ecological validation benchmark scenario: 5 rabbits (3 female, 2 male) placed
 * in a barren 40x40 m arena with zero plants so starvation survival curves and locomotion
 * kinematics can be verified against real Oryctolagus cuniculus fasting data (7–12 days).
 */
export function createRabbitStarvationScenario(seed = 42): ScenarioConfig {
  const rng = createSeededRng(seed);
  const width = 40;
  const height = 40;
  const organs: readonly ReproductiveOrganId[] = [
    'reproductive-female',
    'reproductive-female',
    'reproductive-female',
    'reproductive-male',
    'reproductive-male',
  ];
  const initialSpawns: ScenarioSpeciesSpawn[] = organs.map((organ, idx) => {
    const theta = (idx / organs.length) * Math.PI * 2 + rng.nextRange(-0.25, 0.25);
    const radius = rng.nextRange(6, 12);
    return {
      speciesId: 'rabbit',
      position: {
        x: Number((width * 0.5 + Math.cos(theta) * radius).toFixed(3)),
        y: Number((height * 0.5 + Math.sin(theta) * radius).toFixed(3)),
      },
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
      reproductiveOrgan: organ,
    };
  });

  return {
    version: 1,
    name: 'rabbit-starvation-5',
    description:
      'Ecological starvation benchmark: 5 rabbits (3 female, 2 male) in a 40x40m arena with zero plants.',
    world: {
      seed,
      widthMeters: width,
      heightMeters: height,
      gridCols: 40,
      gridRows: 40,
    },
    enableReproduction: true,
    initialFields: [
      { fieldName: 'soil.nutrients', x: 20, y: 20, radiusMeters: 24, value: 4, mode: 'set' },
      { fieldName: 'soil.moisture', x: 20, y: 20, radiusMeters: 24, value: 0.5, mode: 'set' },
    ],
    initialSpawns,
    commands: [],
  };
}

/**
 * Builds the foraging control benchmark: 5 rabbits (3 female, 2 male) in a fertile grass meadow
 * with no predators, verifying that rabbits forage effectively and sustain energy over time.
 */
export function createRabbitForagingScenario(seed = 42): ScenarioConfig {
  const rng = createSeededRng(seed);
  const width = 40;
  const height = 40;
  const margin = 3;
  const randomPos = () => ({
    x: Number(rng.nextRange(margin, width - margin).toFixed(3)),
    y: Number(rng.nextRange(margin, height - margin).toFixed(3)),
  });

  const initialSpawns: ScenarioSpeciesSpawn[] = [];
  const grassStages: readonly PlantStage[] = ['mature', 'mature', 'flowering', 'fruiting'];
  for (let i = 0; i < 30; i += 1) {
    initialSpawns.push({
      speciesId: 'grass',
      position: randomPos(),
      plantStage: grassStages[i % grassStages.length],
    });
  }
  const organs: readonly ReproductiveOrganId[] = [
    'reproductive-female',
    'reproductive-female',
    'reproductive-female',
    'reproductive-male',
    'reproductive-male',
  ];
  for (const organ of organs) {
    initialSpawns.push({
      speciesId: 'rabbit',
      position: randomPos(),
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
      reproductiveOrgan: organ,
    });
  }

  return {
    version: 1,
    name: 'rabbit-foraging-5',
    description:
      'Foraging control benchmark: 5 rabbits (3 female, 2 male) with 30 grass patches and no predators.',
    world: {
      seed,
      widthMeters: width,
      heightMeters: height,
      gridCols: 40,
      gridRows: 40,
    },
    enableReproduction: true,
    initialFields: [
      { fieldName: 'soil.nutrients', x: 20, y: 20, radiusMeters: 24, value: 8, mode: 'set' },
      { fieldName: 'soil.moisture', x: 20, y: 20, radiusMeters: 24, value: 0.72, mode: 'set' },
    ],
    initialSpawns,
    commands: [],
  };
}

/**
 * Builds a compact observation scenario for watching sexual reproduction (organ contact) and
 * newborn juvenile-to-adult growth without altering brain modules: 5 well-fed rabbits (3 female,
 * 2 male) in a lush 16x16 m grass enclosure where pairs naturally cross paths and raise young.
 */
export function createRabbitReproductionScenario(seed = 42): ScenarioConfig {
  const rng = createSeededRng(seed);
  const width = 10;
  const height = 10;
  const margin = 1.2;
  const randomPos = () => ({
    x: Number(rng.nextRange(margin, width - margin).toFixed(3)),
    y: Number(rng.nextRange(margin, height - margin).toFixed(3)),
  });

  const initialSpawns: ScenarioSpeciesSpawn[] = [];
  const grassStages: readonly PlantStage[] = ['mature', 'mature', 'flowering', 'fruiting'];
  // Abundant grass around a cozy 10x10m glade so both parents and newborns stay well-fed.
  const centralGrass: ReadonlyArray<{ readonly x: number; readonly y: number }> = [
    { x: 3.5, y: 3.5 },
    { x: 6.5, y: 3.5 },
    { x: 3.5, y: 6.5 },
    { x: 6.5, y: 6.5 },
    { x: 5.0, y: 2.8 },
    { x: 5.0, y: 7.2 },
    { x: 2.8, y: 5.0 },
    { x: 7.2, y: 5.0 },
  ];
  for (let i = 0; i < centralGrass.length; i += 1) {
    initialSpawns.push({
      speciesId: 'grass',
      position: centralGrass[i] as { readonly x: number; readonly y: number },
      plantStage: grassStages[i % grassStages.length],
    });
  }
  for (let i = 0; i < 8; i += 1) {
    initialSpawns.push({
      speciesId: 'grass',
      position: randomPos(),
      plantStage: grassStages[i % grassStages.length],
    });
  }

  // 3 female + 2 male well-fed adult rabbits in the compact glade
  const rabbitPlacements: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly angle: number;
    readonly organ: ReproductiveOrganId;
  }> = [
    { x: 4.5, y: 4.6, angle: 0.2, organ: 'reproductive-female' },
    { x: 5.3, y: 4.7, angle: Math.PI - 0.15, organ: 'reproductive-male' },
    { x: 4.6, y: 5.4, angle: -0.25, organ: 'reproductive-female' },
    { x: 5.4, y: 5.3, angle: Math.PI + 0.2, organ: 'reproductive-male' },
    { x: 5.0, y: 4.1, angle: Math.PI * 0.5, organ: 'reproductive-female' },
  ];
  for (const r of rabbitPlacements) {
    initialSpawns.push({
      speciesId: 'rabbit',
      position: {
        x: Number((r.x + rng.nextRange(-0.18, 0.18)).toFixed(3)),
        y: Number((r.y + rng.nextRange(-0.18, 0.18)).toFixed(3)),
      },
      angle: Number((r.angle + rng.nextRange(-0.2, 0.2)).toFixed(4)),
      reproductiveOrgan: r.organ,
      initialEnergy: Number(rng.nextRange(88, 97).toFixed(2)),
    });
  }

  return {
    version: 1,
    name: 'rabbit-reproduction-5',
    description:
      'Observation scenario: 5 well-fed rabbits (3 female, 2 male) in a compact 10x10m grass glade to observe sexual reproduction and newborn growth.',
    world: {
      seed,
      widthMeters: width,
      heightMeters: height,
      gridCols: 20,
      gridRows: 20,
    },
    enableReproduction: true,
    initialFields: [
      { fieldName: 'soil.nutrients', x: 5, y: 5, radiusMeters: 8, value: 9, mode: 'set' },
      { fieldName: 'soil.moisture', x: 5, y: 5, radiusMeters: 8, value: 0.75, mode: 'set' },
    ],
    initialSpawns,
    commands: [],
  };
}

/**
 * Resolves a built-in scenario preset by name or alias.
 */
export function getBuiltinScenario(name: string, seed = 42): ScenarioConfig {
  switch (name) {
    case 'default':
    case 'meadow':
    case 'default-meadow':
      return createDefaultMeadowScenario(seed);
    case 'rabbit-starvation':
    case 'rabbit-starvation-5':
    case 'starvation':
      return createRabbitStarvationScenario(seed);
    case 'rabbit-foraging':
    case 'rabbit-foraging-5':
    case 'foraging':
      return createRabbitForagingScenario(seed);
    case 'rabbit-reproduction':
    case 'rabbit-reproduction-5':
    case 'reproduction':
      return createRabbitReproductionScenario(seed);
    case 'empty':
    case 'sandbox':
    case 'empty-sandbox':
      return createEmptySandboxScenario(seed);
    default:
      throw new InvalidParameterError(
        'scenarioName',
        name,
        "one of ['default-meadow', 'rabbit-starvation-5', 'rabbit-foraging-5', 'rabbit-reproduction-5', 'empty-sandbox']",
        'getBuiltinScenario',
      );
  }
}

/**
 * Applies a {@link ScenarioConfig}'s initial fields and species spawns to `world` and seeds
 * `ledger` with the resulting initial world energy.
 */
export function applyScenarioToWorld(
  world: World,
  scenario: ScenarioConfig,
  ledger?: EnergyLedger,
): void {
  for (const paint of scenario.initialFields) {
    if (world.fields.has(paint.fieldName)) {
      world.fields.paintField(
        paint.fieldName,
        paint.x,
        paint.y,
        paint.radiusMeters,
        paint.value,
        paint.mode ?? 'set',
      );
    }
  }

  for (const spawn of scenario.initialSpawns) {
    const blueprint = speciesRegistry.get(spawn.speciesId);
    const entity = spawnSpeciesEntity(world, blueprint, spawn.position, {
      ...(spawn.angle !== undefined ? { angle: spawn.angle } : {}),
      ...(spawn.plantStage !== undefined ? { plantOptions: { stage: spawn.plantStage } } : {}),
      ...(spawn.reproductiveOrgan !== undefined
        ? { reproductiveOrgan: spawn.reproductiveOrgan }
        : {}),
      ...(spawn.initialEnergy !== undefined ? { initialEnergy: spawn.initialEnergy } : {}),
      ...(spawn.initialAgeSeconds !== undefined
        ? { initialAgeSeconds: spawn.initialAgeSeconds }
        : {}),
      ...(spawn.maxAgeSeconds !== undefined ? { maxAgeSeconds: spawn.maxAgeSeconds } : {}),
    });

    if (scenario.enableReproduction && blueprint.kingdom === 'animal') {
      const spec = reproductionSpecSchema.parse({
        mode: 'sexual',
        minEnergyToReproduce: Math.max(76, blueprint.metabolism.maxEnergy * 0.76),
        mateRadiusMeters: 1.2,
        requireOrganContact: true,
      });
      world.ecs.addComponent(entity, ReproductionComponent, {
        speciesId: blueprint.id,
        blueprint,
        spec,
        mutation: mutationSpecSchema.parse({}),
        cooldownRemainingSeconds: spec.cooldownSeconds * 0.5,
        generation: 0,
        offspringCount: 0,
      });
    }
  }

  if (ledger !== undefined) {
    ledger.reset();
    ledger.recordInitialSpawn(computeWorldEnergy(world));
  }
}
