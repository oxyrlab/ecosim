export { createMockPhysicsAdapter } from './mock-adapter';
export { createRapierPhysicsAdapter, createRapierPhysicsAdapterSync } from './rapier-adapter';
export { initRapier, isRapierInitialized } from './rapier-init';
export {
  COLLISION_GROUP,
  type BodyDesc,
  type BodyHandle,
  type BodyKind,
  type BodyTransform,
  type ColliderDesc,
  type ColliderHandle,
  type ColliderShapeDesc,
  type CollisionEvent,
  type JointDesc,
  type JointHandle,
  type PhysicsAdapter,
  type PhysicsStats,
  type RaycastHit,
} from './types';
