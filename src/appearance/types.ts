import type { Vec2 } from '@core/index';
import type { ColorGene } from './color';
import type { Bounds2D } from './geometry';
import type { PathCommand, ShapeColliderSpec } from './shapes';

/** Named attachment points on a part's normalized `[-1, 1]` bounding box. */
export type AnchorKeyword = 'front' | 'back' | 'left' | 'right' | 'center';

/** Relative attachment coordinate on a bounding box (`[-1, 1]` or named keyword). */
export type AnchorSpec = Vec2 | AnchorKeyword;

/** Declarative shape specification referencing a registered shape id by `type`. */
export interface ShapeSpec {
  /** Registered `kebab-case` shape id (e.g. `circle`, `ellipse`, `rect`, `capsule`, `triangle`, `polygon`, `convex`). */
  readonly type: string;
  /** Additional shape-specific parameters validated by the shape's Zod schema. */
  readonly [key: string]: unknown;
}

/** Visual fill, stroke, and procedural pattern metadata for a body part. */
export interface PartStyleSpec {
  readonly fill: ColorGene;
  readonly stroke?: ColorGene;
  readonly pattern?: 'none' | 'spots' | 'stripes';
}

/** Joint specification connecting a child part to its parent. */
export type PartJointSpec =
  | 'fixed'
  | 'visual'
  | {
      readonly type: 'revolute' | 'prismatic';
      readonly limits?: readonly [min: number, max: number];
      readonly stiffness?: number;
      readonly axis?: Vec2;
    };

/** Purely visual animation binding driven by a SignalBus channel snapshot. */
export interface PartAnimSpec {
  readonly kind: 'swing' | 'wag' | 'pulse' | 'scale';
  /** Signal address (`<instanceId>:<port>`) or self-reference (`$actuator:<port>`, `$sensor:<port>`). */
  readonly channel: string;
  /** Peak visual amplitude (radians for `swing`/`wag`, scale fraction for `pulse`/`scale`). */
  readonly amplitude: number;
}

/** Sensor instance hosted on a body part. */
export interface PartSensorRef {
  readonly instanceId: string;
  readonly sensor: string;
  readonly params?: unknown;
}

/** Actuator instance hosted on a body part. */
export interface PartActuatorRef {
  readonly instanceId: string;
  readonly actuator: string;
  readonly params?: unknown;
}

/** Functional organ reference hosted on a body part. */
export interface PartOrganRef {
  readonly organ: string;
  readonly params?: unknown;
}

/**
 * Declarative specification of one node in a creature's procedural part tree (Section 5.10).
 */
export interface BodyPartSpec {
  /** Unique part id within the Blueprint. */
  readonly id: string;
  /** Parent part id; omit for the root torso. */
  readonly parent?: string;
  /** Attachment point on the parent's bounding box in normalized `[-1, 1]` (default `'center'`). */
  readonly at?: AnchorSpec;
  /** Pivot point on this part's own bounding box in normalized `[-1, 1]` (default `'center'`). */
  readonly pivot?: AnchorSpec;
  /** Local angle relative to parent in radians (default `0`). */
  readonly angle?: number;
  /** Draw order layer (higher draws on top, default `0`). */
  readonly z?: number;
  /** When `true`, expands into mirrored left/right parts (`<id>.l` and `<id>.r`). */
  readonly mirror?: boolean;
  /** Primitive shape specification. */
  readonly shape: ShapeSpec;
  /** Visual styling. */
  readonly style?: PartStyleSpec;
  /** Joint type (default `'fixed'`). `'visual'` parts have no collider or mass. */
  readonly joint?: PartJointSpec;
  /** Optional mass density in `kg/m^2` (default `1`). */
  readonly massDensity?: number;
  /** Optional functional organ hosted on this part. */
  readonly organ?: PartOrganRef;
  /** Optional sensors hosted on this part. */
  readonly sensors?: readonly PartSensorRef[];
  /** Optional actuator hosted on this part. */
  readonly actuator?: PartActuatorRef;
  /** Optional visual-only animations driven by bus snapshots. */
  readonly anim?: readonly PartAnimSpec[];
}

/**
 * Body part after mirror expansion and self-reference (`$actuator:*`, `$sensor:*`) resolution.
 */
export interface ExpandedBodyPart {
  readonly id: string;
  readonly parent: string | undefined;
  readonly at: Vec2;
  readonly pivot: Vec2;
  readonly angle: number;
  readonly z: number;
  readonly shape: ShapeSpec;
  readonly style: PartStyleSpec | undefined;
  readonly joint: PartJointSpec;
  readonly massDensity: number;
  readonly organ: PartOrganRef | undefined;
  readonly sensors: readonly PartSensorRef[];
  readonly actuator: PartActuatorRef | undefined;
  readonly anim: readonly PartAnimSpec[];
}

/**
 * Resolved local transform, scaled geometry, colliders, and physical ownership of one expanded part.
 */
export interface ResolvedPart {
  readonly id: string;
  readonly parentId: string | undefined;
  /** Position relative to the creature root in SI meters. */
  readonly position: Vec2;
  /** Rotation relative to the creature root in radians. */
  readonly angle: number;
  /** Scaled bounding box in meters. */
  readonly bounds: Bounds2D;
  /** Closed 2D vector path in part-local space (meters). */
  readonly path: readonly PathCommand[];
  /** Scaled area in square meters. */
  readonly area: number;
  /** Computed mass in kilograms (`0` for visual parts). */
  readonly mass: number;
  /** Draw order. */
  readonly z: number;
  /** `true` when `joint === 'visual'` (no collider, no mass). */
  readonly isVisual: boolean;
  /** `true` when this part has visual animations or belongs to a non-fixed jointed body. */
  readonly isDynamicVisual: boolean;
  /** Id of the nearest physical ancestor (self if physical); visual actuators apply force here. */
  readonly physicalAncestorId: string | null;
  /** Id of the {@link RigidBodyGroup} owning this part's colliders (`null` for visual parts). */
  readonly rigidBodyGroupId: string | null;
  /** Convex physics colliders generated for this part (empty for visual parts). */
  readonly colliders: readonly ShapeColliderSpec[];
  /** Underlying expanded part specification. */
  readonly part: ExpandedBodyPart;
}

/**
 * One compound rigid body produced by grouping a physical root/jointed part with all `fixed`
 * physical descendants attached to it.
 */
export interface RigidBodyGroup {
  /** Id of the root part defining this rigid body's local origin. */
  readonly id: string;
  /** Initial pose relative to creature root (meters, radians). */
  readonly position: Vec2;
  readonly angle: number;
  /** Total mass of all physical parts in this compound body (kg). */
  readonly totalMass: number;
  /** Depth in the rigid-body joint chain (`0` for creature root). */
  readonly chainDepth: number;
  /** All physical parts attached as colliders on this rigid body. */
  readonly partIds: readonly string[];
}

/**
 * Resolved joint connecting two {@link RigidBodyGroup}s in creature-local space.
 */
export interface ResolvedJointSpec {
  readonly id: string;
  readonly type: 'revolute' | 'prismatic';
  readonly parentGroupId: string;
  readonly childGroupId: string;
  /** Local anchor on `parentGroupId` in meters. */
  readonly anchorA: Vec2;
  /** Local anchor on `childGroupId` in meters. */
  readonly anchorB: Vec2;
  readonly limits?: readonly [min: number, max: number];
  readonly axis?: Vec2;
}

/**
 * Complete output of the pure {@link resolveLayout} solver.
 */
export interface ResolvedBodyLayout {
  readonly scale: number;
  /** All resolved parts in topological order. */
  readonly parts: readonly ResolvedPart[];
  /** Quick lookup map by expanded part id. */
  readonly byId: ReadonlyMap<string, ResolvedPart>;
  /** Compound rigid bodies to spawn in physics. */
  readonly rigidBodyGroups: readonly RigidBodyGroup[];
  /** Joints connecting compound rigid bodies. */
  readonly joints: readonly ResolvedJointSpec[];
  /** Axis-aligned overall bounding box covering all parts (meters). */
  readonly overallBounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
    readonly w: number;
    readonly h: number;
  };
  /** Deterministic hex signature of static visual parts for texture cache keying. */
  readonly appearanceSignature: string;
}
