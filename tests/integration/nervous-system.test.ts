import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildPhysicsBodyFromLayout, resolveLayout } from '@appearance/index';
import {
  olfactorySensor,
  resolvePortMap,
  thrusterActuator,
  visionSensor,
  type ActuatorContext,
  type NeighborObservation,
  type SensorContext,
} from '@body/index';
import { defineBrainModule } from '@brain/index';
import { port, resolveWiring, type PortHandle, type ResolvedComponentHandles } from '@bus/index';
import { add, createEntityId, createSeededRng, rotate } from '@core/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import { differentialDriveSpine } from '@spine/index';
import { World } from '@world/index';

describe('Integration: Nervous System End-to-End (Section 9.4)', () => {
  it('vision-sensor -> SignalBus -> BrainModule -> differential-drive Spine -> mirrored visual thrusters -> Rapier turns toward target', async () => {
    const physics = await createRapierPhysicsAdapter();
    const world = new World(
      { seed: 42, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      physics,
    );

    // Creature body with torso + mirrored visual thrusters (thrust.l at -Y, thrust.r at +Y)
    const layout = resolveLayout([
      { id: 'torso', shape: { type: 'ellipse', w: 0.8, h: 0.4 } },
      {
        id: 'thruster-pod',
        parent: 'torso',
        at: { x: -0.5, y: -1.0 },
        joint: 'visual',
        mirror: true,
        shape: { type: 'capsule', length: 0.12, radius: 0.04 },
        actuator: { instanceId: 'thrust', actuator: 'thruster' },
      },
    ]);

    const creatureId = createEntityId(100);
    const built = buildPhysicsBodyFromLayout(layout, physics, { x: 10, y: 15 }, 0);

    // Place a visible plant target ahead and to the RIGHT (+Y)
    const plantId = world.spawnSimpleBody({
      position: { x: 16, y: 18 },
      radius: 0.4,
      bodyKind: 'fixed',
      tags: ['plant'],
    });

    // Simple steering brain module: turns toward seen plant bearing and moves forward
    const seekPlantModule = defineBrainModule({
      id: 'test-seek-plant',
      kind: 'rule',
      description: 'Steers toward visible plant.',
      params: z.object({}).default({}),
      inputs: {
        seen: port.analog({ range: [0, 1], description: 'plant proximity' }),
        dir: port.analog({ range: [-1, 1], description: 'plant bearing' }),
      },
      outputs: {
        forward: port.analog({ range: [-1, 1], description: 'forward' }),
        turn: port.analog({ range: [-1, 1], description: 'turn' }),
      },
      create(_params, { inputs, outputs }) {
        return {
          tick(input, output) {
            const seen = input.get(inputs.seen);
            output.set(outputs.forward, seen > 0 ? 0.6 : 0);
            output.set(outputs.turn, input.get(inputs.dir));
          },
        };
      },
    });

    const visionParams = visionSensor.params.parse({
      rangeMeters: 12,
      fovRadians: Math.PI,
      sectors: 8,
      tags: ['plant'],
    });
    const thrusterParams = thrusterActuator.params.parse({ maxForceNewtons: 0.5 });
    const spineParams = differentialDriveSpine.params.parse({ forwardGain: 0.6, turnGain: 0.35 });

    const { bus, handles } = resolveWiring(
      [
        {
          instanceId: 'eye',
          inputs: {},
          outputs: resolvePortMap(visionSensor.outputs, visionParams),
        },
        {
          instanceId: 'seek',
          inputs: resolvePortMap(seekPlantModule.inputs, {}),
          outputs: resolvePortMap(seekPlantModule.outputs, {}),
        },
        {
          instanceId: 'spine',
          inputs: resolvePortMap(differentialDriveSpine.inputs, spineParams),
          outputs: resolvePortMap(differentialDriveSpine.outputs, spineParams),
        },
        {
          instanceId: 'thrust.l',
          inputs: resolvePortMap(thrusterActuator.inputs, thrusterParams),
          outputs: {},
        },
        {
          instanceId: 'thrust.r',
          inputs: resolvePortMap(thrusterActuator.inputs, thrusterParams),
          outputs: {},
        },
      ],
      [
        { from: 'eye:seen.plant', to: 'seek:seen' },
        { from: 'eye:dir.plant', to: 'seek:dir' },
        { from: 'seek:forward', to: 'spine:move.forward' },
        { from: 'seek:turn', to: 'spine:move.turn' },
        { from: 'spine:left.power', to: 'thrust.l:power' },
        { from: 'spine:right.power', to: 'thrust.r:power' },
      ],
    );

    const eyeInst = visionSensor.create(visionParams, {
      outputs: (handles.get('eye') as ResolvedComponentHandles).outputs,
    });
    const brainInst = seekPlantModule.create({}, handles.get('seek') as never, createSeededRng(1));
    const spineInst = differentialDriveSpine.create(spineParams, handles.get('spine') as never);
    const leftThruster = thrusterActuator.create(thrusterParams, handles.get('thrust.l') as never);
    const rightThruster = thrusterActuator.create(thrusterParams, handles.get('thrust.r') as never);

    const leftPart = layout.byId.get('thruster-pod.l');
    const rightPart = layout.byId.get('thruster-pod.r');
    expect(leftPart?.physicalAncestorId).toBe('torso');
    expect(rightPart?.physicalAncestorId).toBe('torso');
    if (leftPart === undefined || rightPart === undefined)
      throw new Error('missing mirrored parts');

    const initialDist = Math.hypot(16 - 10, 18 - 15);
    const dt = 1 / 30;
    let totalEnergySpent = 0;

    for (let tick = 0; tick < 30; tick += 1) {
      const pose = physics.getBodyTransform(built.rootBody);
      const sensorCtx: SensorContext = {
        entityId: creatureId,
        position: pose.position,
        angle: pose.angle,
        queryNeighbors: (): readonly NeighborObservation[] => [
          { entityId: plantId, position: { x: 16, y: 18 }, radius: 0.4, tags: new Set(['plant']) },
        ],
        sampleField: () => 0,
        castRay: () => null,
      };

      // 1. Sensors -> 2. BusSwap -> 3. Brain -> 4. Spine -> 5. Actuators -> 6. Physics
      eyeInst.sample(sensorCtx, bus.writer);
      bus.swap();
      brainInst.tick(bus.reader, bus.writer, dt);
      spineInst.tick(bus.reader, bus.writer, dt);

      const makeActuatorCtx = (partLocalPos: { x: number; y: number }): ActuatorContext => ({
        entityId: creatureId,
        worldPosition: add(pose.position, rotate(partLocalPos, pose.angle)),
        worldAngle: pose.angle,
        applyForce: (force, point) => physics.applyForce(built.rootBody, force, point),
        applyImpulse: (imp, point) => physics.applyImpulse(built.rootBody, imp, point),
        applyTorque: (t) => physics.applyTorque(built.rootBody, t),
        emitField: () => {},
        consumeEnergy: (eu) => {
          totalEnergySpent += eu;
        },
        emitAction: () => {},
      });

      leftThruster.apply(makeActuatorCtx(leftPart.position), bus.reader, dt);
      rightThruster.apply(makeActuatorCtx(rightPart.position), bus.reader, dt);
      physics.step(dt);
    }

    const finalPose = physics.getBodyTransform(built.rootBody);
    const finalDist = Math.hypot(16 - finalPose.position.x, 18 - finalPose.position.y);
    // Target was at (16, 18) -> positive angle (+Y), moves forward and closer to target
    expect(finalPose.angle).toBeGreaterThan(0.15);
    expect(finalPose.angle).toBeLessThan(1.0);
    expect(finalPose.position.x).toBeGreaterThan(10.3);
    expect(finalPose.position.y).toBeGreaterThan(15.05);
    expect(finalDist).toBeLessThan(initialDist);
    expect(totalEnergySpent).toBeGreaterThan(0);

    built.removeAll();
    world.free();
  });

  it('scent emit -> GridField.diffuse -> olfactory-sensor produces gradient pointing toward source', () => {
    const world = new World(
      { seed: 7, widthMeters: 20, heightMeters: 20, gridCols: 20, gridRows: 20 },
      {
        step: () => {},
        createBody: () => 1 as never,
        removeBody: () => {},
        createCollider: () => 1 as never,
        removeCollider: () => {},
        createJoint: () => 1 as never,
        removeJoint: () => {},
        getBodyTransform: () => ({
          position: { x: 0, y: 0 },
          angle: 0,
          linearVelocity: { x: 0, y: 0 },
          angularVelocity: 0,
        }),
        setBodyTransform: () => {},
        setBodyVelocity: () => {},
        applyForce: () => {},
        applyImpulse: () => {},
        applyTorque: () => {},
        drainCollisionEvents: () => [],
        castRay: () => null,
        getStats: () => ({ bodyCount: 0, colliderCount: 0, jointCount: 0 }),
        free: () => {},
      },
    );

    const plantScent = world.fields.get('scent.plant');
    plantScent.addAtWorld(10.5, 7.5, 12); // scent source on the LEFT (-Y) of creature at (10.5, 10.5)
    for (let i = 0; i < 6; i += 1) {
      world.fields.stepDiffusion();
    }

    const params = olfactorySensor.params.parse({
      channels: ['scent.plant'],
      antennaSpreadMeters: 0.6,
      maxIntensity: 5,
    });
    const { bus, handles } = resolveWiring(
      [
        {
          instanceId: 'nose',
          inputs: {},
          outputs: resolvePortMap(olfactorySensor.outputs, params),
        },
      ],
      [],
    );
    const noseOutputs = (handles.get('nose') as ResolvedComponentHandles).outputs;
    const nose = olfactorySensor.create(params, { outputs: noseOutputs });

    nose.sample(
      {
        entityId: createEntityId(1),
        position: { x: 10.5, y: 10.5 },
        angle: 0, // facing +X, so -Y is left
        queryNeighbors: () => [],
        sampleField: (name, x, y) => world.fields.get(name).sampleBilinear(x, y),
        castRay: () => null,
      },
      bus.writer,
    );
    bus.swap();

    const grad = bus.reader.get(noseOutputs['gradient.scent.plant'] as PortHandle);
    const intensity = bus.reader.get(noseOutputs['intensity.scent.plant'] as PortHandle);
    expect(intensity).toBeGreaterThan(0);
    expect(grad).toBeLessThan(0); // negative gradient -> turn left (-Y) toward source

    world.free();
  });
});
