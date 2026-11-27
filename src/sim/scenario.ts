import { z } from 'zod';
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

  for (let i = 0; i < 18; i += 1) {
    initialSpawns.push({
      speciesId: 'grass',
      position: randomPos(),
      plantStage: 'mature',
    });
  }
  for (let i = 0; i < 6; i += 1) {
    initialSpawns.push({
      speciesId: 'berry-bush',
      position: randomPos(),
      plantStage: 'flowering',
    });
  }
  for (let i = 0; i < 7; i += 1) {
    initialSpawns.push({
      speciesId: 'rabbit',
      position: randomPos(),
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
    });
  }
  for (let i = 0; i < 2; i += 1) {
    initialSpawns.push({
      speciesId: 'fox',
      position: randomPos(),
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
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
 * Resolves a built-in scenario preset by name (`'default'`, `'meadow'`, or `'empty'`).
 */
export function getBuiltinScenario(name: string, seed = 42): ScenarioConfig {
  switch (name) {
    case 'default':
    case 'meadow':
    case 'default-meadow':
      return createDefaultMeadowScenario(seed);
    case 'empty':
    case 'sandbox':
    case 'empty-sandbox':
      return createEmptySandboxScenario(seed);
    default:
      throw new InvalidParameterError(
        'scenarioName',
        name,
        "one of ['default', 'meadow', 'empty', 'sandbox']",
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
    });

    if (scenario.enableReproduction && blueprint.kingdom === 'animal') {
      const spec = reproductionSpecSchema.parse({});
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
