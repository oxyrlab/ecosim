import { describe, expect, it } from 'vitest';
import {
  buildProceduralDrawParts,
  getProceduralLayoutForKind,
  RENDER_KIND,
  resolveSpeciesRenderKind,
} from './species-shapes';

describe('species-shapes', () => {
  it('maps built-in species IDs to render kinds and builds procedural vector parts for rabbit and fox', () => {
    expect(resolveSpeciesRenderKind('rabbit', 'animal')).toBe(RENDER_KIND.RABBIT);
    expect(resolveSpeciesRenderKind('fox', 'animal')).toBe(RENDER_KIND.FOX);
    expect(resolveSpeciesRenderKind('berry-bush', 'plant')).toBe(RENDER_KIND.BUSH);
    expect(resolveSpeciesRenderKind('grass', 'plant')).toBe(RENDER_KIND.PLANT);
    expect(resolveSpeciesRenderKind('custom-animal', 'animal')).toBe(RENDER_KIND.BODY);

    expect(getProceduralLayoutForKind(RENDER_KIND.BODY)).toBeNull();

    const rabbitLayout = getProceduralLayoutForKind(RENDER_KIND.RABBIT);
    expect(rabbitLayout).not.toBeNull();
    // Second call hits cache
    expect(getProceduralLayoutForKind(RENDER_KIND.RABBIT)).toBe(rabbitLayout);

    if (rabbitLayout !== null) {
      const parts = buildProceduralDrawParts(rabbitLayout.parts);
      expect(parts.length).toBeGreaterThanOrEqual(4);
      expect(parts[0]?.commands.length).toBeGreaterThan(0);
    }

    const foxLayout = getProceduralLayoutForKind(RENDER_KIND.FOX);
    expect(foxLayout).not.toBeNull();
    if (foxLayout !== null) {
      const parts = buildProceduralDrawParts(foxLayout.parts);
      expect(parts.length).toBeGreaterThanOrEqual(4);
    }
  });
});
