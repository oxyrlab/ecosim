import { describe, expect, it } from 'vitest';
import { chain, shapeRegistry } from '@appearance/index';
import { actuatorRegistry, organRegistry, sensorRegistry } from '@body/index';
import { brainModuleRegistry } from '@brain/index';
import { port } from '@bus/index';
import { ruleRegistry, type BlueprintBodySubject } from '@rules/index';
import { speciesRegistry } from '@species/index';
import { spineRegistry } from '@spine/index';
import { CAT_BODY_FIXTURE, CONCAVE_ARROW_BODY_FIXTURE } from '../fixtures/creatures';
import {
  runActuatorContract,
  runBrainModuleContract,
  runOrganContract,
  runSensorContract,
  runSpineContract,
} from './nervous-system-contracts';
import { runRuleContract, type RuleContractFixtures } from './rule-contract';
import { runShapeContract, type ShapeContractFixtures } from './shape-contract';

const SHAPE_FIXTURES: Readonly<Record<string, ShapeContractFixtures>> = {
  circle: { validParams: { r: 0.3 }, invalidParams: { r: -1 } },
  ellipse: { validParams: { w: 0.6, h: 0.3 }, invalidParams: { w: 0, h: 0.3 } },
  rect: { validParams: { w: 0.5, h: 0.25, cornerRadius: 0.05 }, invalidParams: { w: -1, h: 0.2 } },
  capsule: {
    validParams: { length: 0.3, radius: 0.05 },
    invalidParams: { length: -1, radius: 0.05 },
  },
  triangle: { validParams: { w: 0.2, h: 0.15 }, invalidParams: { w: 0.2, h: 0 } },
  polygon: { validParams: { sides: 6, r: 0.25 }, invalidParams: { sides: 2, r: 0.25 } },
  convex: {
    validParams: {
      points: [
        { x: 0.3, y: 0 },
        { x: 0, y: 0.2 },
        { x: -0.3, y: 0 },
        { x: 0, y: -0.2 },
      ],
    },
    invalidParams: { points: [{ x: 0, y: 0 }] },
  },
};

const VALID_NERVOUS_SUBJECT: BlueprintBodySubject = {
  ...CAT_BODY_FIXTURE,
  brain: { modules: [{ instanceId: 'seek' }] },
  nervousGraph: {
    endpoints: [
      { instanceId: 'a', inputs: {}, outputs: { out: port.analog({ description: 'a' }) } },
      {
        instanceId: 'b',
        inputs: { inp: port.analog({ description: 'b', merge: 'max' }) },
        outputs: {},
      },
    ],
    wires: [{ from: 'a:out', to: 'b:inp' }],
  },
};

const RULE_FIXTURES: Readonly<Record<string, RuleContractFixtures<BlueprintBodySubject>>> = {
  'max-parts-per-creature': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: {
      body: { parts: chain({ count: 20, shape: { type: 'circle', r: 0.1 } }) },
    },
  },
  'max-rigid-bodies-per-creature': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: {
      body: { parts: chain({ count: 8, shape: { type: 'circle', r: 0.1 } }) },
    },
  },
  'max-joint-chain-length': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: {
      body: { parts: chain({ count: 10, shape: { type: 'circle', r: 0.1 } }) },
    },
  },
  'max-mass-ratio-jointed': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: {
      body: {
        parts: [
          { id: 'heavy', shape: { type: 'circle', r: 1 } },
          {
            id: 'tiny',
            parent: 'heavy',
            at: 'back',
            pivot: 'front',
            joint: { type: 'revolute' },
            shape: { type: 'circle', r: 0.05 },
          },
        ],
      },
    },
  },
  'min-collider-size': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: {
      body: { parts: [{ id: 'dust', shape: { type: 'circle', r: 0.005 } }] },
    },
  },
  'max-animated-parts': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 0.3 } },
          ...Array.from({ length: 7 }, (_, i) => ({
            id: `fin-${i}`,
            parent: 'torso',
            joint: 'visual' as const,
            shape: { type: 'triangle', w: 0.08, h: 0.05 },
            anim: [{ kind: 'wag' as const, channel: 'fear:level', amplitude: 0.2 }],
          })),
        ],
      },
    },
  },
  'max-convex-vertices': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: {
      body: { parts: [{ id: 'hi-poly', shape: { type: 'polygon', sides: 24, r: 0.3 } }] },
    },
  },
  'collider-concave-strategy': {
    validSubject: CAT_BODY_FIXTURE,
    violatingSubject: CONCAVE_ARROW_BODY_FIXTURE,
    params: { strategy: 'reject' },
  },
  'max-sensors-per-creature': {
    validSubject: VALID_NERVOUS_SUBJECT,
    violatingSubject: {
      body: {
        parts: [
          {
            id: 'torso',
            shape: { type: 'circle', r: 0.3 },
            sensors: Array.from({ length: 9 }, (_, i) => ({
              instanceId: `s-${i}`,
              sensor: 'vision-sensor',
            })),
          },
        ],
      },
    },
  },
  'max-brain-modules': {
    validSubject: VALID_NERVOUS_SUBJECT,
    violatingSubject: {
      ...CAT_BODY_FIXTURE,
      brain: { modules: Array.from({ length: 13 }, (_, i) => ({ instanceId: `m-${i}` })) },
    },
  },
  'max-bus-channels': {
    validSubject: VALID_NERVOUS_SUBJECT,
    violatingSubject: {
      ...CAT_BODY_FIXTURE,
      nervousGraph: {
        endpoints: [
          {
            instanceId: 'big',
            inputs: {},
            outputs: { arr: port.analog({ count: 600, description: 'huge' }) },
          },
        ],
        wires: [],
      },
    },
  },
  'unmerged-fan-in': {
    validSubject: VALID_NERVOUS_SUBJECT,
    violatingSubject: {
      ...CAT_BODY_FIXTURE,
      nervousGraph: {
        endpoints: [
          { instanceId: 'a', inputs: {}, outputs: { out: port.analog({ description: 'a' }) } },
          { instanceId: 'b', inputs: {}, outputs: { out: port.analog({ description: 'b' }) } },
          {
            instanceId: 'c',
            inputs: { inp: port.analog({ description: 'no merge' }) },
            outputs: {},
          },
        ],
        wires: [{ from: ['a:out', 'b:out'], to: 'c:inp' }],
      },
    },
  },
  'unconnected-input': {
    validSubject: VALID_NERVOUS_SUBJECT,
    violatingSubject: {
      ...CAT_BODY_FIXTURE,
      nervousGraph: {
        endpoints: [
          {
            instanceId: 'c',
            inputs: { inp: port.analog({ description: 'dangling' }) },
            outputs: {},
          },
        ],
        wires: [],
      },
    },
  },
  'unused-output': {
    validSubject: VALID_NERVOUS_SUBJECT,
    violatingSubject: {
      ...CAT_BODY_FIXTURE,
      nervousGraph: {
        endpoints: [
          {
            instanceId: 'a',
            inputs: {},
            outputs: { unused: port.analog({ description: 'unused' }) },
          },
        ],
        wires: [],
      },
    },
  },
  'numeric-index-on-logical-port': {
    validSubject: VALID_NERVOUS_SUBJECT,
    violatingSubject: {
      ...CAT_BODY_FIXTURE,
      nervousGraph: {
        endpoints: [
          { instanceId: 'a', inputs: {}, outputs: { out: port.analog({ description: 'scalar' }) } },
          { instanceId: 'b', inputs: { inp: port.analog({ description: 'scalar' }) }, outputs: {} },
        ],
        wires: [{ from: 'a:out[0]', to: 'b:inp' }],
      },
    },
  },
};

const SENSOR_FIXTURES: Readonly<Record<string, { validParams: unknown; invalidParams: unknown }>> =
  {
    'vision-sensor': { validParams: {}, invalidParams: { rangeMeters: -1 } },
    'olfactory-sensor': { validParams: {}, invalidParams: { channels: [] } },
    'energy-sensor': { validParams: {}, invalidParams: 'invalid' },
    'pain-sensor': { validParams: {}, invalidParams: 'invalid' },
  };

const ACTUATOR_FIXTURES: Readonly<
  Record<string, { validParams: unknown; invalidParams: unknown }>
> = {
  thruster: { validParams: {}, invalidParams: { maxForceNewtons: 0 } },
  rotator: { validParams: {}, invalidParams: { maxTorqueNewtonMeters: -2 } },
  bite: { validParams: {}, invalidParams: { damage: -5 } },
};

const SPINE_FIXTURES: Readonly<Record<string, { validParams: unknown; invalidParams: unknown }>> = {
  'differential-drive': { validParams: {}, invalidParams: { turnGain: 0 } },
};

const BRAIN_MODULE_FIXTURES: Readonly<
  Record<string, { validParams: unknown; invalidParams: unknown }>
> = {
  'hunger-drive': { validParams: {}, invalidParams: { threshold: 2 } },
  'seek-gradient': { validParams: {}, invalidParams: { visionTurnGain: 0 } },
  'random-wander': { validParams: {}, invalidParams: { turnIntervalSeconds: 0 } },
  'behavior-arbiter': { validParams: {}, invalidParams: { slots: [] } },
  'rabbit-flee-predator': { validParams: {}, invalidParams: { escapeSpeed: 2 } },
  'fox-hunt-prey': { validParams: {}, invalidParams: { chaseSpeed: 0 } },
};

describe('Automatic registry contract coverage', () => {
  it('covers every registered shape, rule, organ, sensor, actuator, brain module, spine, and species', () => {
    expect(shapeRegistry.size).toBe(7);
    expect(ruleRegistry.size).toBe(15);
    expect(organRegistry.size).toBe(4);
    expect(sensorRegistry.size).toBe(4);
    expect(actuatorRegistry.size).toBe(3);
    expect(brainModuleRegistry.size).toBe(6);
    expect(spineRegistry.size).toBe(1);
    expect(speciesRegistry.size).toBe(4);

    for (const def of shapeRegistry.list()) expect(SHAPE_FIXTURES[def.id]).toBeDefined();
    for (const def of ruleRegistry.list()) expect(RULE_FIXTURES[def.id]).toBeDefined();
    for (const def of sensorRegistry.list()) expect(SENSOR_FIXTURES[def.id]).toBeDefined();
    for (const def of actuatorRegistry.list()) expect(ACTUATOR_FIXTURES[def.id]).toBeDefined();
    for (const def of brainModuleRegistry.list()) {
      expect(BRAIN_MODULE_FIXTURES[def.id]).toBeDefined();
    }
    for (const def of spineRegistry.list()) expect(SPINE_FIXTURES[def.id]).toBeDefined();
  });
});

for (const def of shapeRegistry.list()) {
  const f = SHAPE_FIXTURES[def.id];
  if (f !== undefined) runShapeContract(def, f);
}
for (const def of ruleRegistry.list()) {
  const f = RULE_FIXTURES[def.id];
  if (f !== undefined) runRuleContract(def, f);
}
for (const def of organRegistry.list()) runOrganContract(def);
for (const def of sensorRegistry.list()) {
  const f = SENSOR_FIXTURES[def.id];
  if (f !== undefined) runSensorContract(def, f);
}
for (const def of actuatorRegistry.list()) {
  const f = ACTUATOR_FIXTURES[def.id];
  if (f !== undefined) runActuatorContract(def, f);
}
for (const def of brainModuleRegistry.list()) {
  const f = BRAIN_MODULE_FIXTURES[def.id];
  if (f !== undefined) runBrainModuleContract(def, f);
}
for (const def of spineRegistry.list()) {
  const f = SPINE_FIXTURES[def.id];
  if (f !== undefined) runSpineContract(def, f);
}
