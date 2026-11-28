import '@brain/index';
import './flee-predator';
import { defineSpecies, type AnimalSpeciesBlueprint } from '../blueprint';

/**
 * Canonical reference animal species (`rabbit`) per Section 10.3 & Phase 5.
 * Herbivore with procedural silhouette (torso, head, long mirrored ears, mirrored paw thrusters,
 * mouth bite, cotton tail), vision + olfactory + energy + pain sensors, shared foraging/wander/
 * arbiter modules, and species-specific `rabbit-flee-predator` reflex.
 */
export const RABBIT_BLUEPRINT: AnimalSpeciesBlueprint = defineSpecies({
  id: 'rabbit',
  name: 'Meadow Rabbit',
  description:
    'Reference herbivore species foraging on plants and berries while fleeing predators.',
  kingdom: 'animal',
  tags: ['animal', 'herbivore', 'prey', 'rabbit'],
  stubColor: 0xe5e7eb,
  body: {
    parts: [
      {
        id: 'torso',
        z: 1,
        shape: { type: 'ellipse', w: 0.44, h: 0.26 },
        massDensity: 12,
        style: { fill: { h: 35, s: 0.22, l: 0.72 } },
        sensors: [
          { instanceId: 'energy', sensor: 'energy-sensor' },
          { instanceId: 'pain', sensor: 'pain-sensor' },
          { instanceId: 'repro', sensor: 'reproductive-sensor' },
        ],
        actuator: {
          instanceId: 'turner',
          actuator: 'rotator',
          params: { maxTorqueNewtonMeters: 0.9, energyPerTorqueSecond: 0.02 },
        },
      },
      {
        id: 'head',
        parent: 'torso',
        at: 'front',
        pivot: 'back',
        z: 2,
        shape: { type: 'circle', r: 0.12 },
        massDensity: 10,
        style: { fill: { h: 35, s: 0.2, l: 0.78 } },
        sensors: [
          {
            instanceId: 'eyes',
            sensor: 'vision-sensor',
            params: {
              rangeMeters: 9,
              fovRadians: Math.PI * 1.15,
              sectors: 6,
              tags: ['plant', 'fruit', 'predator'],
            },
          },
          {
            instanceId: 'nose',
            sensor: 'olfactory-sensor',
            params: {
              channels: ['scent.plant', 'scent.predator'],
              antennaSpreadMeters: 0.18,
              maxIntensity: 6,
            },
          },
        ],
        actuator: {
          instanceId: 'mouth',
          actuator: 'bite',
          params: { rangeMeters: 0.65, damage: 8, cooldownSeconds: 0.6, energyCostPerBite: 0.25 },
        },
      },
      {
        id: 'ear',
        parent: 'head',
        at: { x: -0.1, y: -0.85 },
        angle: -0.35,
        z: 3,
        joint: 'visual',
        mirror: true,
        shape: { type: 'ellipse', w: 0.16, h: 0.055 },
        style: { fill: { h: 35, s: 0.18, l: 0.82 } },
      },
      {
        id: 'paw',
        parent: 'torso',
        at: { x: -0.35, y: -0.9 },
        z: 0,
        joint: 'visual',
        mirror: true,
        shape: { type: 'capsule', length: 0.1, radius: 0.035 },
        style: { fill: { h: 35, s: 0.15, l: 0.65 } },
        actuator: {
          instanceId: 'thrust',
          actuator: 'thruster',
          params: { maxForceNewtons: 12, energyPerNewtonSecond: 0.006 },
        },
        anim: [{ kind: 'swing', channel: '$actuator:power', amplitude: 0.4 }],
      },
      {
        id: 'tail',
        parent: 'torso',
        at: 'back',
        pivot: 'front',
        z: 0,
        joint: 'visual',
        shape: { type: 'circle', r: 0.06 },
        style: { fill: { h: 35, s: 0.1, l: 0.94 } },
      },
    ],
  },
  brain: {
    modules: [
      { instanceId: 'hunger', module: 'hunger-drive', params: { threshold: 0.1, gain: 1.3 } },
      {
        instanceId: 'forage',
        module: 'seek-gradient',
        params: { forwardSpeed: 0.65, biteProximityThreshold: 0.9 },
      },
      { instanceId: 'flee', module: 'rabbit-flee-predator' },
      {
        instanceId: 'wander',
        module: 'random-wander',
        params: { baseUrgency: 0.18, cruiseSpeed: 0.32, maxTurnRate: 0.55 },
      },
      {
        instanceId: 'arbiter',
        module: 'behavior-arbiter',
        params: { slots: ['flee', 'forage', 'wander'], weights: { flee: 1.8, forage: 1.1 } },
      },
    ],
  },
  spine: {
    instanceId: 'spine',
    spine: 'differential-drive',
    params: { forwardGain: 1, turnGain: 1, differentialTurnScale: 0 },
  },
  wiring: [
    // Energy -> Hunger -> Forage drive
    { from: 'energy:deficit', to: 'hunger:deficit' },
    { from: 'hunger:urge', to: 'forage:drive' },
    // Plant vision & scent -> Forage
    { from: 'eyes:seen.plant', to: 'forage:seen' },
    { from: 'eyes:dir.plant', to: 'forage:dir' },
    { from: 'nose:intensity.scent.plant', to: 'forage:scent.intensity' },
    { from: 'nose:gradient.scent.plant', to: 'forage:scent.gradient' },
    // Predator vision, scent, and pain -> Flee
    { from: 'eyes:seen.predator', to: 'flee:seen.predator' },
    { from: 'eyes:dir.predator', to: 'flee:dir.predator' },
    { from: 'nose:intensity.scent.predator', to: 'flee:scent.intensity' },
    { from: 'nose:gradient.scent.predator', to: 'flee:scent.gradient' },
    { from: 'pain:pain', to: 'flee:pain' },
    // Behavior bundles -> Arbiter
    { bundle: 'behavior', from: 'flee', to: 'arbiter:flee' },
    { bundle: 'behavior', from: 'forage', to: 'arbiter:forage' },
    { bundle: 'behavior', from: 'wander', to: 'arbiter:wander' },
    { from: 'forage:bite', to: 'arbiter:bite.in' },
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
    initialEnergyRange: [52, 78],
    maxEnergy: 100,
    structuralEnergy: 15,
    basalRatePerKgPerSecond: 0.42,
    brainUpkeepPerModulePerSecond: 0.02,
    starvationDamagePerSecond: 3,
  },
  diet: {
    assimilationEfficiency: 0.78,
    edibleTags: ['plant', 'fruit'],
  },
  lifecycle: {
    maxAgeSeconds: 1050,
    maxAgeRange: [900, 1200],
    maturityAgeSeconds: 60,
    initialAgeRange: [80, 240],
    juvenileScale: 0.48,
    adultScale: 1,
    adultScaleRange: [0.85, 1.15],
    senescenceStartFraction: 0.78,
    minSenescenceEfficiency: 0.55,
    maxHealth: 25,
    energyPerDamage: 1.5,
  },
  scentEmission: {
    field: 'scent.prey',
    ratePerSecond: 1.2,
  },
});
