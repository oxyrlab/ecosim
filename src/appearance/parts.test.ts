import { describe, expect, it } from 'vitest';
import { BlueprintValidationError, InvalidParameterError } from '@core/index';
import { chain, expandBodyParts, resolveAnchor } from './parts';
import type { BodyPartSpec } from './types';

describe('parts (resolveAnchor, expandBodyParts, chain)', () => {
  it('resolves named anchor keywords and numeric Vec2 anchors', () => {
    expect(resolveAnchor()).toEqual({ x: 0, y: 0 });
    expect(resolveAnchor('center')).toEqual({ x: 0, y: 0 });
    expect(resolveAnchor('front')).toEqual({ x: 1, y: 0 });
    expect(resolveAnchor('back')).toEqual({ x: -1, y: 0 });
    expect(resolveAnchor('left')).toEqual({ x: 0, y: -1 });
    expect(resolveAnchor('right')).toEqual({ x: 0, y: 1 });
    expect(resolveAnchor({ x: 0.3, y: -0.9 })).toEqual({ x: 0.3, y: -0.9 });
  });

  it('expands mirrored parts, mirrored sensors/actuators, and animation self-references', () => {
    const parts: BodyPartSpec[] = [
      { id: 'torso', shape: { type: 'ellipse', w: 0.6, h: 0.3 } },
      {
        id: 'leg',
        parent: 'torso',
        at: { x: -0.5, y: -0.9 },
        angle: 0.25,
        joint: 'visual',
        mirror: true,
        shape: { type: 'capsule', length: 0.2, radius: 0.04 },
        sensors: [{ instanceId: 'touch', sensor: 'touch-sensor' }],
        actuator: { instanceId: 'thrust', actuator: 'thruster' },
        anim: [
          { kind: 'swing', channel: '$actuator:power', amplitude: 0.4 },
          { kind: 'pulse', channel: '$sensor:contact', amplitude: 0.1 },
          { kind: 'wag', channel: 'fear:level', amplitude: 0.2 },
        ],
      },
      {
        id: 'claw',
        parent: 'leg',
        at: 'front',
        shape: { type: 'triangle', w: 0.05, h: 0.04 },
        joint: 'visual',
      },
    ];

    const expanded = expandBodyParts(parts);
    expect(expanded.map((p) => p.id)).toEqual(['torso', 'leg.l', 'leg.r', 'claw.l', 'claw.r']);

    const leftLeg = expanded.find((p) => p.id === 'leg.l');
    const rightLeg = expanded.find((p) => p.id === 'leg.r');
    expect(leftLeg?.at).toEqual({ x: -0.5, y: -0.9 });
    expect(rightLeg?.at).toEqual({ x: -0.5, y: 0.9 });
    expect(leftLeg?.angle).toBe(0.25);
    expect(rightLeg?.angle).toBe(-0.25);
    expect(leftLeg?.actuator?.instanceId).toBe('thrust.l');
    expect(rightLeg?.actuator?.instanceId).toBe('thrust.r');
    expect(leftLeg?.sensors[0]?.instanceId).toBe('touch.l');
    expect(rightLeg?.sensors[0]?.instanceId).toBe('touch.r');
    expect(leftLeg?.anim[0]?.channel).toBe('thrust.l:power');
    expect(rightLeg?.anim[0]?.channel).toBe('thrust.r:power');
    expect(rightLeg?.anim[1]?.channel).toBe('touch.r:contact');
    expect(rightLeg?.anim[2]?.channel).toBe('fear:level');
  });

  it('rejects empty trees, mirrored roots, missing parents, duplicate ids, cycles, and broken self-refs', () => {
    expect(() => expandBodyParts([])).toThrow(BlueprintValidationError);
    expect(() =>
      expandBodyParts([{ id: 'root', mirror: true, shape: { type: 'circle', r: 0.2 } }]),
    ).toThrow(BlueprintValidationError);
    expect(() =>
      expandBodyParts([
        { id: 'torso', shape: { type: 'circle', r: 0.2 } },
        { id: 'head', parent: 'ghost', shape: { type: 'circle', r: 0.1 } },
      ]),
    ).toThrow(BlueprintValidationError);
    expect(() =>
      expandBodyParts([
        { id: 'torso', shape: { type: 'circle', r: 0.2 } },
        { id: 'torso', parent: 'torso', shape: { type: 'circle', r: 0.1 } },
      ]),
    ).toThrow(BlueprintValidationError);
    expect(() =>
      expandBodyParts([
        { id: 'a', shape: { type: 'circle', r: 0.2 } },
        { id: 'b', shape: { type: 'circle', r: 0.2 } },
      ]),
    ).toThrow(BlueprintValidationError);
    expect(() =>
      expandBodyParts([
        { id: 'root', shape: { type: 'circle', r: 0.2 } },
        { id: 'a', parent: 'b', shape: { type: 'circle', r: 0.1 } },
        { id: 'b', parent: 'a', shape: { type: 'circle', r: 0.1 } },
      ]),
    ).toThrow(BlueprintValidationError);
    expect(() =>
      expandBodyParts([
        {
          id: 'root',
          shape: { type: 'circle', r: 0.2 },
          anim: [{ kind: 'swing', channel: '$actuator:power', amplitude: 0.3 }],
        },
      ]),
    ).toThrow(BlueprintValidationError);
    expect(() =>
      expandBodyParts([
        {
          id: 'root',
          shape: { type: 'circle', r: 0.2 },
          anim: [{ kind: 'pulse', channel: '$sensor:val', amplitude: 0.3 }],
        },
      ]),
    ).toThrow(BlueprintValidationError);
  });

  it('builds jointed chains via chain() helper', () => {
    const worm = chain({
      count: 4,
      idPrefix: 'seg',
      shape: (i) => ({ type: 'capsule', length: 0.15, radius: 0.06 - i * 0.005 }),
      style: (i) => ({ fill: { h: 20 + i * 5, s: 0.6, l: 0.5 } }),
      massDensity: 1.2,
    });
    expect(worm).toHaveLength(4);
    expect(worm[0]?.parent).toBeUndefined();
    expect(worm[1]?.parent).toBe('seg-0');
    expect(worm[3]?.parent).toBe('seg-2');
    expect(worm[2]?.at).toBe('back');
    expect(worm[2]?.pivot).toBe('front');

    expect(() => chain({ count: 0, shape: { type: 'circle', r: 0.1 } })).toThrow(
      InvalidParameterError,
    );
  });
});
