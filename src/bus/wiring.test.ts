import { describe, expect, it } from 'vitest';
import { WiringError } from '@core/index';
import { port, type PortHandle } from './ports';
import {
  parseWireAddress,
  resolveWiring,
  type ResolvedComponentHandles,
  type WiringEndpoint,
} from './wiring';

const portOf = (map: Readonly<Record<string, PortHandle>>, key: string): PortHandle =>
  map[key] as PortHandle;

describe('wiring resolver', () => {
  it('parses instance:port addresses including dotted mirrored ids and spatial array indices', () => {
    expect(parseWireAddress('thrust.l:power')).toEqual({
      raw: 'thrust.l:power',
      instanceId: 'thrust.l',
      portName: 'power',
      arrayIndex: undefined,
    });
    expect(parseWireAddress('eye.l:sector.distance[3]')).toEqual({
      raw: 'eye.l:sector.distance[3]',
      instanceId: 'eye.l',
      portName: 'sector.distance',
      arrayIndex: 3,
    });
    expect(() => parseWireAddress('missing-colon')).toThrow(WiringError);
    expect(() => parseWireAddress(':leading')).toThrow(WiringError);
    expect(() => parseWireAddress('a:b:c')).toThrow(WiringError);
  });

  it('resolves fan-out, merged fan-in, behavior bundle, spatial indexing, and broadcast hormones', () => {
    const components: WiringEndpoint[] = [
      {
        instanceId: 'skin-front',
        inputs: {},
        outputs: { pain: port.pulse({ description: 'front pain' }) },
        publish: ['hormone.adrenaline'],
      },
      {
        instanceId: 'skin-back',
        inputs: {},
        outputs: { pain: port.pulse({ description: 'back pain' }) },
        publish: ['hormone.adrenaline'],
      },
      {
        instanceId: 'eye',
        inputs: {},
        outputs: { sector: port.analog({ count: 4, description: 'sectors' }) },
      },
      {
        instanceId: 'fear',
        inputs: {
          pain: port.pulse({ description: 'merged pain', merge: 'max' }),
          frontSector: port.analog({ description: 'sector 0' }),
        },
        outputs: { ...port.bundle('behavior') },
        subscribe: ['hormone.adrenaline', 'hormone.satiety'],
      },
      {
        instanceId: 'arbiter',
        inputs: {
          ...port.bundle('behavior', 'flee'),
          extraPain: port.pulse({ description: 'direct pain' }),
        },
        outputs: {},
      },
    ];

    const resolved = resolveWiring(components, [
      { from: ['skin-front:pain', 'skin-back:pain'], to: 'fear:pain' },
      { from: 'skin-front:pain', to: 'arbiter:extraPain' },
      { from: 'eye:sector[1]', to: 'fear:frontSector' },
      { bundle: 'behavior', from: 'fear', to: 'arbiter:flee' },
    ]);

    const { bus, handles } = resolved;
    const skinFront = handles.get('skin-front') as ResolvedComponentHandles;
    const skinBack = handles.get('skin-back') as ResolvedComponentHandles;
    const eye = handles.get('eye') as ResolvedComponentHandles;
    const fear = handles.get('fear') as ResolvedComponentHandles;
    const arbiter = handles.get('arbiter') as ResolvedComponentHandles;

    bus.writer.set(portOf(skinFront.outputs, 'pain'), 0.4);
    bus.writer.set(portOf(skinBack.outputs, 'pain'), 0.9);
    bus.writer.set(portOf(skinFront.publish, 'hormone.adrenaline'), 0.3);
    bus.writer.set(portOf(skinBack.publish, 'hormone.adrenaline'), 0.8);
    bus.writer.set(portOf(eye.outputs, 'sector'), 0.75, 1);
    bus.writer.set(portOf(fear.outputs, 'urgency'), 0.95);
    bus.writer.set(portOf(fear.outputs, 'turn'), -0.5);
    bus.writer.set(portOf(fear.outputs, 'forward'), 1.0);

    bus.swap();

    expect(bus.reader.get(portOf(fear.inputs, 'pain'))).toBeCloseTo(0.9);
    expect(bus.reader.get(portOf(arbiter.inputs, 'extraPain'))).toBeCloseTo(0.4);
    expect(bus.reader.get(portOf(fear.inputs, 'frontSector'))).toBeCloseTo(0.75);
    expect(bus.reader.get(portOf(fear.subscribe, 'hormone.adrenaline'))).toBeCloseTo(0.8);
    expect(bus.reader.get(portOf(fear.subscribe, 'hormone.satiety'))).toBe(0);
    expect(bus.reader.get(portOf(arbiter.inputs, 'flee.urgency'))).toBeCloseTo(0.95);
    expect(bus.reader.get(portOf(arbiter.inputs, 'flee.turn'))).toBeCloseTo(-0.5);
    expect(bus.reader.get(portOf(arbiter.inputs, 'flee.forward'))).toBeCloseTo(1.0);
  });

  it('supports single hormone publisher, prefixed bundle sources, and target array indexing', () => {
    const components: WiringEndpoint[] = [
      {
        instanceId: 'src',
        inputs: {},
        outputs: {
          scalar: port.analog({ description: 'scalar' }),
          ...port.bundle('behavior', 'seek'),
        },
        publish: ['hormone.reward'],
      },
      {
        instanceId: 'dst',
        inputs: {
          arr: port.analog({ count: 2, description: 'array target', merge: 'sum' }),
          ...port.bundle('behavior'),
        },
        outputs: {},
        subscribe: ['hormone.reward'],
      },
    ];

    const { bus, handles } = resolveWiring(components, [
      { from: 'src:scalar', to: 'dst:arr[1]' },
      { bundle: 'behavior', from: 'src:seek', to: 'dst' },
    ]);

    const srcH = handles.get('src') as ResolvedComponentHandles;
    const dstH = handles.get('dst') as ResolvedComponentHandles;
    bus.writer.set(portOf(srcH.outputs, 'scalar'), 0.6);
    bus.writer.set(portOf(srcH.publish, 'hormone.reward'), 0.7);
    bus.writer.set(portOf(srcH.outputs, 'seek.urgency'), 0.5);
    bus.swap();

    expect(bus.reader.get(portOf(dstH.inputs, 'arr'), 1)).toBeCloseTo(0.6);
    expect(bus.reader.get(portOf(dstH.subscribe, 'hormone.reward'))).toBeCloseTo(0.7);
    expect(bus.reader.get(portOf(dstH.inputs, 'urgency'))).toBeCloseTo(0.5);

    // Target logical index and target array out-of-bounds errors
    expect(() => resolveWiring(components, [{ from: 'src:scalar', to: 'dst:urgency[0]' }])).toThrow(
      WiringError,
    );
    expect(() => resolveWiring(components, [{ from: 'src:scalar', to: 'dst:arr[5]' }])).toThrow(
      WiringError,
    );
  });

  it('rejects unmerged fan-in, logical numeric index, count mismatch, and missing endpoints', () => {
    const compA: WiringEndpoint = {
      instanceId: 'a',
      inputs: {},
      outputs: { out: port.analog({ description: 'a' }) },
    };
    const base: WiringEndpoint[] = [
      compA,
      {
        instanceId: 'b',
        inputs: {},
        outputs: {
          out: port.analog({ description: 'b' }),
          arr: port.analog({ count: 3, description: 'arr' }),
        },
      },
      { instanceId: 'c', inputs: { inp: port.analog({ description: 'no merge' }) }, outputs: {} },
    ];

    expect(() => resolveWiring(base, [{ from: ['a:out', 'b:out'], to: 'c:inp' }])).toThrow(
      WiringError,
    );
    expect(() => resolveWiring(base, [{ from: 'a:out[0]', to: 'c:inp' }])).toThrow(WiringError);
    expect(() => resolveWiring(base, [{ from: 'b:arr', to: 'c:inp' }])).toThrow(WiringError);
    expect(() => resolveWiring(base, [{ from: 'b:arr[5]', to: 'c:inp' }])).toThrow(WiringError);
    expect(() => resolveWiring(base, [{ from: 'ghost:out', to: 'c:inp' }])).toThrow(WiringError);
    expect(() => resolveWiring(base, [{ from: 'a:missing', to: 'c:inp' }])).toThrow(WiringError);
    expect(() => resolveWiring(base, [{ from: 'a:out', to: 'ghost:inp' }])).toThrow(WiringError);
    expect(() => resolveWiring(base, [{ from: 'a:out', to: 'c:missing' }])).toThrow(WiringError);
    expect(() => resolveWiring(base, [{ bundle: 'bad', from: 'a', to: 'c' }])).toThrow(WiringError);
    expect(() => resolveWiring([compA, compA], [])).toThrow(WiringError);
  });
});
