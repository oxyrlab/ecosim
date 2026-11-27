import type { EntityInspection } from '@sim/inspector';
import type { SimulationStatsSnapshot } from '@sim/stats';
import { renderPopulationChartSvg } from '../chart-svg';
import { formatInspectionSections } from '../inspector-format';

/**
 * Live handle returned by {@link createInspectorPanel}.
 */
export interface InspectorPanelHandle {
  readonly element: HTMLElement;
  updateChart(history: readonly SimulationStatsSnapshot[]): void;
  updateInspection(inspection: EntityInspection | null): void;
}

/**
 * Creates the right-hand Observation sidebar hosting the live species Population Chart
 * and collapsible Entity Inspector (`SignalBus`, brain module memory, vitals, and rules).
 */
export function createInspectorPanel(): InspectorPanelHandle {
  const aside = document.createElement('aside');
  aside.className = 'ecosim-panel ecosim-sidebar';
  aside.setAttribute('aria-label', 'Population chart and entity inspector');

  const chartHeading = document.createElement('h2');
  chartHeading.textContent = 'Population';
  const chartBox = document.createElement('div');
  chartBox.className = 'ecosim-chart-box';

  const inspectorHeading = document.createElement('h2');
  inspectorHeading.textContent = 'Entity Inspector';
  const inspectorBody = document.createElement('div');

  const emptyHint = document.createElement('p');
  emptyHint.className = 'ecosim-inspector-empty';
  emptyHint.textContent = 'Click any entity with the Inspect tool to view live state.';
  inspectorBody.append(emptyHint);

  aside.append(chartHeading, chartBox, inspectorHeading, inspectorBody);

  // Track user open/closed preferences per section id across live updates
  const openState = new Map<string, boolean>();

  return {
    element: aside,
    updateChart(history: readonly SimulationStatsSnapshot[]): void {
      chartBox.innerHTML = renderPopulationChartSvg(history, { width: 278, height: 132 });
    },
    updateInspection(inspection: EntityInspection | null): void {
      if (inspection === null) {
        inspectorBody.replaceChildren(emptyHint);
        return;
      }

      const sections = formatInspectionSections(inspection);
      const fragment = document.createDocumentFragment();

      for (const sec of sections) {
        const details = document.createElement('details');
        details.className = 'ecosim-section';
        const isOpen = openState.get(sec.id) ?? sec.defaultOpen;
        details.open = isOpen;
        details.addEventListener('toggle', () => {
          openState.set(sec.id, details.open);
        });

        const summary = document.createElement('summary');
        summary.textContent = sec.title;
        details.append(summary);

        const dl = document.createElement('dl');
        dl.className = 'ecosim-kv-list';
        for (const row of sec.rows) {
          const dt = document.createElement('dt');
          dt.className = 'ecosim-kv-key';
          dt.textContent = row.label;
          const dd = document.createElement('dd');
          dd.className = 'ecosim-kv-val';
          dd.textContent = row.value;
          dl.append(dt, dd);
        }
        details.append(dl);
        fragment.append(details);
      }

      inspectorBody.replaceChildren(fragment);
    },
  };
}
