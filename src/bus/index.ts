export { getHormoneSpec, HORMONE_SPECS, type HormoneSpec } from './hormones';
export {
  PORT_BUNDLES,
  port,
  portMapToSpecs,
  type ChannelKind,
  type MergePolicy,
  type PortBuilderOptions,
  type PortDef,
  type PortHandle,
  type PortHandleMap,
  type PortMap,
  type PortReader,
  type PortSpec,
  type PortWriter,
} from './ports';
export { SignalBus, type ChannelSpec, type MergeOp } from './signal-bus';
export {
  inspectWiring,
  parseWireAddress,
  resolveWiring,
  type ResolvedComponentHandles,
  type ResolvedWiring,
  type WireSpec,
  type WiringDiagnostics,
  type WiringEndpoint,
} from './wiring';
