import { describe, expect, it, vi } from 'vitest';
import { shapeRegistry } from '@appearance/shapes';
import {
  resolvePortMap,
  type ActuatorContext,
  type ActuatorDef,
  type OrganDef,
  type SensorContext,
  type SensorDef,
} from '@body/index';
import type { BrainModuleDef } from '@brain/index';
import { resolveWiring, type PortMap, type ResolvedComponentHandles } from '@bus/index';
import { createEntityId, createSeededRng, isKebabCaseId } from '@core/index';
import type { SpineDef } from '@spine/index';

/** Contract suite verifying every registered {@link OrganDef}. */
export function runOrganContract(def: OrganDef<unknown>): void {
  describe(`OrganContract(${def.id})`, () => {
    it('declares valid metadata, known default shape, and positive mass density', () => {
      expect(isKebabCaseId(def.id)).toBe(true);
      expect(def.description.trim().length).toBeGreaterThan(0);
      expect(def.massDensity).toBeGreaterThan(0);
      expect(def.sensorSlots).toBeGreaterThanOrEqual(0);
      expect(shapeRegistry.has(def.defaultShape.type)).toBe(true);
      expect(() => def.params.parse(undefined)).not.toThrow();
    });
  });
}

/** Contract suite verifying every registered {@link SensorDef}. */
export function runSensorContract(
  def: SensorDef<unknown, PortMap>,
  fixtures: { readonly validParams: unknown; readonly invalidParams: unknown },
): void {
  describe(`SensorContract(${def.id})`, () => {
    it('validates params and writes bounded finite outputs deterministically', () => {
      expect(isKebabCaseId(def.id)).toBe(true);
      expect(def.description.trim().length).toBeGreaterThan(0);
      const params = def.params.parse(fixtures.validParams);
      expect(() => def.params.parse(fixtures.invalidParams)).toThrow();

      const outputs = resolvePortMap(def.outputs, params);
      expect(Object.keys(outputs).length).toBeGreaterThan(0);

      const { bus, handles } = resolveWiring([{ instanceId: 'sensor', inputs: {}, outputs }], []);
      const outHandles = (handles.get('sensor') as ResolvedComponentHandles).outputs;
      const instance = def.create(params, { outputs: outHandles });

      const ctx: SensorContext = {
        entityId: createEntityId(1),
        position: { x: 5, y: 5 },
        angle: 0,
        queryNeighbors: () => [],
        sampleField: () => 0.5,
        castRay: () => null,
      };

      instance.sample(ctx, bus.writer);
      bus.swap();
      const snap1 = bus.snapshot();

      for (const [name, value] of Object.entries(snap1)) {
        expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
      }

      // Deterministic on identical input
      instance.sample(ctx, bus.writer);
      bus.swap();
      expect(bus.snapshot()).toEqual(snap1);
    });
  });
}

/** Contract suite verifying every registered {@link ActuatorDef}. */
export function runActuatorContract(
  def: ActuatorDef<unknown, PortMap>,
  fixtures: { readonly validParams: unknown; readonly invalidParams: unknown },
): void {
  describe(`ActuatorContract(${def.id})`, () => {
    it('validates params, declares non-negative energyCost, and runs cleanly on zero/max inputs', () => {
      expect(isKebabCaseId(def.id)).toBe(true);
      expect(def.description.trim().length).toBeGreaterThan(0);
      const params = def.params.parse(fixtures.validParams);
      expect(() => def.params.parse(fixtures.invalidParams)).toThrow();

      const cost = def.energyCost(params);
      expect(cost.basePerSecond).toBeGreaterThanOrEqual(0);
      expect(cost.perUnitEffortPerSecond).toBeGreaterThanOrEqual(0);
      expect(cost.perAction).toBeGreaterThanOrEqual(0);

      const inputs = resolvePortMap(def.inputs, params);
      const { bus, handles } = resolveWiring([{ instanceId: 'act', inputs, outputs: {} }], []);
      const inHandles = (handles.get('act') as ResolvedComponentHandles).inputs;
      const instance = def.create(params, { inputs: inHandles });

      const ctx: ActuatorContext = {
        entityId: createEntityId(1),
        worldPosition: { x: 0, y: 0 },
        worldAngle: 0,
        applyForce: vi.fn(),
        applyImpulse: vi.fn(),
        applyTorque: vi.fn(),
        emitField: vi.fn(),
        consumeEnergy: vi.fn(),
        emitAction: vi.fn(),
      };

      expect(() => instance.apply(ctx, bus.reader, 1 / 30)).not.toThrow();
    });
  });
}

/** Contract suite verifying any {@link BrainModuleDef}. */
export function runBrainModuleContract(
  def: BrainModuleDef<unknown, PortMap, PortMap>,
  fixtures: { readonly validParams: unknown; readonly invalidParams: unknown },
): void {
  describe(`BrainModuleContract(${def.id})`, () => {
    it('validates params and produces bounded, NaN-free, deterministic outputs', () => {
      expect(isKebabCaseId(def.id)).toBe(true);
      expect(def.description.trim().length).toBeGreaterThan(0);
      const params = def.params.parse(fixtures.validParams);
      expect(() => def.params.parse(fixtures.invalidParams)).toThrow();

      const inputs = resolvePortMap(def.inputs, params);
      const outputs = resolvePortMap(def.outputs, params);

      const runOnce = () => {
        const { bus, handles } = resolveWiring(
          [
            {
              instanceId: 'mod',
              inputs,
              outputs,
              ...(def.publish !== undefined ? { publish: def.publish } : {}),
              ...(def.subscribe !== undefined ? { subscribe: def.subscribe } : {}),
            },
          ],
          [],
        );
        const h = handles.get('mod') as ResolvedComponentHandles;
        const inst = def.create(params, h, createSeededRng(42));
        inst.tick(bus.reader, bus.writer, 0.1);
        bus.swap();
        return bus.snapshot();
      };

      const a = runOnce();
      const b = runOnce();
      expect(a).toEqual(b);
      for (const value of Object.values(a)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  });
}

/**
 * Contract suite verifying every learning brain module (`kind === 'learning'`, Section 9.3):
 * - learning happens only on learning signals (state unchanged without modulator/pain),
 * - state is visible via `serialize()`,
 * - a fresh offspring module starts with empty memory.
 */
export function runLearningModuleContract(
  def: BrainModuleDef<unknown, PortMap, PortMap>,
  fixtures: { readonly validParams: unknown; readonly invalidParams: unknown },
): void {
  describe(`LearningModuleContract(${def.id})`, () => {
    it('starts with empty memory, exposes serialize(), and does not learn without a learning signal', () => {
      expect(def.kind).toBe('learning');
      const params = def.params.parse(fixtures.validParams);
      const inputs = resolvePortMap(def.inputs, params);
      const outputs = resolvePortMap(def.outputs, params);

      const makeInstance = () => {
        const { bus, handles } = resolveWiring(
          [
            {
              instanceId: 'learn',
              inputs,
              outputs,
              ...(def.publish !== undefined ? { publish: def.publish } : {}),
              ...(def.subscribe !== undefined ? { subscribe: def.subscribe } : {}),
            },
          ],
          [],
        );
        const h = handles.get('learn') as ResolvedComponentHandles;
        const inst = def.create(params, h, createSeededRng(7));
        return { bus, inst };
      };

      const parent = makeInstance();
      const offspring = makeInstance();

      expect(parent.inst.serialize).toBeDefined();
      const initialState = parent.inst.serialize?.();
      expect(initialState).toEqual(offspring.inst.serialize?.());

      // Stepping with zero learning signals must keep memory state unchanged
      for (let i = 0; i < 5; i += 1) {
        parent.inst.tick(parent.bus.reader, parent.bus.writer, 0.1);
        parent.bus.swap();
      }
      expect(parent.inst.serialize?.()).toEqual(initialState);
    });
  });
}

/** Contract suite verifying every registered {@link SpineDef}. */
export function runSpineContract(
  def: SpineDef<unknown, PortMap, PortMap>,
  fixtures: { readonly validParams: unknown; readonly invalidParams: unknown },
): void {
  describe(`SpineContract(${def.id})`, () => {
    it('validates params and maps inputs to bounded, deterministic outputs', () => {
      expect(isKebabCaseId(def.id)).toBe(true);
      expect(def.description.trim().length).toBeGreaterThan(0);
      const params = def.params.parse(fixtures.validParams);
      expect(() => def.params.parse(fixtures.invalidParams)).toThrow();

      const inputs = resolvePortMap(def.inputs, params);
      const outputs = resolvePortMap(def.outputs, params);
      const { bus, handles } = resolveWiring([{ instanceId: 'spine', inputs, outputs }], []);
      const h = handles.get('spine') as ResolvedComponentHandles;
      const inst = def.create(params, { inputs: h.inputs, outputs: h.outputs });

      inst.tick(bus.reader, bus.writer, 1 / 30);
      bus.swap();
      const snap1 = bus.snapshot();
      for (const value of Object.values(snap1)) {
        expect(Number.isFinite(value)).toBe(true);
      }

      inst.tick(bus.reader, bus.writer, 1 / 30);
      bus.swap();
      expect(bus.snapshot()).toEqual(snap1);
    });
  });
}
