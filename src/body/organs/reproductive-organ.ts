import { z } from 'zod';
import { defineComponent, rotate, type EntityId, type Vec2 } from '@core/index';
import { defineOrgan } from './organ-def';

/**
 * Biological sex derived directly from which reproductive organ an animal carries.
 */
export type BiologicalSex = 'male' | 'female';

/**
 * Registered organ IDs for the two complementary animal reproductive organs.
 */
export type ReproductiveOrganId = 'reproductive-male' | 'reproductive-female';

/**
 * Subtle visual spot colors rendered on animals to indicate their reproductive organ without
 * adding heavy anatomical geometry.
 */
export const REPRODUCTIVE_ORGAN_COLORS = Object.freeze({
  male: 0x38bdf8,
  female: 0xf472b6,
} as const);

/**
 * Male reproductive organ definition: lightweight torso-anchored organ (no separate Rapier
 * collider) capable of hosting a {@link reproductiveSensor} and signaling organ contact.
 */
export const reproductiveMaleOrgan = defineOrgan({
  id: 'reproductive-male',
  description:
    'Lightweight male reproductive organ anchored to the torso that signals complementary contact.',
  params: z.object({}).default({}),
  defaultShape: { type: 'circle', r: 0.04 },
  sensorSlots: 1,
  actuatorSlot: false,
  massDensity: 0.5,
});

/**
 * Female reproductive organ definition: lightweight torso-anchored organ (no separate Rapier
 * collider) capable of hosting a {@link reproductiveSensor} and signaling organ contact.
 */
export const reproductiveFemaleOrgan = defineOrgan({
  id: 'reproductive-female',
  description:
    'Lightweight female reproductive organ anchored to the torso that signals complementary contact.',
  params: z.object({}).default({}),
  defaultShape: { type: 'circle', r: 0.04 },
  sensorSlots: 1,
  actuatorSlot: false,
  massDensity: 0.5,
});

/**
 * Runtime ECS state of an animal's reproductive organ (single source of truth for biological sex,
 * subtle marker color, organ anchor offset, and live complementary contact state).
 */
export interface ReproductiveOrganData {
  /** Which reproductive organ the entity carries (`'reproductive-male'` or `'reproductive-female'`). */
  readonly organId: ReproductiveOrganId;
  /** Convenience biological sex derived from `organId`. */
  readonly sex: BiologicalSex;
  /** Local anchor offset on the creature's torso in meters (zero extra physics colliders). */
  readonly localOffset: Vec2;
  /** Contact overlap radius in meters used for organ-to-organ signaling. */
  readonly contactRadiusMeters: number;
  /** Subtle visual spot color rendered on the entity (`REPRODUCTIVE_ORGAN_COLORS`). */
  readonly markerColor: number;
  /** Whether a complementary conspecific reproductive organ is currently overlapping this organ. */
  inContact: boolean;
  /** Entity ID of the complementary conspecific currently in contact, or `null`. */
  contactPartnerId: EntityId | null;
}

/**
 * ECS component storing an animal's reproductive organ and live contact signal state.
 */
export const ReproductiveOrganComponent = defineComponent<ReproductiveOrganData>(
  'reproductive-organ',
  'ReproductiveOrgan',
);

/**
 * Maps a {@link ReproductiveOrganId} to its corresponding {@link BiologicalSex}.
 */
export function organIdToSex(organId: ReproductiveOrganId): BiologicalSex {
  return organId === 'reproductive-male' ? 'male' : 'female';
}

/**
 * Maps a {@link BiologicalSex} to its corresponding {@link ReproductiveOrganId}.
 */
export function sexToOrganId(sex: BiologicalSex): ReproductiveOrganId {
  return sex === 'male' ? 'reproductive-male' : 'reproductive-female';
}

/**
 * Creates a fresh {@link ReproductiveOrganData} component payload for `organId`.
 */
export function createReproductiveOrganData(
  organId: ReproductiveOrganId,
  options: {
    readonly localOffset?: Vec2;
    readonly contactRadiusMeters?: number;
  } = {},
): ReproductiveOrganData {
  const sex = organIdToSex(organId);
  return {
    organId,
    sex,
    localOffset: options.localOffset ?? { x: -0.1, y: 0 },
    contactRadiusMeters: options.contactRadiusMeters ?? 0.22,
    markerColor: REPRODUCTIVE_ORGAN_COLORS[sex],
    inContact: false,
    contactPartnerId: null,
  };
}

/**
 * Returns `true` when two reproductive organs are biologically complementary (`male` + `female`).
 */
export function areOrgansComplementary(
  a: Pick<ReproductiveOrganData, 'organId'>,
  b: Pick<ReproductiveOrganData, 'organId'>,
): boolean {
  return a.organId !== b.organId;
}

/**
 * Computes the world-space position of a torso-anchored reproductive organ.
 */
export function computeOrganWorldPosition(
  bodyPos: Vec2,
  bodyAngle: number,
  localOffset: Vec2,
): Vec2 {
  const rotated = rotate(localOffset, bodyAngle);
  return { x: bodyPos.x + rotated.x, y: bodyPos.y + rotated.y };
}
