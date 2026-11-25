# EcoSim

A 2D, browser-based ecosystem simulator with modular nervous systems.

Each animal has an isolated nervous system (`body -> organs -> sensors -> SignalBus -> modular brain -> spine -> actuators`) communicating exclusively through typed numeric signals on a double-buffered bus, while plants share the same ECS without a brain or spine.

## Commands

```bash
npm install
npm run dev           # Start Vite dev server
npm run build         # Production bundle
npm run typecheck     # Strict TypeScript check
npm run lint          # ESLint (including determinism rules)
npm test              # Vitest unit & contract suites
npm run test:coverage # Vitest with V8 coverage thresholds
npm run docs:catalog  # Regenerate docs/catalog/ from registries
npm run docs:check    # Verify docs, links, TSDoc, and sibling tests
```

## Documentation

Start with [AGENTS.md](AGENTS.md), [docs/README.md](docs/README.md), and [docs/STATUS.md](docs/STATUS.md).
