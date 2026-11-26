import '@brain/index';
import './hunt-prey';
import { defineSpecies, type AnimalSpeciesBlueprint } from '../blueprint';

/**
 * Built-in carnivore predator species (`fox`) per Phase 5.
 * Hunts `prey` (rabbits) and scavenges `corpse` entities using vision + olfactory tracking,
 * differential-drive paws, articulated tail, and strong bite actuator.
 */
export const FOX_BLUEPRINT: AnimalSpeciesBlueprint = defineSpecies({
  id: 'fox',
  name: 'Red Fox',
  description: 'Agile carnivore hunting prey by sight and scent while emitting predator scent.',
  kingdom: 'animal',
  tags: ['animal', 'carnivore', 'predator', 'fox'],
  stubColor: 0xea580c,
  body: {
    parts: [
      {
        id: 'torso',
        z: 1,
        shape: { type: 'ellipse', w: 0.62, h: 0.3 },
        style: { fill: { h: 22, s: 0.78, l: 0.48 } },
        sensors: [
          { instanceId: 'energy', sensor: 'energy-sensor' },
          { instanceId: 'pain', sensor: 'pain-sensor' },
        ],
        actuator: {
          instanceId: 'turner',
          actuator: 'rotator',
          params: { maxTorqueNewtonMeters: 3.2 },
        },
      },
      {
        id: 'head',
        parent: 'torso',
        at: 'front',
        pivot: 'back',
        z: 2,
        shape: { type: 'triangle', w: 0.24, h: 0.26 },
        style: { fill: { h: 22, s: 0.75, l: 0.52 } },
        sensors: [
          {
            instanceId: 'eyes',
            sensor: 'vision-sensor',
            params: {
              rangeMeters: 12,
              fovRadians: Math.PI * 0.85,
              sectors: 6,
              tags: ['prey', 'corpse'],
            },
          },
          {
            instanceId: 'nose',
            sensor: 'olfactory-sensor',
            params: {
              channels: ['scent.prey', 'scent.corpse'],
              antennaSpreadMeters: 0.22,
              maxIntensity: 6,
            },
          },
        ],
        actuator: {
          instanceId: 'mouth',
          actuator: 'bite',
          params: { rangeMeters: 0.6, damage: 12, cooldownSeconds: 0.7 },
        },
      },
      {
        id: 'ear',
        parent: 'head',
        at: { x: -0.25, y: -0.8 },
        angle: -0.25,
        z: 3,
        joint: 'visual',
        mirror: true,
        shape: { type: 'triangle', w: 0.08, h: 0.1 },
        style: { fill: { h: 18, s: 0.65, l: 0.28 } },
      },
      {
        id: 'paw',
        parent: 'torso',
        at: { x: -0.35, y: -0.95 },
        z: 0,
        joint: 'visual',
        mirror: true,
        shape: { type: 'capsule', length: 0.12, radius: 0.04 },
        style: { fill: { h: 20, s: 0.4, l: 0.22 } },
        actuator: {
          instanceId: 'thrust',
          actuator: 'thruster',
          params: { maxForceNewtons: 7, energyPerNewtonSecond: 0.025 },
        },
        anim: [{ kind: 'swing', channel: '$actuator:power', amplitude: 0.35 }],
      },
      {
        id: 'tail',
        parent: 'torso',
        at: 'back',
        pivot: 'front',
        z: 0,
        shape: { type: 'capsule', length: 0.3, radius: 0.055 },
        massDensity: 1.2,
        joint: { type: 'revolute', limits: [-0.55, 0.55] },
        style: { fill: { h: 24, s: 0.8, l: 0.54 } },
      },
    ],
  },
  brain: {
    modules: [
      { instanceId: 'hunger', module: 'hunger-drive', params: { threshold: 0.05, gain: 1.4 } },
      { instanceId: 'hunt', module: 'fox-hunt-prey' },
      {
        instanceId: 'scavenge',
        module: 'seek-gradient',
        params: { forwardSpeed: 0.7, biteProximityThreshold: 0.85 },
      },
      { instanceId: 'wander', module: 'random-wander', params: { baseUrgency: 0.2 } },
      {
        instanceId: 'arbiter',
        module: 'behavior-arbiter',
        params: { slots: ['hunt', 'scavenge', 'wander'], weights: { hunt: 1.4, scavenge: 1.1 } },
      },
    ],
  },
  spine: {
    instanceId: 'spine',
    spine: 'differential-drive',
    params: { forwardGain: 1, turnGain: 1 },
  },
  wiring: [
    // Energy -> Hunger -> Hunt & Scavenge drives
    { from: 'energy:deficit', to: 'hunger:deficit' },
    { from: 'hunger:urge', to: ['hunt:drive', 'scavenge:drive'] },
    // Prey vision & scent -> Hunt
    { from: 'eyes:seen.prey', to: 'hunt:seen.prey' },
    { from: 'eyes:dir.prey', to: 'hunt:dir.prey' },
    { from: 'nose:intensity.scent.prey', to: 'hunt:scent.intensity' },
    { from: 'nose:gradient.scent.prey', to: 'hunt:scent.gradient' },
    // Corpse vision & scent -> Scavenge
    { from: 'eyes:seen.corpse', to: 'scavenge:seen' },
    { from: 'eyes:dir.corpse', to: 'scavenge:dir' },
    { from: 'nose:intensity.scent.corpse', to: 'scavenge:scent.intensity' },
    { from: 'nose:gradient.scent.corpse', to: 'scavenge:scent.gradient' },
    // Behavior bundles -> Arbiter
    { bundle: 'behavior', from: 'hunt', to: 'arbiter:hunt' },
    { bundle: 'behavior', from: 'scavenge', to: 'arbiter:scavenge' },
    { bundle: 'behavior', from: 'wander', to: 'arbiter:wander' },
    { from: ['hunt:bite', 'scavenge:bite'], to: 'arbiter:bite.in' },
    // Arbiter -> Spine -> Actuators
    { from: 'arbiter:move.forward', to: 'spine:move.forward' },
    { from: 'arbiter:move.turn', to: 'spine:move.turn' },
    { from: 'arbiter:action.bite', to: 'spine:action.bite' },
    { from: 'spine:left.power', to: 'thrust.l:power' },
    { from: 'spine:right.power', to: 'thrust.r:power' },
    { from: 'spine:rotator.turn', to: 'turner:turn' },
    { from: 'spine:mouth.bite', to: 'mouth:trigger' },
  ],
  metabolism: {
    initialEnergy: 65,
    maxEnergy: 120,
    structuralEnergy: 18,
    basalRatePerKgPerSecond: 0.4,
    brainUpkeepPerModulePerSecond: 0.025,
    starvationDamagePerSecond: 3.5,
  },
  diet: {
    assimilationEfficiency: 0.82,
    edibleTags: ['prey', 'corpse'],
  },
  lifecycle: {
    maxAgeSeconds: 240,
    maturityAgeSeconds: 30,
    juvenileScale: 0.65,
    adultScale: 1,
    senescenceStartFraction: 0.78,
    minSenescenceEfficiency: 0.55,
    maxHealth: 45,
    energyPerDamage: 1.5,
  },
  scentEmission: {
    field: 'scent.predator',
    ratePerSecond: 1.5,
  },
});
