import * as Comlink from 'comlink';
import { createSeededRng } from '@core/index';
import { EcoSimRenderer } from '@render/index';
import type { RenderSnapshot, SimWorkerApi } from '@sim/index';
import SimWorker from '@sim/worker?worker';

const WORLD_SIZE_METERS = 40;
const WORLD_SEED = 42;

async function bootstrap(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#app');
  if (container === null) return;

  const rawWorker = new SimWorker();
  const worker = Comlink.wrap<SimWorkerApi>(rawWorker);

  let latestSnapshot: RenderSnapshot = await worker.init({
    world: {
      seed: WORLD_SEED,
      widthMeters: WORLD_SIZE_METERS,
      heightMeters: WORLD_SIZE_METERS,
      gridCols: 40,
      gridRows: 40,
    },
  });

  // Seed a small set of moving bodies deterministically via the Worker command queue.
  const rng = createSeededRng(WORLD_SEED);
  for (let i = 0; i < 24; i += 1) {
    await worker.enqueueCommand({
      type: 'spawn-body',
      position: {
        x: rng.nextRange(4, WORLD_SIZE_METERS - 4),
        y: rng.nextRange(4, WORLD_SIZE_METERS - 4),
      },
      radius: rng.nextRange(0.35, 0.7),
      linearVelocity: {
        x: rng.nextRange(-3, 3),
        y: rng.nextRange(-3, 3),
      },
      color: i % 2 === 0 ? 0x4ade80 : 0x38bdf8,
    });
  }

  const renderer = await EcoSimRenderer.create({
    container,
    worldWidthMeters: WORLD_SIZE_METERS,
    worldHeightMeters: WORLD_SIZE_METERS,
    onWorldClick(pos) {
      if (
        pos.x <= 0.5 ||
        pos.x >= WORLD_SIZE_METERS - 0.5 ||
        pos.y <= 0.5 ||
        pos.y >= WORLD_SIZE_METERS - 0.5
      ) {
        return;
      }
      void worker.enqueueCommand({
        type: 'spawn-body',
        position: pos,
        radius: 0.5,
        color: 0xfbbf24,
      });
    },
  });

  let lastTimeMs = performance.now();
  let stepping = false;

  const frame = (nowMs: number): void => {
    const dtSeconds = Math.min(0.1, Math.max(0, (nowMs - lastTimeMs) / 1000));
    lastTimeMs = nowMs;

    renderer.render(latestSnapshot);

    if (!stepping) {
      stepping = true;
      void worker
        .advance(dtSeconds)
        .then((snap) => {
          latestSnapshot = snap;
        })
        .finally(() => {
          stepping = false;
        });
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

void bootstrap();
