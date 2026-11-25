# Brain Modules

A **BrainModule** (`src/brain/`) is an isolated processing unit (`rule`, `fsm`, `utility`, `nn`, `hybrid`, or `learning`) that communicates solely through pre-resolved `SignalBus` input/output ports and broadcast hormone handles—never with other modules or the World directly.

- Each module receives an injected entity `SeededRng` at creation time and exposes an optional `serialize()` method for the Inspector UI.
- See [docs/catalog/brain-modules.md](../catalog/brain-modules.md) and [guides/add-brain-module.md](../guides/add-brain-module.md).
