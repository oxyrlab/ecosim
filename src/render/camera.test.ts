import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { Camera } from './camera';

describe('Camera', () => {
  it('converts between world and screen coordinates and culls circles', () => {
    const cam = new Camera({
      centerX: 25,
      centerY: 25,
      pixelsPerMeter: 10,
      viewportWidth: 200,
      viewportHeight: 100,
    });

    expect(cam.worldToScreen(25, 25)).toEqual({ x: 100, y: 50 });
    expect(cam.screenToWorld(100, 50)).toEqual({ x: 25, y: 25 });
    expect(cam.getVisibleBounds()).toEqual({ minX: 15, minY: 20, maxX: 35, maxY: 30 });

    expect(cam.isCircleVisible(25, 25, 0.5)).toBe(true);
    expect(cam.isCircleVisible(35.4, 25, 0.5)).toBe(true);
    expect(cam.isCircleVisible(50, 25, 0.5)).toBe(false);

    cam.panByScreenDelta(20, -10);
    expect(cam.centerX).toBeCloseTo(23);
    expect(cam.centerY).toBeCloseTo(26);

    const anchorWorld = cam.screenToWorld(140, 70);
    cam.zoomBy(2, 2, 200, 140, 70);
    expect(cam.pixelsPerMeter).toBe(20);
    const afterZoom = cam.screenToWorld(140, 70);
    expect(afterZoom.x).toBeCloseTo(anchorWorld.x);
    expect(afterZoom.y).toBeCloseTo(anchorWorld.y);

    cam.resize(400, 300);
    expect(cam.viewportWidth).toBe(400);
    expect(cam.viewportHeight).toBe(300);
  });

  it('rejects invalid constructor, resize, and zoom parameters', () => {
    expect(
      () =>
        new Camera({
          centerX: 0,
          centerY: 0,
          pixelsPerMeter: 0,
          viewportWidth: 100,
          viewportHeight: 100,
        }),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new Camera({
          centerX: 0,
          centerY: 0,
          pixelsPerMeter: 10,
          viewportWidth: 0,
          viewportHeight: 100,
        }),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new Camera({
          centerX: 0,
          centerY: 0,
          pixelsPerMeter: 10,
          viewportWidth: 100,
          viewportHeight: -5,
        }),
    ).toThrow(InvalidParameterError);

    const cam = new Camera({
      centerX: 0,
      centerY: 0,
      pixelsPerMeter: 10,
      viewportWidth: 100,
      viewportHeight: 100,
    });
    expect(() => cam.resize(0, 100)).toThrow(InvalidParameterError);
    expect(() => cam.zoomBy(0)).toThrow(InvalidParameterError);
  });
});
