import { formatBenchmarkReport, runScenarioBenchmark } from '../src/headless/benchmark';
import { getScenarioPreset, listBenchmarkPresets } from '../src/sim/scenario-registry';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let seed = 42;
  let scenarioFilter: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--seed' && args[i + 1] !== undefined) {
      seed = Number.parseInt(args[i + 1] ?? '42', 10);
      i += 1;
    } else if (arg === '--scenario' && args[i + 1] !== undefined) {
      scenarioFilter = args[i + 1] ?? null;
      i += 1;
    }
  }

  const presets =
    scenarioFilter !== null ? [getScenarioPreset(scenarioFilter)] : listBenchmarkPresets();

  const results = [];
  for (const preset of presets) {
    results.push(await runScenarioBenchmark(preset, { seed }));
  }

  console.log(formatBenchmarkReport(results));
  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
