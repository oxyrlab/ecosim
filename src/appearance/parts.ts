import { BlueprintValidationError, InvalidParameterError, type Vec2 } from '@core/index';
import type {
  AnchorSpec,
  BodyPartSpec,
  ExpandedBodyPart,
  PartActuatorRef,
  PartAnimSpec,
  PartJointSpec,
  PartSensorRef,
  PartStyleSpec,
  ShapeSpec,
} from './types';

/**
 * Converts a named {@link AnchorSpec} keyword or `Vec2` into normalized `[-1, 1]` coordinates.
 * Front is `+X`, back is `-X`, left is `-Y`, right is `+Y`.
 */
export function resolveAnchor(anchor: AnchorSpec = 'center'): Vec2 {
  if (typeof anchor !== 'string') {
    return { x: anchor.x, y: anchor.y };
  }
  switch (anchor) {
    case 'front':
      return { x: 1, y: 0 };
    case 'back':
      return { x: -1, y: 0 };
    case 'left':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 0, y: 1 };
    case 'center':
      return { x: 0, y: 0 };
  }
}

function resolveAnimChannels(
  partId: string,
  anims: readonly PartAnimSpec[] | undefined,
  sensors: readonly PartSensorRef[],
  actuator: PartActuatorRef | undefined,
): readonly PartAnimSpec[] {
  if (anims === undefined || anims.length === 0) return [];
  return anims.map((anim) => {
    if (anim.channel.startsWith('$actuator:')) {
      if (actuator === undefined) {
        throw new BlueprintValidationError(
          `Animation references "${anim.channel}" on part "${partId}", but the part has no actuator.`,
          `body.parts.${partId}.anim`,
        );
      }
      const port = anim.channel.slice('$actuator:'.length);
      return { ...anim, channel: `${actuator.instanceId}:${port}` };
    }
    if (anim.channel.startsWith('$sensor:')) {
      const firstSensor = sensors[0];
      if (firstSensor === undefined) {
        throw new BlueprintValidationError(
          `Animation references "${anim.channel}" on part "${partId}", but the part has no sensor.`,
          `body.parts.${partId}.anim`,
        );
      }
      const port = anim.channel.slice('$sensor:'.length);
      return { ...anim, channel: `${firstSensor.instanceId}:${port}` };
    }
    return anim;
  });
}

function expandSinglePart(
  spec: BodyPartSpec,
  side: 'none' | 'l' | 'r',
  parentOverride?: string,
): ExpandedBodyPart {
  const id = side === 'none' ? spec.id : `${spec.id}.${side}`;
  const rawAt = resolveAnchor(spec.at);
  const rawPivot = resolveAnchor(spec.pivot);
  const mirrorSign = side === 'r' ? -1 : 1;

  const at: Vec2 = { x: rawAt.x, y: rawAt.y * mirrorSign };
  const pivot: Vec2 = { x: rawPivot.x, y: rawPivot.y * mirrorSign };
  const angle = (spec.angle ?? 0) * mirrorSign;

  const sensors: readonly PartSensorRef[] = (spec.sensors ?? []).map((s) => ({
    ...s,
    instanceId: side === 'none' ? s.instanceId : `${s.instanceId}.${side}`,
  }));

  const actuator: PartActuatorRef | undefined =
    spec.actuator !== undefined
      ? {
          ...spec.actuator,
          instanceId:
            side === 'none' ? spec.actuator.instanceId : `${spec.actuator.instanceId}.${side}`,
        }
      : undefined;

  const anim = resolveAnimChannels(id, spec.anim, sensors, actuator);

  return {
    id,
    parent: parentOverride ?? spec.parent,
    at,
    pivot,
    angle,
    z: spec.z ?? 0,
    shape: spec.shape,
    style: spec.style,
    joint: spec.joint ?? 'fixed',
    massDensity: spec.massDensity ?? 1,
    organ: spec.organ,
    sensors,
    actuator,
    anim,
  };
}

/**
 * Expands `mirror: true` parts into `.l` and `.r` siblings, resolves `$actuator:*` / `$sensor:*`
 * animation self-references, validates parent references and acyclicity, and returns parts in
 * deterministic topological order (parents always precede children).
 *
 * @param parts - Raw part tree from a species Blueprint.
 * @returns Topologically ordered expanded parts.
 * @throws BlueprintValidationError if parts are empty, ids collide, parents are missing, or a cycle exists.
 */
export function expandBodyParts(parts: readonly BodyPartSpec[]): ExpandedBodyPart[] {
  if (parts.length === 0) {
    throw new BlueprintValidationError(
      'Body part tree must contain at least one root part.',
      'body.parts',
    );
  }

  const expanded: ExpandedBodyPart[] = [];
  const mirroredSourceIds = new Set<string>();
  for (const spec of parts) {
    if (spec.mirror === true) {
      mirroredSourceIds.add(spec.id);
    }
  }

  for (const spec of parts) {
    const parentIsMirrored = spec.parent !== undefined && mirroredSourceIds.has(spec.parent);

    if (spec.mirror === true) {
      if (spec.parent === undefined) {
        throw new BlueprintValidationError(
          `Root part "${spec.id}" cannot set mirror: true because a creature must have a single root.`,
          `body.parts.${spec.id}`,
        );
      }
      expanded.push(
        expandSinglePart(spec, 'l', parentIsMirrored ? `${spec.parent}.l` : spec.parent),
      );
      expanded.push(
        expandSinglePart(spec, 'r', parentIsMirrored ? `${spec.parent}.r` : spec.parent),
      );
    } else if (parentIsMirrored) {
      expanded.push(expandSinglePart(spec, 'l', `${spec.parent}.l`));
      expanded.push(expandSinglePart(spec, 'r', `${spec.parent}.r`));
    } else {
      expanded.push(expandSinglePart(spec, 'none'));
    }
  }

  // Check duplicate ids
  const byId = new Map<string, ExpandedBodyPart>();
  for (const part of expanded) {
    if (byId.has(part.id)) {
      throw new BlueprintValidationError(
        `Duplicate body part id "${part.id}" after mirror expansion.`,
        `body.parts.${part.id}`,
      );
    }
    byId.set(part.id, part);
  }

  // Validate parent references and root count
  let rootCount = 0;
  for (const part of expanded) {
    if (part.parent === undefined) {
      rootCount += 1;
    } else if (!byId.has(part.parent)) {
      throw new BlueprintValidationError(
        `Part "${part.id}" references unknown parent "${part.parent}".`,
        `body.parts.${part.id}.parent`,
      );
    }
  }
  if (rootCount !== 1) {
    throw new BlueprintValidationError(
      `Body part tree must have exactly 1 root part (found ${rootCount}).`,
      'body.parts',
    );
  }

  // Topological sort (Kahn's algorithm preserving declaration order) + cycle detection
  const childrenMap = new Map<string, ExpandedBodyPart[]>();
  const roots: ExpandedBodyPart[] = [];
  for (const part of expanded) {
    if (part.parent === undefined) {
      roots.push(part);
    } else {
      const list = childrenMap.get(part.parent) ?? [];
      list.push(part);
      childrenMap.set(part.parent, list);
    }
  }

  const ordered: ExpandedBodyPart[] = [];
  const queue: ExpandedBodyPart[] = [...roots];
  while (queue.length > 0) {
    const current = queue.shift() as ExpandedBodyPart;
    ordered.push(current);
    const children = childrenMap.get(current.id);
    if (children !== undefined) {
      for (const child of children) {
        queue.push(child);
      }
    }
  }

  if (ordered.length !== expanded.length) {
    throw new BlueprintValidationError(
      'Cycle detected in body part parent references.',
      'body.parts',
    );
  }

  return ordered;
}

/**
 * Options for the {@link chain} helper generating segmented bodies (e.g. worms, snakes, tails).
 */
export interface ChainOptions {
  /** Number of segments to create (>= 1). */
  readonly count: number;
  /** Base shape for each segment (or function returning a shape per segment index `0..count-1`). */
  readonly shape: ShapeSpec | ((index: number, count: number) => ShapeSpec);
  /** Joint connecting segment `i` to segment `i - 1` (default `{ type: 'revolute', limits: [-0.5, 0.5] }`). */
  readonly joint?: PartJointSpec;
  /** Optional prefix for segment ids (default `'seg'`, producing `'seg-0'`, `'seg-1'`, ...). */
  readonly idPrefix?: string;
  /** Optional parent id for the first segment (`seg-0`). Omit to make `seg-0` the creature root. */
  readonly parent?: string;
  /** Optional style applied to every segment (or per index). */
  readonly style?: PartStyleSpec | ((index: number, count: number) => PartStyleSpec);
  /** Optional mass density in `kg/m^2` (default `1`). */
  readonly massDensity?: number;
}

/**
 * Helper building a linear chain of connected {@link BodyPartSpec} segments (worm, snake, tail).
 * Segment `0` attaches to `options.parent` (or acts as root), and each subsequent segment attaches
 * its `'front'` pivot to the previous segment's `'back'` anchor.
 */
export function chain(options: ChainOptions): BodyPartSpec[] {
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new InvalidParameterError('count', options.count, 'an integer >= 1', 'chain');
  }
  const prefix = options.idPrefix ?? 'seg';
  const joint: PartJointSpec = options.joint ?? { type: 'revolute', limits: [-0.5, 0.5] };
  const parts: BodyPartSpec[] = [];

  for (let i = 0; i < options.count; i += 1) {
    const id = `${prefix}-${i}`;
    const shape =
      typeof options.shape === 'function' ? options.shape(i, options.count) : options.shape;
    const style =
      typeof options.style === 'function' ? options.style(i, options.count) : options.style;

    const parent = i === 0 ? options.parent : `${prefix}-${i - 1}`;
    parts.push({
      id,
      ...(parent !== undefined ? { parent, at: 'back', pivot: 'front' } : {}),
      shape,
      ...(style !== undefined ? { style } : {}),
      ...(i > 0 || options.parent !== undefined ? { joint } : { joint: 'fixed' }),
      ...(options.massDensity !== undefined ? { massDensity: options.massDensity } : {}),
    });
  }

  return parts;
}
