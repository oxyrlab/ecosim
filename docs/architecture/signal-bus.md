# SignalBus & Static Wiring Architecture

Every animal owns an isolated double-buffered `SignalBus` backed by two `Float32Array` buffers (`current` and `next`) ([ADR 0004](../adr/0004-double-buffer-signal-bus.md)).

## Execution Model

- **Reads** come strictly from `current`; **writes** go strictly to `next` (clamped to declared `[min, max]` bounds, rejecting `NaN`/`Infinity`).
- **`swap()`** runs once per tick after sensors write: executes all pre-compiled `MergeOp`s (`sum | max | min | avg`), swaps `current ↔ next`, carries `analog` channels forward (preserving lower-rate module outputs), and resets `pulse` channels in `next` to `0`.
- **Zero strings or allocations in hot loops:** `resolveWiring()` resolves all `"<instanceId>:<port>"` addresses once at spawn time into numeric `PortHandle`s.

## Wiring & Hormones

- **Address syntax:** `"<instanceId>:<port>"` (supports dotted mirrored ids such as `thrust.l:power`) and `"<instanceId>:<port>[i]"` strictly for spatial array ports (`count !== undefined`).
- **Fan-out:** Zero-copy—multiple consumers share the producer's slot handle.
- **Fan-in:** Requires an explicit `merge` policy (`sum | max | min | avg`) on the target input port (enforced by Rule `unmerged-fan-in`).
- **Bundles:** `{ bundle: 'behavior', from: 'fear', to: 'arbiter:flee' }` expands into `urgency`, `turn`, and `forward`.
- **Hormones (`src/bus/hormones.ts`):** Broadcast channels (`hormone.adrenaline`, `hormone.fatigue`, `hormone.satiety`, `hormone.reward`, `hormone.aversive`) resolved at spawn time. See [docs/catalog/channels.md](../catalog/channels.md).
