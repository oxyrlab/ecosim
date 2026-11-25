import {
  add,
  assertFiniteNumber,
  BlueprintValidationError,
  InvalidParameterError,
  rotate,
  sub,
  type Registry,
  type Vec2,
} from '@core/index';
import {
  COLLISION_GROUP,
  type BodyHandle,
  type ColliderHandle,
  type JointHandle,
  type PhysicsAdapter,
} from '@physics/types';
import { expandBodyParts } from './parts';
import {
  shapeRegistry,
  type ConcaveStrategy,
  type ShapeColliderSpec,
  type ShapeDef,
} from './shapes';
import type {
  BodyPartSpec,
  ResolvedBodyLayout,
  ResolvedJointSpec,
  ResolvedPart,
  RigidBodyGroup,
} from './types';

function hashStringFnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function parseShapeParams(def: ShapeDef<unknown>, shapeSpec: Record<string, unknown>): unknown {
  const { type: _type, ...rawParams } = shapeSpec;
  void _type;
  const parsed = def.params.safeParse(rawParams);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new BlueprintValidationError(
      `Invalid parameters for shape "${def.id}": ${details}`,
      `shape.${def.id}`,
    );
  }
  return parsed.data;
}

/**
 * Pure, deterministic layout solver converting a declarative {@link BodyPartSpec} tree into
 * scaled transforms, compound rigid body groups, joints, convex colliders, overall bounds, and
 * a cacheable `appearanceSignature` (Section 5.10).
 *
 * @param parts - Raw part tree from a species Blueprint.
 * @param scale - Positive growth scale multiplier (default `1`).
 * @param strategy - Policy for non-convex shapes (default `'hull'`).
 * @param registry - Shape registry to resolve shape types against (defaults to {@link shapeRegistry}).
 */
export function resolveLayout(
  parts: readonly BodyPartSpec[],
  scale = 1,
  strategy: ConcaveStrategy = 'hull',
  registry: Registry<ShapeDef<unknown>> = shapeRegistry,
): ResolvedBodyLayout {
  assertFiniteNumber('scale', scale, 'resolveLayout');
  if (scale <= 0) {
    throw new InvalidParameterError('scale', scale, 'a finite number > 0', 'resolveLayout');
  }

  const expanded = expandBodyParts(parts);
  const resolvedParts: ResolvedPart[] = [];
  const byId = new Map<string, ResolvedPart>();

  const groupMap = new Map<
    string,
    {
      readonly id: string;
      readonly position: Vec2;
      readonly angle: number;
      totalMass: number;
      readonly chainDepth: number;
      readonly partIds: string[];
    }
  >();
  const joints: ResolvedJointSpec[] = [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const staticSignatureChunks: string[] = [`scale:${scale.toFixed(4)}`];

  for (const part of expanded) {
    const shapeDef = registry.get(part.shape.type);
    const validatedParams = parseShapeParams(shapeDef, part.shape);
    const scaledParams = shapeDef.scaleParams(validatedParams, scale);

    const bounds = shapeDef.bounds(scaledParams);
    const path = shapeDef.toPath(scaledParams);
    const area = shapeDef.area(scaledParams);
    const isVisual = part.joint === 'visual';
    const mass = isVisual ? 0 : area * part.massDensity;

    let position: Vec2 = { x: 0, y: 0 };
    let angle = part.angle;
    let parentResolved: ResolvedPart | undefined;

    if (part.parent !== undefined) {
      parentResolved = byId.get(part.parent);
      if (parentResolved === undefined) {
        throw new BlueprintValidationError(
          `Internal layout error: parent "${part.parent}" was not resolved before "${part.id}".`,
        );
      }
      angle = parentResolved.angle + part.angle;

      const parentAttachLocal: Vec2 = {
        x: part.at.x * parentResolved.bounds.w * 0.5,
        y: part.at.y * parentResolved.bounds.h * 0.5,
      };
      const attachWorld = add(
        parentResolved.position,
        rotate(parentAttachLocal, parentResolved.angle),
      );

      const childPivotLocal: Vec2 = {
        x: part.pivot.x * bounds.w * 0.5,
        y: part.pivot.y * bounds.h * 0.5,
      };
      const childPivotWorld = rotate(childPivotLocal, angle);
      position = sub(attachWorld, childPivotWorld);
    }

    // Physical ancestor & compound rigid body grouping
    let physicalAncestorId: string | null;
    let rigidBodyGroupId: string | null = null;
    let isDynamicVisual = part.anim.length > 0;

    if (isVisual) {
      physicalAncestorId = parentResolved?.physicalAncestorId ?? null;
      if (parentResolved?.isDynamicVisual === true) {
        isDynamicVisual = true;
      }
    } else {
      physicalAncestorId = part.id;
      const isJointed = typeof part.joint === 'object';
      const parentGroupId = parentResolved?.rigidBodyGroupId ?? null;

      if (parentResolved === undefined || parentGroupId === null || isJointed) {
        const parentGroup = parentGroupId !== null ? groupMap.get(parentGroupId) : undefined;
        const chainDepth = parentGroup !== undefined ? parentGroup.chainDepth + 1 : 0;
        rigidBodyGroupId = part.id;
        groupMap.set(part.id, {
          id: part.id,
          position,
          angle,
          totalMass: mass,
          chainDepth,
          partIds: [part.id],
        });

        if (isJointed && parentResolved !== undefined && parentGroup !== undefined) {
          isDynamicVisual = true;
          const attachLocalOnParentPart: Vec2 = {
            x: part.at.x * parentResolved.bounds.w * 0.5,
            y: part.at.y * parentResolved.bounds.h * 0.5,
          };
          const attachCreature = add(
            parentResolved.position,
            rotate(attachLocalOnParentPart, parentResolved.angle),
          );
          const anchorA = rotate(sub(attachCreature, parentGroup.position), -parentGroup.angle);
          const anchorB = rotate(sub(attachCreature, position), -angle);

          joints.push({
            id: `${parentGroup.id}->${part.id}`,
            type: part.joint.type,
            parentGroupId: parentGroup.id,
            childGroupId: part.id,
            anchorA,
            anchorB,
            ...(part.joint.limits !== undefined ? { limits: part.joint.limits } : {}),
            ...(part.joint.axis !== undefined ? { axis: part.joint.axis } : {}),
          });
        }
      } else {
        rigidBodyGroupId = parentGroupId;
        const group = groupMap.get(parentGroupId);
        if (group !== undefined) {
          group.totalMass += mass;
          group.partIds.push(part.id);
          if (group.chainDepth > 0) {
            isDynamicVisual = true;
          }
        }
      }
    }

    const colliders: readonly ShapeColliderSpec[] = isVisual
      ? []
      : shapeDef.toColliders(scaledParams, strategy);

    const resolved: ResolvedPart = {
      id: part.id,
      parentId: part.parent,
      position,
      angle,
      bounds,
      path,
      area,
      mass,
      z: part.z,
      isVisual,
      isDynamicVisual,
      physicalAncestorId,
      rigidBodyGroupId,
      colliders,
      part,
    };

    resolvedParts.push(resolved);
    byId.set(part.id, resolved);

    // Update overall bounding box conservatively using rotated bounding box corners.
    const hw = bounds.w * 0.5;
    const hh = bounds.h * 0.5;
    const corners: readonly Vec2[] = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];
    for (const corner of corners) {
      const worldCorner = add(position, rotate(corner, angle));
      if (worldCorner.x < minX) minX = worldCorner.x;
      if (worldCorner.x > maxX) maxX = worldCorner.x;
      if (worldCorner.y < minY) minY = worldCorner.y;
      if (worldCorner.y > maxY) maxY = worldCorner.y;
    }

    if (!isDynamicVisual) {
      staticSignatureChunks.push(
        `${part.id}:${part.shape.type}:${position.x.toFixed(3)},${position.y.toFixed(3)},${angle.toFixed(3)}:${bounds.w.toFixed(3)}x${bounds.h.toFixed(3)}:${part.style?.pattern ?? 'none'}:${part.z}`,
      );
    }
  }

  const rigidBodyGroups: RigidBodyGroup[] = Array.from(groupMap.values()).map((g) => ({
    id: g.id,
    position: g.position,
    angle: g.angle,
    totalMass: g.totalMass,
    chainDepth: g.chainDepth,
    partIds: [...g.partIds],
  }));

  return {
    scale,
    parts: resolvedParts,
    byId,
    rigidBodyGroups,
    joints,
    overallBounds: {
      minX,
      minY,
      maxX,
      maxY,
      w: maxX - minX,
      h: maxY - minY,
    },
    appearanceSignature: hashStringFnv1a(staticSignatureChunks.join('|')),
  };
}

/**
 * Result of instantiating a {@link ResolvedBodyLayout} inside a {@link PhysicsAdapter}.
 */
export interface BuiltPhysicsBody {
  /** Primary root rigid body handle. */
  readonly rootBody: BodyHandle;
  /** Rigid body handle per {@link RigidBodyGroup.id}. */
  readonly bodiesByGroup: ReadonlyMap<string, BodyHandle>;
  /** All created rigid body handles. */
  readonly bodies: readonly BodyHandle[];
  /** All created collider handles. */
  readonly colliders: readonly ColliderHandle[];
  /** All created joint handles. */
  readonly joints: readonly JointHandle[];
  /** Removes every created body, collider, and joint cleanly from the adapter. */
  removeAll(): void;
}

/**
 * Instantiates all compound rigid bodies, colliders, and revolute/prismatic joints defined by
 * `layout` inside `physics` at `(worldPosition, worldAngle)`.
 */
export function buildPhysicsBodyFromLayout(
  layout: ResolvedBodyLayout,
  physics: PhysicsAdapter,
  worldPosition: Vec2,
  worldAngle = 0,
  collisionGroup: number = COLLISION_GROUP.CREATURE,
  collisionMask: number = COLLISION_GROUP.ALL,
): BuiltPhysicsBody {
  if (layout.rigidBodyGroups.length === 0) {
    throw new BlueprintValidationError(
      'Cannot build physics body from a layout that has zero physical (non-visual) parts.',
      'body.parts',
    );
  }

  const bodiesByGroup = new Map<string, BodyHandle>();
  const bodies: BodyHandle[] = [];
  const colliders: ColliderHandle[] = [];
  const joints: JointHandle[] = [];

  for (const group of layout.rigidBodyGroups) {
    const groupWorldPos = add(worldPosition, rotate(group.position, worldAngle));
    const groupWorldAngle = worldAngle + group.angle;
    const bodyHandle = physics.createBody({
      kind: 'dynamic',
      position: groupWorldPos,
      angle: groupWorldAngle,
      linearDamping: 0.6,
      angularDamping: 0.8,
    });
    bodiesByGroup.set(group.id, bodyHandle);
    bodies.push(bodyHandle);

    for (const partId of group.partIds) {
      const part = layout.byId.get(partId);
      if (part === undefined) continue;

      const partOffsetInGroup = rotate(sub(part.position, group.position), -group.angle);
      const partAngleInGroup = part.angle - group.angle;

      for (const colSpec of part.colliders) {
        const subOffset =
          colSpec.offset !== undefined
            ? add(partOffsetInGroup, rotate(colSpec.offset, partAngleInGroup))
            : partOffsetInGroup;
        const subAngle = partAngleInGroup + (colSpec.angle ?? 0);

        const colHandle = physics.createCollider({
          body: bodyHandle,
          shape: colSpec.shape,
          offset: subOffset,
          angle: subAngle,
          density: part.part.massDensity,
          collisionGroup,
          collisionMask,
        });
        colliders.push(colHandle);
      }
    }
  }

  for (const joint of layout.joints) {
    const bodyA = bodiesByGroup.get(joint.parentGroupId);
    const bodyB = bodiesByGroup.get(joint.childGroupId);
    if (bodyA === undefined || bodyB === undefined) continue;

    const handle =
      joint.type === 'revolute'
        ? physics.createJoint({
            kind: 'revolute',
            bodyA,
            bodyB,
            anchorA: joint.anchorA,
            anchorB: joint.anchorB,
            ...(joint.limits !== undefined ? { limits: joint.limits } : {}),
          })
        : physics.createJoint({
            kind: 'prismatic',
            bodyA,
            bodyB,
            anchorA: joint.anchorA,
            anchorB: joint.anchorB,
            axis: joint.axis ?? { x: 1, y: 0 },
            ...(joint.limits !== undefined ? { limits: joint.limits } : {}),
          });
    joints.push(handle);
  }

  const rootGroup = layout.rigidBodyGroups[0] as RigidBodyGroup;
  const rootBody = bodiesByGroup.get(rootGroup.id) as BodyHandle;

  return {
    rootBody,
    bodiesByGroup,
    bodies,
    colliders,
    joints,
    removeAll(): void {
      for (const joint of joints) {
        physics.removeJoint(joint);
      }
      for (const body of bodies) {
        physics.removeBody(body);
      }
    },
  };
}
