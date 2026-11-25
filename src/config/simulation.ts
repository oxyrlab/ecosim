/**
 * Default simulation update rates and fixed-timestep constants (all in SI units).
 * These are baseline configuration defaults, not hard-coded limits.
 */
export interface SimulationConfig {
  /** Physics integration frequency in Hz (default `30` Hz -> `dt = 1/30 s`). */
  readonly physicsRateHz: number;
  /** Fixed simulation timestep in seconds (`1 / physicsRateHz`). */
  readonly fixedTimestepSeconds: number;
  /** Default brain module tick frequency in Hz (`10` Hz). */
  readonly brainRateHz: number;
  /** Default vision sensor sampling frequency in Hz (`10` Hz). */
  readonly visionSampleRateHz: number;
  /** Default field diffusion frequency in Hz (`5` Hz). */
  readonly fieldDiffusionRateHz: number;
}

/**
 * Default simulation rates per Section 5.12 of the architecture specification.
 */
export const SIMULATION_DEFAULTS: SimulationConfig = Object.freeze({
  physicsRateHz: 30,
  fixedTimestepSeconds: 1 / 30,
  brainRateHz: 10,
  visionSampleRateHz: 10,
  fieldDiffusionRateHz: 5,
});
