/**
 * Scale & micro-benchmark runner (`npm run bench`).
 * Measures baseline and optimized timings across:
 * 1. GridField 3x3 diffusion (80x80 grid)
 * 2. SpatialHash insert/update + radius queries (1,000 entities)
 * 3. Vision sensor sampling (500 animals)
 * 4. MlpSgdLearner forward pass (500 networks)
 * 5. Full world tick at target scale (500 animals + 500 plants + 100 objects, real Rapier WASM)
 */
import { performance } from 'node:perf_hooks';
import { createEntityId, createSeededRng } from '@core/index';
import { MlpSgdLearner } from '@brain/learning';
import { createRapierPhysicsAdapter } from '@physics/index';
import { Simulation, type ScenarioConfig, type ScenarioSpeciesSpawn } from '@sim/index';
import { GridField, SpatialHash } from '@world/index';

interface BenchResult {
  readonly name: string;
  readonly iterations: number;
  readonly meanMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

function measure(name: string, iterations: number, fn: () => void, warmup = 3): BenchResult {
  for (let i = 0; i < warmup; i += 1) fn();
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    sum += elapsed;
    if (elapsed < min) min = elapsed;
    if (elapsed > max) max = elapsed;
  }
  return { name, iterations, meanMs: sum / iterations, minMs: min, maxMs: max };
}

function createTargetScaleScenario(
  animals: number,
  plants: number,
  objects: number,
  seed = 42,
): ScenarioConfig {
  const rng = createSeededRng(seed);
  const size = 120;
  const margin = 4;
  const pos = () => ({
    x: Number(rng.nextRange(margin, size - margin).toFixed(2)),
    y: Number(rng.nextRange(margin, size - margin).toFixed(2)),
  });

  const initialSpawns: ScenarioSpeciesSpawn[] = [];
  const grassCount = Math.floor(plants * 0.75);
  const bushCount = plants - grassCount;
  for (let i = 0; i < grassCount; i += 1) {
    initialSpawns.push({ speciesId: 'grass', position: pos(), plantStage: 'mature' });
  }
  for (let i = 0; i < bushCount; i += 1) {
    initialSpawns.push({ speciesId: 'berry-bush', position: pos(), plantStage: 'flowering' });
  }

  const rabbitCount = Math.floor(animals * 0.8);
  const foxCount = animals - rabbitCount;
  for (let i = 0; i < rabbitCount; i += 1) {
    initialSpawns.push({
      speciesId: 'rabbit',
      position: pos(),
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
    });
  }
  for (let i = 0; i < foxCount; i += 1) {
    initialSpawns.push({
      speciesId: 'fox',
      position: pos(),
      angle: Number((rng.next() * Math.PI * 2).toFixed(4)),
    });
  }

  const commands = Array.from({ length: objects }, () => ({
    tick: 0,
    command: {
      type: 'spawn-body' as const,
      position: pos(),
      radius: 0.25,
      color: 0x94a3b8,
      tags: ['obstacle'],
    },
  }));

  return {
    version: 1,
    name: `scale-${animals}a-${plants}p-${objects}o`,
    description: 'Target-scale performance benchmark scenario.',
    world: {
      seed,
      widthMeters: size,
      heightMeters: size,
      gridCols: 60,
      gridRows: 60,
    },
    enableReproduction: false,
    initialFields: [
      { fieldName: 'soil.nutrients', x: size / 2, y: size / 2, radiusMeters: size, value: 8 },
      { fieldName: 'soil.moisture', x: size / 2, y: size / 2, radiusMeters: size, value: 0.7 },
    ],
    initialSpawns,
    commands,
  };
}

async function runBenchmarks(): Promise<void> {
  const results: BenchResult[] = [];

  // 1. GridField 3x3 diffusion (60x60)
  const field = new GridField({
    name: 'scent.plant',
    cols: 60,
    rows: 60,
    cellSizeMeters: 2,
    initialValue: 1,
  });
  results.push(
    measure('grid-diffusion (60x60)', 200, () => {
      field.diffuse(0.25);
      field.decay(0.92);
    }),
  );

  // 2. SpatialHash update + 500 radius queries on 1,000 entities
  const sh = new SpatialHash(4);
  const shRng = createSeededRng(7);
  const coords = Array.from({ length: 1000 }, (_, i) => ({
    id: createEntityId(i + 1),
    x: shRng.nextRange(2, 118),
    y: shRng.nextRange(2, 118),
  }));
  for (const c of coords) sh.insert(c.id, c.x, c.y, 0.4);
  results.push(
    measure('spatial-hash (500 updates + 500 queries / 1000 ent)', 30, () => {
      for (let i = 0; i < 500; i += 1) {
        const c = coords[i] as (typeof coords)[number];
        sh.update(c.id, c.x + 0.05, c.y + 0.05, 0.4);
      }
      for (let i = 0; i < 500; i += 1) {
        const c = coords[i] as (typeof coords)[number];
        sh.queryRadius(c.x, c.y, 8);
      }
    }),
  );

  // 3. Neural network forward pass (500 MLPs, 8->12->2)
  const nnRng = createSeededRng(13);
  const mlps = Array.from(
    { length: 500 },
    () =>
      new MlpSgdLearner({
        layerSizes: [8, 12, 2],
        rng: nnRng,
      }),
  );
  const nnIn = new Float32Array([0.4, -0.2, 0.8, 0.1, 0.5, 0.3, -0.6, 0.9]);
  const nnOut = new Float32Array(2);
  results.push(
    measure('mlp-forward (500 networks, 8->12->2)', 50, () => {
      for (let i = 0; i < mlps.length; i += 1) {
        (mlps[i] as MlpSgdLearner).predict(nnIn, nnOut);
      }
    }),
  );

  // 4. Full simulation tick — Medium (150 animals + 150 plants + 30 objects)
  const medScenario = createTargetScaleScenario(150, 150, 30, 42);
  const medSim = new Simulation(
    { world: medScenario.world, scenario: medScenario, statsIntervalTicks: 60 },
    await createRapierPhysicsAdapter(),
  );
  medSim.stepFixed(); // apply tick 0 commands
  results.push(
    measure('full-tick medium (150a + 150p + 30o, Rapier)', 30, () => {
      medSim.stepFixed();
    }),
  );
  medSim.free();

  // 5. Full simulation tick — Target scale (500 animals + 500 plants + 100 objects)
  const fullScenario = createTargetScaleScenario(500, 500, 100, 42);
  const fullSim = new Simulation(
    { world: fullScenario.world, scenario: fullScenario, statsIntervalTicks: 60 },
    await createRapierPhysicsAdapter(),
  );
  fullSim.stepFixed(); // apply tick 0 commands
  results.push(
    measure('full-tick target (500a + 500p + 100o, Rapier)', 20, () => {
      fullSim.stepFixed();
    }),
  );
  fullSim.free();

  console.log('\nEcoSim Benchmark Results');
  console.log('========================================================================');
  for (const r of results) {
    console.log(
      `${r.name.padEnd(52)} mean=${r.meanMs.toFixed(2)}ms  min=${r.minMs.toFixed(2)}ms  max=${r.maxMs.toFixed(2)}ms  (n=${r.iterations})`,
    );
  }
}

void runBenchmarks();
