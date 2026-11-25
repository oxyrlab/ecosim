import { WiringError } from '@core/index';
import { getHormoneSpec } from './hormones';
import { PORT_BUNDLES, type PortDef, type PortHandle, type PortMap } from './ports';
import { SignalBus, type ChannelSpec, type MergeOp } from './signal-bus';

/**
 * Static point-to-point or bundle wire declaration in a species Blueprint (Section 5.2.1).
 */
export type WireSpec =
  | {
      readonly from: string | readonly string[];
      readonly to: string | readonly string[];
    }
  | {
      readonly bundle: string;
      readonly from: string;
      readonly to: string;
    };

/**
 * Minimal description of one wired component (sensor, actuator, brain module, or spine)
 * participating in a creature's signal graph.
 */
export interface WiringEndpoint {
  /** Unique instance id within the creature (may include dots for mirrored parts, e.g. `thrust.l`). */
  readonly instanceId: string;
  /** Declared input ports keyed by local port name. */
  readonly inputs: PortMap;
  /** Declared output ports keyed by local port name. */
  readonly outputs: PortMap;
  /** Optional broadcast hormone channels published by this component. */
  readonly publish?: readonly string[];
  /** Optional broadcast hormone channels subscribed to by this component. */
  readonly subscribe?: readonly string[];
}

/**
 * Pre-resolved port and hormone handles assigned to one component instance.
 */
export interface ResolvedComponentHandles {
  readonly inputs: Readonly<Record<string, PortHandle>>;
  readonly outputs: Readonly<Record<string, PortHandle>>;
  readonly publish: Readonly<Record<string, PortHandle>>;
  readonly subscribe: Readonly<Record<string, PortHandle>>;
}

/**
 * Static wiring diagnostics inspected by Constraint Rules (`unmerged-fan-in`, `unconnected-input`,
 * `unused-output`, `numeric-index-on-logical-port`).
 */
export interface WiringDiagnostics {
  readonly unmergedFanIns: readonly {
    readonly target: string;
    readonly sources: readonly string[];
  }[];
  readonly unconnectedInputs: readonly string[];
  readonly unusedOutputs: readonly string[];
  readonly numericIndexOnLogicalPorts: readonly string[];
}

/**
 * Complete result of resolving a creature's static wiring graph and hormone subscriptions.
 */
export interface ResolvedWiring {
  /** Allocated double-buffered {@link SignalBus} for the creature. */
  readonly bus: SignalBus;
  /** Pre-resolved handles keyed by `instanceId`. */
  readonly handles: ReadonlyMap<string, ResolvedComponentHandles>;
  /** Static graph diagnostics used by Blueprint rules. */
  readonly diagnostics: WiringDiagnostics;
}

interface ParsedAddress {
  readonly raw: string;
  readonly instanceId: string;
  readonly portName: string;
  readonly arrayIndex: number | undefined;
}

const INDEXED_PORT_PATTERN = /^(.+)\[(\d+)\]$/;

/**
 * Parses a `"<instanceId>:<port>"` (or `"<instanceId>:<port>[<index>]"`) wire address.
 * Uses `:` as the unambiguous separator because mirrored instance ids contain dots (`thrust.l:power`).
 */
export function parseWireAddress(address: string): ParsedAddress {
  const colonIndex = address.indexOf(':');
  if (
    colonIndex <= 0 ||
    colonIndex === address.length - 1 ||
    address.indexOf(':', colonIndex + 1) !== -1
  ) {
    throw new WiringError(
      `Invalid wire address "${address}". Expected "<instanceId>:<port>" (with exactly one ":").`,
      address,
    );
  }

  const instanceId = address.slice(0, colonIndex);
  const rawPort = address.slice(colonIndex + 1);
  const match = INDEXED_PORT_PATTERN.exec(rawPort);
  if (match !== null) {
    const portName = match[1] as string;
    const arrayIndex = Number.parseInt(match[2] as string, 10);
    return { raw: address, instanceId, portName, arrayIndex };
  }

  return { raw: address, instanceId, portName: rawPort, arrayIndex: undefined };
}

function expandWireSpecs(
  wires: readonly WireSpec[],
): Array<{ readonly from: string; readonly to: string }> {
  const expanded: Array<{ readonly from: string; readonly to: string }> = [];
  for (const wire of wires) {
    if ('bundle' in wire) {
      const bundle = PORT_BUNDLES[wire.bundle];
      if (bundle === undefined) {
        throw new WiringError(
          `Unknown port bundle "${wire.bundle}". Available bundles: ${Object.keys(PORT_BUNDLES).join(', ')}.`,
          wire.from,
          wire.to,
        );
      }
      const fromHasPrefix = wire.from.includes(':');
      const toHasPrefix = wire.to.includes(':');
      for (const portKey of Object.keys(bundle)) {
        const fromAddr = fromHasPrefix ? `${wire.from}.${portKey}` : `${wire.from}:${portKey}`;
        const toAddr = toHasPrefix ? `${wire.to}.${portKey}` : `${wire.to}:${portKey}`;
        expanded.push({ from: fromAddr, to: toAddr });
      }
    } else {
      const sources = typeof wire.from === 'string' ? [wire.from] : wire.from;
      const targets = typeof wire.to === 'string' ? [wire.to] : wire.to;
      for (const from of sources) {
        for (const to of targets) {
          expanded.push({ from, to });
        }
      }
    }
  }
  return expanded;
}

/**
 * Analyzes a wiring graph and collects diagnostics without throwing on rule-checkable issues
 * (`unmerged-fan-in`, `numeric-index-on-logical-port`), while still validating addresses and
 * endpoint existence.
 */
export function inspectWiring(
  components: readonly WiringEndpoint[],
  wires: readonly WireSpec[],
): WiringDiagnostics {
  const compMap = new Map<string, WiringEndpoint>();
  for (const comp of components) {
    if (compMap.has(comp.instanceId)) {
      throw new WiringError(`Duplicate component instanceId "${comp.instanceId}" in wiring graph.`);
    }
    compMap.set(comp.instanceId, comp);
  }

  const pairs = expandWireSpecs(wires);
  const sourcesByTarget = new Map<string, string[]>();
  const usedOutputs = new Set<string>();
  const connectedInputs = new Set<string>();
  const numericIndexOnLogicalPorts: string[] = [];

  for (const pair of pairs) {
    const src = parseWireAddress(pair.from);
    const dst = parseWireAddress(pair.to);

    const srcComp = compMap.get(src.instanceId);
    if (srcComp === undefined) {
      throw new WiringError(`Unknown source instance "${src.instanceId}".`, pair.from, pair.to);
    }
    const srcPort = srcComp.outputs[src.portName];
    if (srcPort === undefined) {
      throw new WiringError(
        `Source instance "${src.instanceId}" has no output port "${src.portName}".`,
        pair.from,
        pair.to,
      );
    }

    const dstComp = compMap.get(dst.instanceId);
    if (dstComp === undefined) {
      throw new WiringError(`Unknown target instance "${dst.instanceId}".`, pair.from, pair.to);
    }
    const dstPort = dstComp.inputs[dst.portName];
    if (dstPort === undefined) {
      throw new WiringError(
        `Target instance "${dst.instanceId}" has no input port "${dst.portName}".`,
        pair.from,
        pair.to,
      );
    }

    if (src.arrayIndex !== undefined && srcPort.count === undefined) {
      numericIndexOnLogicalPorts.push(pair.from);
    }
    if (dst.arrayIndex !== undefined && dstPort.count === undefined) {
      numericIndexOnLogicalPorts.push(pair.to);
    }

    const srcCount = src.arrayIndex !== undefined ? 1 : (srcPort.count ?? 1);
    const dstCount = dst.arrayIndex !== undefined ? 1 : (dstPort.count ?? 1);
    if (srcCount !== dstCount) {
      throw new WiringError(
        `Port array count mismatch: "${pair.from}" has count ${srcCount}, but "${pair.to}" expects ${dstCount}.`,
        pair.from,
        pair.to,
      );
    }

    if (
      src.arrayIndex !== undefined &&
      srcPort.count !== undefined &&
      src.arrayIndex >= srcPort.count
    ) {
      throw new WiringError(
        `Index [${src.arrayIndex}] out of bounds for output "${src.instanceId}:${src.portName}" (count ${srcPort.count}).`,
        pair.from,
        pair.to,
      );
    }
    if (
      dst.arrayIndex !== undefined &&
      dstPort.count !== undefined &&
      dst.arrayIndex >= dstPort.count
    ) {
      throw new WiringError(
        `Index [${dst.arrayIndex}] out of bounds for input "${dst.instanceId}:${dst.portName}" (count ${dstPort.count}).`,
        pair.from,
        pair.to,
      );
    }

    usedOutputs.add(`${src.instanceId}:${src.portName}`);
    connectedInputs.add(`${dst.instanceId}:${dst.portName}`);

    const targetKey = `${dst.instanceId}:${dst.portName}${dst.arrayIndex !== undefined ? `[${dst.arrayIndex}]` : ''}`;
    const list = sourcesByTarget.get(targetKey) ?? [];
    list.push(pair.from);
    sourcesByTarget.set(targetKey, list);
  }

  const unmergedFanIns: Array<{ readonly target: string; readonly sources: readonly string[] }> =
    [];
  for (const [targetKey, srcs] of sourcesByTarget.entries()) {
    if (srcs.length <= 1) continue;
    const parsed = parseWireAddress(targetKey);
    const dstPort = compMap.get(parsed.instanceId)?.inputs[parsed.portName];
    if (dstPort?.merge === undefined) {
      unmergedFanIns.push({ target: targetKey, sources: srcs });
    }
  }

  const unconnectedInputs: string[] = [];
  const unusedOutputs: string[] = [];
  for (const comp of components) {
    for (const inputName of Object.keys(comp.inputs)) {
      const addr = `${comp.instanceId}:${inputName}`;
      if (!connectedInputs.has(addr)) {
        unconnectedInputs.push(addr);
      }
    }
    for (const outputName of Object.keys(comp.outputs)) {
      const addr = `${comp.instanceId}:${outputName}`;
      if (!usedOutputs.has(addr)) {
        unusedOutputs.push(addr);
      }
    }
  }

  return {
    unmergedFanIns,
    unconnectedInputs,
    unusedOutputs,
    numericIndexOnLogicalPorts,
  };
}

/**
 * Resolves all static point-to-point wires, bundles, fan-out/fan-in merges, and broadcast hormone
 * channels into a fixed-size {@link SignalBus} with pre-resolved numeric {@link PortHandle}s.
 *
 * @throws WiringError on unknown instances/ports, count mismatches, numeric indexing on logical
 *   ports, or fan-in onto an input lacking a `merge` policy.
 */
export function resolveWiring(
  components: readonly WiringEndpoint[],
  wires: readonly WireSpec[],
): ResolvedWiring {
  const diagnostics = inspectWiring(components, wires);

  if (diagnostics.numericIndexOnLogicalPorts.length > 0) {
    throw new WiringError(
      `Numeric index used on logical non-array port(s): ${diagnostics.numericIndexOnLogicalPorts.join(', ')}.`,
    );
  }
  if (diagnostics.unmergedFanIns.length > 0) {
    const first = diagnostics.unmergedFanIns[0] as { target: string; sources: readonly string[] };
    throw new WiringError(
      `Fan-in into "${first.target}" from [${first.sources.join(', ')}] requires an explicit merge policy on the input port.`,
      first.sources.join(', '),
      first.target,
    );
  }

  const specs: ChannelSpec[] = [];
  const mergeOps: MergeOp[] = [];

  const allocPortSlots = (prefix: string, def: PortDef): PortHandle => {
    const offset = specs.length;
    const count = def.count ?? 1;
    for (let i = 0; i < count; i += 1) {
      specs.push({
        name: def.count !== undefined ? `${prefix}.${i}` : prefix,
        kind: def.kind,
        range: def.range,
        ...(def.unit !== undefined ? { unit: def.unit } : {}),
        description: def.description,
      });
    }
    return { offset, count, kind: def.kind, range: def.range };
  };

  // 1. Allocate output slots for every component.
  const outputHandlesByComp = new Map<string, Record<string, PortHandle>>();
  for (const comp of components) {
    const outMap: Record<string, PortHandle> = {};
    for (const [portName, def] of Object.entries(comp.outputs)) {
      outMap[portName] = allocPortSlots(`${comp.instanceId}.${portName}`, def);
    }
    outputHandlesByComp.set(comp.instanceId, outMap);
  }

  // 2. Group incoming wires per target (component, port).
  const pairs = expandWireSpecs(wires);
  const incomingByPort = new Map<
    string,
    Array<{
      readonly srcHandle: PortHandle;
      readonly srcIdx: number | undefined;
      readonly dstIdx: number | undefined;
    }>
  >();

  for (const pair of pairs) {
    const src = parseWireAddress(pair.from);
    const dst = parseWireAddress(pair.to);
    const srcHandle = outputHandlesByComp.get(src.instanceId)?.[src.portName] as PortHandle;
    const key = `${dst.instanceId}:${dst.portName}`;
    const list = incomingByPort.get(key) ?? [];
    list.push({ srcHandle, srcIdx: src.arrayIndex, dstIdx: dst.arrayIndex });
    incomingByPort.set(key, list);
  }

  // 3. Resolve input handles (zero-copy for 1:1 / fan-out, dedicated merged slot for fan-in).
  const inputHandlesByComp = new Map<string, Record<string, PortHandle>>();
  for (const comp of components) {
    const inMap: Record<string, PortHandle> = {};
    for (const [portName, def] of Object.entries(comp.inputs)) {
      const key = `${comp.instanceId}:${portName}`;
      const incoming = incomingByPort.get(key);

      if (incoming === undefined || incoming.length === 0) {
        // Unconnected input: allocate a silent default slot so reading never crashes.
        inMap[portName] = allocPortSlots(`${comp.instanceId}.${portName}`, def);
      } else if (
        incoming.length === 1 &&
        incoming[0] !== undefined &&
        incoming[0].dstIdx === undefined
      ) {
        const single = incoming[0];
        if (single.srcIdx !== undefined) {
          inMap[portName] = {
            offset: single.srcHandle.offset + single.srcIdx,
            count: 1,
            kind: def.kind,
            range: def.range,
          };
        } else {
          // Zero-copy fan-out: reader points directly at source slot(s).
          inMap[portName] = {
            offset: single.srcHandle.offset,
            count: single.srcHandle.count,
            kind: def.kind,
            range: def.range,
          };
        }
      } else {
        // Fan-in or element-wise array wiring: allocate dedicated target slot(s) + MergeOps.
        const targetHandle = allocPortSlots(`${comp.instanceId}.${portName}`, def);
        const count = def.count ?? 1;
        for (let slot = 0; slot < count; slot += 1) {
          const sourceOffsets: number[] = [];
          for (const wire of incoming) {
            if (wire.dstIdx !== undefined && wire.dstIdx !== slot) continue;
            const srcSlot =
              wire.srcIdx !== undefined ? wire.srcIdx : wire.srcHandle.count === 1 ? 0 : slot;
            sourceOffsets.push(wire.srcHandle.offset + srcSlot);
          }
          if (sourceOffsets.length > 0) {
            mergeOps.push({
              sources: sourceOffsets,
              target: targetHandle.offset + slot,
              policy: def.merge ?? 'max',
            });
          }
        }
        inMap[portName] = targetHandle;
      }
    }
    inputHandlesByComp.set(comp.instanceId, inMap);
  }

  // 4. Resolve broadcast hormone channels (publish/subscribe).
  const hormonePublishers = new Map<string, number[]>();
  const publishHandlesByComp = new Map<string, Record<string, PortHandle>>();
  const subscribeHandlesByComp = new Map<string, Record<string, PortHandle>>();

  for (const comp of components) {
    const pubMap: Record<string, PortHandle> = {};
    for (const hormoneId of comp.publish ?? []) {
      const hSpec = getHormoneSpec(hormoneId);
      const handle = allocPortSlots(`${comp.instanceId}.${hormoneId}`, {
        kind: 'analog',
        range: hSpec.range,
        description: hSpec.description,
      });
      pubMap[hormoneId] = handle;
      const list = hormonePublishers.get(hormoneId) ?? [];
      list.push(handle.offset);
      hormonePublishers.set(hormoneId, list);
    }
    publishHandlesByComp.set(comp.instanceId, pubMap);
  }

  const hormoneBroadcastHandle = new Map<string, PortHandle>();
  const allHormones = new Set<string>(hormonePublishers.keys());
  for (const comp of components) {
    for (const h of comp.subscribe ?? []) {
      getHormoneSpec(h);
      allHormones.add(h);
    }
  }

  for (const hormoneId of allHormones) {
    const hSpec = getHormoneSpec(hormoneId);
    const publishers = hormonePublishers.get(hormoneId) ?? [];
    if (publishers.length === 1) {
      hormoneBroadcastHandle.set(hormoneId, {
        offset: publishers[0] as number,
        count: 1,
        kind: 'analog',
        range: hSpec.range,
      });
    } else {
      const shared = allocPortSlots(hormoneId, {
        kind: 'analog',
        range: hSpec.range,
        description: hSpec.description,
      });
      if (publishers.length > 1) {
        mergeOps.push({
          sources: publishers,
          target: shared.offset,
          policy: hSpec.merge,
        });
      }
      hormoneBroadcastHandle.set(hormoneId, shared);
    }
  }

  for (const comp of components) {
    const subMap: Record<string, PortHandle> = {};
    for (const hormoneId of comp.subscribe ?? []) {
      subMap[hormoneId] = hormoneBroadcastHandle.get(hormoneId) as PortHandle;
    }
    subscribeHandlesByComp.set(comp.instanceId, subMap);
  }

  const bus = new SignalBus(specs, mergeOps);
  const handles = new Map<string, ResolvedComponentHandles>();
  for (const comp of components) {
    handles.set(comp.instanceId, {
      inputs: inputHandlesByComp.get(comp.instanceId) ?? {},
      outputs: outputHandlesByComp.get(comp.instanceId) ?? {},
      publish: publishHandlesByComp.get(comp.instanceId) ?? {},
      subscribe: subscribeHandlesByComp.get(comp.instanceId) ?? {},
    });
  }

  return { bus, handles, diagnostics };
}
