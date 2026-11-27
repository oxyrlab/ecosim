import {
  assertFiniteVec2,
  createEcsWorld,
  createSeededRng,
  InvalidParameterError,
  type EcsWorld,
  type EntityId,
  type SeededRng,
  type Vec2,
} from '@core/index';
import {
  COLLISION_GROUP,
  type BodyHandle,
  type BodyKind,
  type PhysicsAdapter,
} from '@physics/types';
import {
  PhysicsBodyComponent,
  RenderableStubComponent,
  TagsComponent,
  TransformComponent,
} from './components';
import { FieldSet, type FieldDynamics } from './field-set';
import { SpatialHash } from './spatial-hash';

/**
 * Configuration for creating a simulation {@link World}.
 */
export interface WorldConfig {
  /** Integer seed governing all deterministic world randomness. */
  readonly seed: number;
  /** World width in SI meters (> 0). */
  readonly widthMeters: number;
  /** World height in SI meters (> 0). */
  readonly heightMeters: number;
  /** Number of grid columns for fields (>= 1). */
  readonly gridCols: number;
  /** Number of grid rows for fields (>= 1). */
  readonly gridRows: number;
  /** Spatial hash cell size in meters (default `4`). */
  readonly spatialCellSizeMeters?: number;
  /** When `true`, creates four fixed boundary walls enclosing the world (default `true`). */
  readonly addBoundaryWalls?: boolean;
  /** Optional custom field diffusion/decay overrides. */
  readonly fieldDynamics?: Readonly<Partial<Record<string, FieldDynamics>>>;
}

/**
 * Parameters for spawning a simple Phase 1 circular physical entity.
 */
export interface SimpleBodySpawnSpec {
  /** Initial position in meters. */
  readonly position: Vec2;
  /** Circle radius in meters (> 0). */
  readonly radius: number;
  /** Rigid body kind (default `'dynamic'`). */
  readonly bodyKind?: BodyKind;
  /** Initial angle in radians (default `0`). */
  readonly angle?: number;
  /** Initial linear velocity in `m/s` (default `(0, 0)`). */
  readonly linearVelocity?: Vec2;
  /** Linear damping in `1/s` (default `0.5`). */
  readonly linearDamping?: number;
  /** Angular damping in `1/s` (default `0.8`). */
  readonly angularDamping?: number;
  /** Numeric visual kind tag (default `1`). */
  readonly kind?: number;
  /** 24-bit RGB hex color (default `0x4ade80`). */
  readonly color?: number;
  /** Optional tags attached to the entity. */
  readonly tags?: readonly string[];
  /** Collision group bitmask (default `COLLISION_GROUP.CREATURE`). */
  readonly collisionGroup?: number;
}

/**
 * Root simulation state container owning the ECS, physics adapter, environmental fields,
 * spatial index, and world RNG. Contains zero DOM or rendering dependencies.
 */
export class World {
  /** Frozen configuration used to construct this world. */
  public readonly config: WorldConfig;
  /** Entity-Component-System store. */
  public readonly ecs: EcsWorld;
  /** Engine-agnostic 2D physics adapter. */
  public readonly physics: PhysicsAdapter;
  /** Grid fields for scents, soil nutrients, moisture, and light. */
  public readonly fields: FieldSet;
  /** Uniform-grid spatial index synchronized with entity transforms. */
  public readonly spatialHash: SpatialHash;
  /** Root seeded RNG for world-level stochastic events. */
  public readonly rng: SeededRng;

  /** Current fixed tick counter. */
  public tick = 0;
  /** Elapsed simulation time in seconds. */
  public timeSeconds = 0;

  private readonly wallHandles: BodyHandle[] = [];
  private readonly bodyToEntity = new Map<BodyHandle, EntityId>();

  /**
   * Creates a {@link World}.
   *
   * @param config - World dimensions, grid resolution, and seed.
   * @param physics - Initialized {@link PhysicsAdapter} (Rapier or mock).
   */
  public constructor(config: WorldConfig, physics: PhysicsAdapter) {
    if (!Number.isFinite(config.widthMeters) || config.widthMeters <= 0) {
      throw new InvalidParameterError(
        'widthMeters',
        config.widthMeters,
        'a finite number > 0',
        'World',
      );
    }
    if (!Number.isFinite(config.heightMeters) || config.heightMeters <= 0) {
      throw new InvalidParameterError(
        'heightMeters',
        config.heightMeters,
        'a finite number > 0',
        'World',
      );
    }
    if (!Number.isInteger(config.gridCols) || config.gridCols < 1) {
      throw new InvalidParameterError('gridCols', config.gridCols, 'an integer >= 1', 'World');
    }
    if (!Number.isInteger(config.gridRows) || config.gridRows < 1) {
      throw new InvalidParameterError('gridRows', config.gridRows, 'an integer >= 1', 'World');
    }

    const cellSizeX = config.widthMeters / config.gridCols;
    const cellSizeY = config.heightMeters / config.gridRows;
    if (Math.abs(cellSizeX - cellSizeY) > 1e-6) {
      throw new InvalidParameterError(
        'grid',
        {
          widthMeters: config.widthMeters,
          heightMeters: config.heightMeters,
          cols: config.gridCols,
          rows: config.gridRows,
        },
        'square grid cells (widthMeters / gridCols === heightMeters / gridRows)',
        'World',
      );
    }

    this.config = Object.freeze({ ...config });
    this.ecs = createEcsWorld();
    this.physics = physics;
    this.fields = new FieldSet({
      cols: config.gridCols,
      rows: config.gridRows,
      cellSizeMeters: cellSizeX,
      ...(config.fieldDynamics !== undefined ? { dynamics: config.fieldDynamics } : {}),
    });
    this.spatialHash = new SpatialHash(config.spatialCellSizeMeters ?? 4);
    this.rng = createSeededRng(config.seed);

    if (config.addBoundaryWalls ?? true) {
      this.createBoundaryWalls();
    }
  }

  /**
   * Spawns a simple circular physical entity into ECS, physics, and the spatial hash.
   */
  public spawnSimpleBody(spec: SimpleBodySpawnSpec): EntityId {
    assertFiniteVec2('position', spec.position, 'World.spawnSimpleBody');
    if (!Number.isFinite(spec.radius) || spec.radius <= 0) {
      throw new InvalidParameterError(
        'radius',
        spec.radius,
        'a finite number > 0',
        'World.spawnSimpleBody',
      );
    }

    const entity = this.ecs.createEntity();
    const angle = spec.angle ?? 0;
    const bodyHandle = this.physics.createBody({
      kind: spec.bodyKind ?? 'dynamic',
      position: spec.position,
      angle,
      linearDamping: spec.linearDamping ?? 0.5,
      angularDamping: spec.angularDamping ?? 0.8,
    });
    const colliderHandle = this.physics.createCollider({
      body: bodyHandle,
      shape: { kind: 'circle', radius: spec.radius },
      collisionGroup: spec.collisionGroup ?? COLLISION_GROUP.CREATURE,
      collisionMask: COLLISION_GROUP.ALL,
    });

    if (spec.linearVelocity !== undefined) {
      this.physics.setBodyVelocity(bodyHandle, spec.linearVelocity, 0);
    }

    this.bodyToEntity.set(bodyHandle, entity);
    this.ecs.addComponent(entity, TransformComponent, {
      x: spec.position.x,
      y: spec.position.y,
      angle,
    });
    this.ecs.addComponent(entity, PhysicsBodyComponent, {
      bodyHandle,
      colliderHandles: [colliderHandle],
      jointHandles: [],
      boundingRadius: spec.radius,
      isFixed: (spec.bodyKind ?? 'dynamic') === 'fixed',
    });
    this.ecs.addComponent(entity, RenderableStubComponent, {
      kind: spec.kind ?? 1,
      radius: spec.radius,
      color: spec.color ?? 0x4ade80,
    });
    this.ecs.addComponent(entity, TagsComponent, {
      values: new Set(spec.tags ?? []),
    });
    this.spatialHash.insert(entity, spec.position.x, spec.position.y, spec.radius);

    return entity;
  }

  /**
   * Registers an additional physics {@link BodyHandle} to entity mapping (used by `EntityFactory`
   * when spawning multi-body creatures).
   */
  public registerEntityBody(handle: BodyHandle, entity: EntityId): void {
    this.bodyToEntity.set(handle, entity);
  }

  /**
   * Removes an entity cleanly from physics, spatial hash, and ECS (preventing WASM handle leaks).
   */
  public removeEntity(entity: EntityId): void {
    if (!this.ecs.isAlive(entity)) return;
    const body = this.ecs.getComponent(entity, PhysicsBodyComponent);
    if (body !== undefined) {
      for (const joint of body.jointHandles) {
        this.physics.removeJoint(joint);
      }
      this.bodyToEntity.delete(body.bodyHandle);
      this.physics.removeBody(body.bodyHandle);
      if (body.extraBodyHandles !== undefined) {
        for (const extra of body.extraBodyHandles) {
          this.bodyToEntity.delete(extra);
          this.physics.removeBody(extra);
        }
      }
    }
    this.spatialHash.remove(entity);
    this.ecs.destroyEntity(entity);
  }

  /**
   * Looks up the owning {@link EntityId} for a given physics {@link BodyHandle}, or `undefined`
   * for world boundary walls or unknown handles.
   */
  public getEntityByBody(handle: BodyHandle): EntityId | undefined {
    return this.bodyToEntity.get(handle);
  }

  /**
   * Synchronizes ECS `TransformComponent` and `SpatialHash` from the physics engine's current poses.
   */
  public syncFromPhysics(): void {
    const entities = this.ecs.query(TransformComponent, PhysicsBodyComponent);
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i] as EntityId;
      const body = this.ecs.requireComponent(entity, PhysicsBodyComponent);
      if (body.isFixed) continue;
      const transform = this.ecs.requireComponent(entity, TransformComponent);
      const pose = this.physics.getBodyTransform(body.bodyHandle);
      transform.x = pose.position.x;
      transform.y = pose.position.y;
      transform.angle = pose.angle;
      this.spatialHash.update(entity, pose.position.x, pose.position.y, body.boundingRadius);
    }
  }

  /**
   * Releases all physics/WASM resources owned by this world.
   */
  public free(): void {
    this.bodyToEntity.clear();
    this.wallHandles.length = 0;
    this.spatialHash.clear();
    this.ecs.clear();
    this.physics.free();
  }

  private createBoundaryWalls(): void {
    const w = this.config.widthMeters;
    const h = this.config.heightMeters;
    const thickness = 1;
    const halfT = thickness / 2;

    const specs = [
      { x: w / 2, y: -halfT, hw: w / 2 + thickness, hh: halfT },
      { x: w / 2, y: h + halfT, hw: w / 2 + thickness, hh: halfT },
      { x: -halfT, y: h / 2, hw: halfT, hh: h / 2 + thickness },
      { x: w + halfT, y: h / 2, hw: halfT, hh: h / 2 + thickness },
    ];

    for (const wall of specs) {
      const body = this.physics.createBody({ kind: 'fixed', position: { x: wall.x, y: wall.y } });
      this.physics.createCollider({
        body,
        shape: { kind: 'rect', halfWidth: wall.hw, halfHeight: wall.hh },
        collisionGroup: COLLISION_GROUP.WALL,
        collisionMask: COLLISION_GROUP.ALL,
        restitution: 0.4,
      });
      this.wallHandles.push(body);
    }
  }
}
