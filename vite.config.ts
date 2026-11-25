import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export const pathAliases = {
  '@core': resolve(import.meta.dirname, 'src/core'),
  '@config': resolve(import.meta.dirname, 'src/config'),
  '@rules': resolve(import.meta.dirname, 'src/rules'),
  '@appearance': resolve(import.meta.dirname, 'src/appearance'),
  '@physics': resolve(import.meta.dirname, 'src/physics'),
  '@world': resolve(import.meta.dirname, 'src/world'),
  '@bus': resolve(import.meta.dirname, 'src/bus'),
  '@body': resolve(import.meta.dirname, 'src/body'),
  '@brain': resolve(import.meta.dirname, 'src/brain'),
  '@spine': resolve(import.meta.dirname, 'src/spine'),
  '@life': resolve(import.meta.dirname, 'src/life'),
  '@plants': resolve(import.meta.dirname, 'src/plants'),
  '@genome': resolve(import.meta.dirname, 'src/genome'),
  '@species': resolve(import.meta.dirname, 'src/species'),
  '@sim': resolve(import.meta.dirname, 'src/sim'),
  '@render': resolve(import.meta.dirname, 'src/render'),
  '@ui': resolve(import.meta.dirname, 'src/ui'),
  '@headless': resolve(import.meta.dirname, 'src/headless'),
};

export default defineConfig({
  resolve: {
    alias: pathAliases,
  },
});
