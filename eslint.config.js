import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const DETERMINISTIC_LAYERS = [
  'src/core/**/*.ts',
  'src/config/**/*.ts',
  'src/rules/**/*.ts',
  'src/appearance/**/*.ts',
  'src/physics/**/*.ts',
  'src/world/**/*.ts',
  'src/bus/**/*.ts',
  'src/body/**/*.ts',
  'src/brain/**/*.ts',
  'src/spine/**/*.ts',
  'src/life/**/*.ts',
  'src/plants/**/*.ts',
  'src/genome/**/*.ts',
  'src/species/**/*.ts',
  'src/sim/**/*.ts',
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
    },
  },
  {
    // Determinism: simulation layers must never read ambient randomness or wall-clock time.
    files: DETERMINISTIC_LAYERS,
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use an injected Rng from @core/rng instead of Math.random().',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Wall-clock time is forbidden in deterministic simulation layers.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Wall-clock time is forbidden in deterministic simulation layers.',
        },
      ],
    },
  },
  {
    files: ['*.config.ts', '*.config.js'],
    rules: { 'no-restricted-exports': 'off' },
  },
);
