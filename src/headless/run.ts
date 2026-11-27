import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getBuiltinScenario, parseScenarioJson, type ScenarioConfig } from '@sim/index';
import { formatHeadlessOutput, parseHeadlessArgs, runHeadlessSimulation } from './runner';

const USAGE = `EcoSim Headless Runner
Usage:
  npm run headless -- [--seed <int>] [--ticks <int>] [--scenario <default|empty|path.json>] [--out <file>] [--format <json|csv>] [--sample-interval <ticks>]
`;

function loadScenarioSource(source: string, seed: number): ScenarioConfig {
  const candidatePath = resolve(process.cwd(), source);
  if (existsSync(candidatePath)) {
    const raw = readFileSync(candidatePath, 'utf8');
    return parseScenarioJson(raw);
  }
  return getBuiltinScenario(source, seed);
}

/**
 * CLI entry point executing a deterministic headless EcoSim experiment and exporting JSON or CSV.
 */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const args = parseHeadlessArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const scenario = loadScenarioSource(args.scenario, args.seed);
  const result = await runHeadlessSimulation({
    seed: args.seed,
    ticks: args.ticks,
    scenario,
    sampleIntervalTicks: args.sampleIntervalTicks,
  });

  const output = formatHeadlessOutput(result, args.format);
  if (args.outPath !== null) {
    const targetPath = resolve(process.cwd(), args.outPath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, `${output}\n`, 'utf8');
    console.log(
      `EcoSim headless complete: scenario=${result.scenarioName} seed=${result.seed} ticks=${result.finalTick} hash=0x${result.finalStateHash.toString(16)} energyBalanced=${result.energyAudit.balanced} -> ${targetPath}`,
    );
  } else {
    console.log(output);
  }
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
