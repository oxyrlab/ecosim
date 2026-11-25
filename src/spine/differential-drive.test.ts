import { describe, expect, it } from 'vitest';
import { resolvePortMap } from '@body/sensors/sensor-def';
import type { PortHandle } from '@bus/ports';
import { resolveWiring, type ResolvedComponentHandles } from '@bus/wiring';
import { differentialDriveSpine } from './differential-drive';

describe('differentialDriveSpine', () => {
  it('maps forward, turn, and bite inputs to differential thruster, rotator, and mouth outputs', () => {
    const params = differentialDriveSpine.params.parse({ forwardGain: 1, turnGain: 0.8 });
    const { bus, handles } = resolveWiring(
      [
        {
          instanceId: 'brain',
          inputs: {},
          outputs: {
            fwd: { kind: 'analog', range: [-1, 1], description: 'fwd' },
            turn: { kind: 'analog', range: [-1, 1], description: 'turn' },
            bite: { kind: 'pulse', range: [0, 1], description: 'bite' },
          },
        },
        {
          instanceId: 'spine',
          inputs: resolvePortMap(differentialDriveSpine.inputs, params),
          outputs: resolvePortMap(differentialDriveSpine.outputs, params),
        },
      ],
      [
        { from: 'brain:fwd', to: 'spine:move.forward' },
        { from: 'brain:turn', to: 'spine:move.turn' },
        { from: 'brain:bite', to: 'spine:action.bite' },
      ],
    );

    const brainOut = (handles.get('brain') as ResolvedComponentHandles).outputs;
    const spineH = handles.get('spine') as ResolvedComponentHandles;
    const spine = differentialDriveSpine.create(params, {
      inputs: spineH.inputs as never,
      outputs: spineH.outputs as never,
    });

    bus.writer.set(brainOut['fwd'] as PortHandle, 0.6);
    bus.writer.set(brainOut['turn'] as PortHandle, 0.5);
    bus.writer.set(brainOut['bite'] as PortHandle, 1);
    bus.swap();

    spine.tick(bus.reader, bus.writer, 1 / 30);
    bus.swap();

    expect(bus.reader.get(spineH.outputs['left.power'] as PortHandle)).toBeCloseTo(1.0);
    expect(bus.reader.get(spineH.outputs['right.power'] as PortHandle)).toBeCloseTo(0.2);
    expect(bus.reader.get(spineH.outputs['rotator.turn'] as PortHandle)).toBeCloseTo(0.4);
    expect(bus.reader.get(spineH.outputs['mouth.bite'] as PortHandle)).toBe(1);
  });
});
