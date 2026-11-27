import type { BodyPartSpec } from '@appearance/types';
import type { WireSpec, WiringEndpoint } from '@bus/wiring';

/**
 * Minimal structural slice of a species Blueprint inspected by appearance, physics, and
 * nervous-system Constraint Rules without coupling `rules` to `genome`.
 */
export interface BlueprintBodySubject {
  /** Body part tree declared in the Blueprint. */
  readonly body: {
    readonly parts: readonly BodyPartSpec[];
  };
  /** Optional growth scale multiplier at which to evaluate physical dimensions (default `1`). */
  readonly scale?: number;
  /** Optional brain module declarations checked by brain & learning rules. */
  readonly brain?: {
    readonly modules: readonly {
      readonly instanceId: string;
      readonly module?: string;
      readonly params?: unknown;
    }[];
  };
  /** Optional resolved component endpoints and static wire list checked by bus/wiring rules. */
  readonly nervousGraph?: {
    readonly endpoints: readonly WiringEndpoint[];
    readonly wires: readonly WireSpec[];
  };
}
