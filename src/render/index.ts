export { evaluatePartAnimations, type VisualAnimOffset } from './animation';
export { Camera, type WorldBounds } from './camera';
export {
  FIELD_HEATMAP_PALETTES,
  mapFieldValueToCellStyle,
  type FieldHeatmapPalette,
  type HeatmapCellStyle,
} from './heatmap';
export { getObjectSpriteSpecForKind } from './object-shapes';
export {
  getPlantSpriteSpecForKind,
  type BakedSpriteSpec,
  type VectorPrimitive,
} from './plant-shapes';
export { EcoSimRenderer, type RendererInteractionMode, type RendererOptions } from './renderer';
export {
  RENDER_KIND,
  buildProceduralDrawParts,
  getAnimalSpriteSpecForKind,
  getProceduralLayoutForKind,
  resolveSpeciesRenderKind,
  type ProceduralDrawPart,
} from './species-shapes';
export { MEADOW_TERRAIN_COLORS, generateTerrainPatches, type TerrainPatch } from './terrain';
export {
  AppearanceTextureCache,
  splitAppearanceLayers,
  type BakedTextureEntry,
  type SplitAppearanceLayers,
} from './texture-cache';
