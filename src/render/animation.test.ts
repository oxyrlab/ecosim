import { describe, expect, it } from 'vitest';
import { evaluatePartAnimations } from './animation';

describe('evaluatePartAnimations', () => {
  it('evaluates swing, wag, pulse, and scale purely visually and guards NaN/negative scales', () => {
    const swing = evaluatePartAnimations(
      [{ kind: 'swing', channel: 'thrust.l:power', amplitude: 0.5 }],
      { 'thrust.l:power': 0.8 },
      0,
    );
    expect(swing.deltaAngle).toBeCloseTo(0.4);
    expect(swing.scaleX).toBe(1);

    const wag = evaluatePartAnimations(
      [{ kind: 'wag', channel: 'fear:level', amplitude: 0.4 }],
      { 'fear:level': 1 },
      Math.PI / 20, // sin(PI/2) === 1
    );
    expect(wag.deltaAngle).toBeCloseTo(0.4);

    const pulse = evaluatePartAnimations(
      [{ kind: 'pulse', channel: 'heart:beat', amplitude: 0.2 }],
      { 'heart:beat': 1 },
      Math.PI / 16, // sin(PI/2) === 1
    );
    expect(pulse.scaleX).toBeCloseTo(1.2);
    expect(pulse.scaleY).toBeCloseTo(1.2);

    const scale = evaluatePartAnimations(
      [{ kind: 'scale', channel: 'grow:val', amplitude: -5 }],
      { 'grow:val': 1 },
      0,
    );
    expect(scale.scaleX).toBe(0.1); // clamped floor

    const missingAndNaN = evaluatePartAnimations(
      [
        { kind: 'swing', channel: 'missing:ch', amplitude: 1 },
        { kind: 'swing', channel: 'nan:ch', amplitude: 1 },
      ],
      { 'nan:ch': Number.NaN },
      1,
    );
    expect(missingAndNaN).toEqual({ deltaAngle: 0, scaleX: 1, scaleY: 1 });
  });
});
