# Observation UI, Interactive Sandbox & Headless CLI

## Observation & Sandbox HUD (`src/ui/`, `src/render/`)

The browser HUD runs on the main thread and communicates exclusively with the simulation Web Worker over Comlink (`SimWorkerApi` in `src/sim/worker.ts`):

- **Playback Controls (`src/ui/panels/playback-bar.ts`):** Pause/Resume, single-tick `Step`, speed presets (`0.25×` – `4×`), and live tick / simulation time / entity count / total energy readout.
- **Interactive Sandbox Toolbar (`src/ui/panels/sandbox-toolbar.ts`):**
  - `Inspect` — click any entity on the canvas to highlight it and stream live `SignalBus` channel readings, brain module `serialize()` states, vitals, neuromodulators, and Constraint Rule diagnostics.
  - `Spawn` — place any registered species (`grass`, `berry-bush`, `rabbit`, `fox`, or custom species) via `spawn-species` commands.
  - `Remove` — remove the clicked entity via `remove-entity`.
  - `Brush` — drag-paint any environmental or scent field (`soil.nutrients`, `soil.moisture`, `light`, `scent.*`, `pheromone.mate`) via `paint-field`.
  - `Heatmap` — overlay any grid field beneath entities (`src/render/heatmap.ts`, `src/render/renderer.ts`).
  - `Save JSON` / `Load JSON` — exports and replays a Zod-validated `ScenarioConfig` JSON file including all tick-stamped Sandbox commands ([ADR 0009](../adr/0009-deterministic-sandbox-commands.md)).
- **Population Chart & Entity Inspector (`src/ui/panels/inspector-panel.ts`):** live multi-series SVG population chart (`src/ui/chart-svg.ts`) and collapsible `<details>` inspector sections (`src/ui/inspector-format.ts`).

## Deterministic Scenario Replay (`src/sim/scenario.ts`)

Every interactive Sandbox edit enters `CommandQueue` and is stamped with the exact simulation tick on which it executed. Calling `exportScenario()` saves the base `ScenarioConfig` together with `commands: RecordedCommand[]`. Reloading that JSON replays every command on its exact tick, yielding a bit-exact `computeStateHash()`.

## Headless CLI Runner (`src/headless/`)

Run deterministic batch experiments directly in Node.js (real Rapier 2D WASM, zero DOM):

```bash
npm run headless -- --seed 42 --ticks 600 --scenario default --out reports/meadow.json
npm run headless -- --seed 42 --ticks 600 --scenario default --format csv --out reports/meadow.csv
npm run headless -- --seed 7 --ticks 300 --scenario ./my-scenario.json --sample-interval 15
```

### Supported Flags

| Flag                | Default   | Description                                                             |
| ------------------- | --------- | ----------------------------------------------------------------------- |
| `--seed <int>`      | `42`      | Integer RNG seed overriding the scenario world seed.                    |
| `--ticks <int>`     | `300`     | Number of fixed simulation ticks (`1/30 s` each) to execute.            |
| `--scenario <src>`  | `default` | Built-in preset (`default`, `meadow`, `empty`) or path to a JSON file.  |
| `--out <path>`      | stdout    | Output file path (`.csv` infers CSV format automatically).              |
| `--format <fmt>`    | `json`    | Explicit output format: `json` (full report + audit) or `csv` (series). |
| `--sample-interval` | `30`      | Fixed ticks between `StatsHistory` samples.                             |

JSON exports include `finalStateHash`, `energyAudit` (`EnergyLedger`), `finalStats`, `statsHistory`, `genomeSummary`, and `commandCount`.
