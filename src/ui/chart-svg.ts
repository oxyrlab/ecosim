import type { SimulationStatsSnapshot } from '@sim/stats';

/**
 * Configuration options for {@link renderPopulationChartSvg}.
 */
export interface PopulationChartOptions {
  readonly width?: number;
  readonly height?: number;
  readonly speciesColors?: Readonly<Record<string, string>>;
}

const DEFAULT_SPECIES_COLORS: Readonly<Record<string, string>> = {
  grass: '#4ade80',
  'berry-bush': '#f472b6',
  rabbit: '#e2e8f0',
  fox: '#fb923c',
};

const FALLBACK_COLORS = ['#38bdf8', '#a78bfa', '#facc15', '#2dd4bf', '#f87171'] as const;

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Renders a self-contained accessible SVG line chart of species population counts over time.
 * Pure string renderer with zero DOM dependencies so it is 100% unit-testable in Node.
 */
export function renderPopulationChartSvg(
  samples: readonly SimulationStatsSnapshot[],
  options: PopulationChartOptions = {},
): string {
  const width = options.width ?? 280;
  const height = options.height ?? 130;
  const padLeft = 28;
  const padRight = 8;
  const padTop = 10;
  const padBottom = 22;
  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, height - padTop - padBottom);

  const speciesSet = new Set<string>();
  let maxCount = 1;
  for (const sample of samples) {
    for (const [speciesId, count] of Object.entries(sample.speciesCounts)) {
      speciesSet.add(speciesId);
      if (count > maxCount) maxCount = count;
    }
  }
  const speciesIds = Array.from(speciesSet).sort();

  const colors: Record<string, string> = {};
  speciesIds.forEach((id, idx) => {
    colors[id] =
      options.speciesColors?.[id] ??
      DEFAULT_SPECIES_COLORS[id] ??
      (FALLBACK_COLORS[idx % FALLBACK_COLORS.length] as string);
  });

  const gridLines: string[] = [];
  for (let step = 0; step <= 2; step += 1) {
    const ratio = step / 2;
    const y = padTop + plotH * (1 - ratio);
    const label = Math.round(maxCount * ratio);
    gridLines.push(
      `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${padLeft + plotW}" y2="${y.toFixed(1)}" stroke="#334155" stroke-width="1" />`,
      `<text x="${padLeft - 4}" y="${(y + 3).toFixed(1)}" fill="#94a3b8" font-size="9" text-anchor="end">${label}</text>`,
    );
  }

  const paths: string[] = [];
  if (samples.length > 0) {
    const denom = Math.max(1, samples.length - 1);
    for (const speciesId of speciesIds) {
      const points = samples
        .map((sample, index) => {
          const x = padLeft + (samples.length === 1 ? plotW : (index / denom) * plotW);
          const count = sample.speciesCounts[speciesId] ?? 0;
          const y = padTop + plotH * (1 - count / maxCount);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
      paths.push(
        `<polyline fill="none" stroke="${colors[speciesId]}" stroke-width="1.8" points="${points}" />`,
      );
    }
  }

  const legendItems = speciesIds.map((id, i) => {
    const latest = samples[samples.length - 1]?.speciesCounts[id] ?? 0;
    const x = padLeft + i * 64;
    return `<g transform="translate(${x}, ${height - 6})"><rect x="0" y="-7" width="7" height="7" rx="1.5" fill="${colors[id]}" /><text x="10" y="0" fill="#cbd5e1" font-size="9">${escapeXml(id.slice(0, 7))}:${latest}</text></g>`;
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Population by species over time">`,
    `<rect x="0" y="0" width="${width}" height="${height}" rx="6" fill="#0f172a" />`,
    ...gridLines,
    ...paths,
    ...legendItems,
    '</svg>',
  ].join('');
}
