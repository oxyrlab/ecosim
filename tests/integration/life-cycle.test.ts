import { describe, expect, it } from 'vitest';
import {
  biteActuator,
  painSensor,
  resolvePortMap,
  type ActuatorActionEvent,
  type ActuatorContext,
} from '@body/index';
import { resolveWiring, type PortHandle } from '@bus/index';
import {
  computeWorldEnergy,
  CorpseComponent,
  DietComponent,
  EnergyComponent,
  EnergyLedger,
  HealthComponent,
  LifecycleComponent,
  stepAgingSystem,
  stepDeathSystem,
  stepDecompositionSystem,
  stepHealthSystem,
  stepInteractionSystem,
  stepMetabolismSystem,
} from '@life/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import { World } from '@world/index';

describe('Integration: Life, Predation, Death, Decomposition & EnergyLedger (Section 9.4)', () => {
  it('predator bites prey -> pain pulse, damage, energy transfer, death -> corpse -> soil.nutrients with exact conservation and zero WASM leaks', async () => {
    const physics = await createRapierPhysicsAdapter();
    const world = new World(
      { seed: 77, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
      physics,
    );
    const ledger = new EnergyLedger();
    const wallBodyCount = physics.getStats().bodyCount;

    const predator = world.spawnSimpleBody({
      position: { x: 8, y: 10 },
      radius: 0.45,
      tags: ['predator', 'carnivore'],
    });
    const predatorEnergy = {
      current: 40,
      max: 120,
      massKg: 1.5,
      basalRatePerKgPerSecond: 0.4,
      brainUpkeepPerSecond: 0.2,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 4,
      structuralEnergy: 15,
    };
    world.ecs.addComponent(predator, EnergyComponent, predatorEnergy);
    world.ecs.addComponent(predator, HealthComponent, {
      current: 40,
      max: 40,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1,
    });
    world.ecs.addComponent(predator, DietComponent, {
      assimilationEfficiency: 0.75,
      edibleTags: ['prey', 'corpse'],
    });
    world.ecs.addComponent(predator, LifecycleComponent, {
      ageSeconds: 10,
      maxAgeSeconds: 200,
      maturityAgeSeconds: 20,
      juvenileScale: 0.6,
      adultScale: 1,
      senescenceStartFraction: 0.7,
      minSenescenceEfficiency: 0.5,
      currentScale: 0.8,
      efficiency: 1,
    });

    const prey = world.spawnSimpleBody({
      position: { x: 8.5, y: 10 },
      radius: 0.3,
      tags: ['prey', 'herbivore'],
    });
    world.ecs.addComponent(prey, EnergyComponent, {
      current: 24,
      max: 60,
      massKg: 0.8,
      basalRatePerKgPerSecond: 0.3,
      brainUpkeepPerSecond: 0.1,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 4,
      structuralEnergy: 12,
    });
    world.ecs.addComponent(prey, HealthComponent, {
      current: 12,
      max: 12,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1.0,
    });

    // Record initial closed-world energy
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    // Wire predator's bite actuator and prey's internal pain-sensor
    const biteParams = biteActuator.params.parse({
      damage: 12,
      rangeMeters: 0.8,
      cooldownSeconds: 0.2,
      energyCostPerBite: 1.5,
    });
    const { bus: predBus, handles: predH } = resolveWiring(
      [
        {
          instanceId: 'brain',
          inputs: {},
          outputs: { bite: { kind: 'pulse', range: [0, 1], description: 'bite' } },
        },
        {
          instanceId: 'mouth',
          inputs: resolvePortMap(biteActuator.inputs, biteParams),
          outputs: {},
        },
      ],
      [{ from: 'brain:bite', to: 'mouth:trigger' }],
    );
    const mouthInst = biteActuator.create(biteParams, {
      inputs: predH.get('mouth')?.inputs as { trigger: PortHandle },
    });

    const painParams = painSensor.params.parse(undefined);
    const { bus: preyBus, handles: preyH } = resolveWiring(
      [{ instanceId: 'skin', inputs: {}, outputs: resolvePortMap(painSensor.outputs, painParams) }],
      [],
    );
    const preySkinOut = preyH.get('skin')?.outputs as { pain: PortHandle; health: PortHandle };
    const preyPainInst = painSensor.create(painParams, { outputs: preySkinOut });

    // Tick 1: predator triggers a lethal bite
    predBus.writer.set(predH.get('brain')?.outputs['bite'] as PortHandle, 1);
    predBus.swap();

    const emittedActions: ActuatorActionEvent[] = [];
    const actCtx: ActuatorContext = {
      entityId: predator,
      worldPosition: { x: 8.2, y: 10 },
      worldAngle: 0,
      applyForce: () => {},
      applyImpulse: () => {},
      applyTorque: () => {},
      emitField: () => {},
      consumeEnergy: (eu) => {
        predatorEnergy.pendingActuatorCost += eu;
      },
      emitAction: (ev) => emittedActions.push(ev),
    };

    const dt = 0.25;
    mouthInst.apply(actCtx, predBus.reader, dt);
    expect(emittedActions).toHaveLength(1);

    const biteResults = stepInteractionSystem(world, emittedActions, ledger);
    expect(biteResults).toHaveLength(1);
    expect(biteResults[0]?.targetEntityId).toBe(prey);
    expect(biteResults[0]?.energyAssimilated).toBeCloseTo(9); // 12 * 0.75

    // Prey's pain-sensor detects the bite before health resolves death
    const preyHealth = world.ecs.requireComponent(prey, HealthComponent);
    preyPainInst.sample(
      {
        entityId: prey,
        position: { x: 8.5, y: 10 },
        angle: 0,
        bodyState: {
          energyRatio: 0.5,
          healthRatio: preyHealth.current / preyHealth.max,
          painPulse: preyHealth.recentPainPulse,
        },
        queryNeighbors: () => [],
        sampleField: () => 0,
        castRay: () => null,
      },
      preyBus.writer,
    );
    preyBus.swap();
    expect(preyBus.reader.get(preySkinOut.pain)).toBe(1);

    // Run life systems in fixed loop order (Section 5.12)
    stepMetabolismSystem(world, dt, ledger);
    stepAgingSystem(world, dt);
    stepHealthSystem(world, dt);
    const deaths = stepDeathSystem(world, ledger, { defaultCorpseDecayRatePerSecond: 6 });

    expect(deaths).toHaveLength(1);
    expect(deaths[0]?.deadEntityId).toBe(prey);
    const corpseId = deaths[0]?.corpseEntityId;
    expect(corpseId).not.toBeNull();
    expect(world.ecs.isAlive(prey)).toBe(false);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Decompose corpse completely into soil.nutrients over several seconds
    for (let step = 0; step < 25; step += 1) {
      stepMetabolismSystem(world, dt, ledger);
      stepAgingSystem(world, dt);
      stepHealthSystem(world, dt);
      stepDecompositionSystem(world, dt, ledger);
      world.fields.stepDiffusion();
    }

    expect(world.ecs.query(CorpseComponent)).toHaveLength(0);
    expect(world.fields.get('soil.nutrients').totalMass()).toBeGreaterThan(20);
    expect(world.fields.get('scent.corpse').totalMass()).toBeGreaterThan(0);

    // Exact EnergyLedger conservation audit after metabolism + predation + death + decomposition
    const audit = ledger.audit(computeWorldEnergy(world), 1e-2);
    expect(audit.balanced).toBe(true);

    // Removing the remaining predator leaves only the boundary walls (zero Rapier WASM handle leaks)
    world.removeEntity(predator);
    expect(physics.getStats().bodyCount).toBe(wallBodyCount);

    world.free();
  });
});
