/**
 * Minimal structured violation info carried by {@link RuleViolationError} without depending on
 * the `@rules` layer.
 */
export interface RuleViolationDetail {
  /** Kebab-case identifier of the rule that was violated. */
  readonly ruleId: string;
  /** Effective severity under which the violation was produced. */
  readonly severity: 'error' | 'warn' | 'off';
  /** Human-readable explanation of what failed, where, and why. */
  readonly message: string;
  /** Optional logical path inside the subject (e.g. `body.parts[3].shape`). */
  readonly path?: string;
}

/**
 * Base class for all domain and infrastructure errors thrown by EcoSim.
 * Every subclass sets a stable machine-readable `code` and descriptive message.
 */
export class EcoSimError extends Error {
  /** Stable machine-readable error code (SCREAMING_SNAKE_CASE). */
  public readonly code: string;

  /**
   * Creates an {@link EcoSimError}.
   *
   * @param code - Machine-readable error code.
   * @param message - Descriptive error message explaining what went wrong, where, and why.
   */
  public constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * Thrown when a parameter, argument, or boundary value fails validation.
 */
export class InvalidParameterError extends EcoSimError {
  /** Name of the invalid parameter. */
  public readonly parameter: string;
  /** The rejected value. */
  public readonly value: unknown;
  /** Description of the expected value or range. */
  public readonly expected: string;

  /**
   * Creates an {@link InvalidParameterError}.
   *
   * @param parameter - Parameter name or path.
   * @param value - Invalid value received.
   * @param expected - Description of what was expected (including units or range).
   * @param context - Optional location or operation context.
   */
  public constructor(parameter: string, value: unknown, expected: string, context?: string) {
    const location = context ? ` in ${context}` : '';
    super(
      'INVALID_PARAMETER',
      `Invalid parameter "${parameter}"${location}: received ${formatValue(value)}, expected ${expected}.`,
    );
    this.parameter = parameter;
    this.value = value;
    this.expected = expected;
  }
}

/**
 * Thrown when attempting to register an item whose id already exists in a registry.
 */
export class DuplicateRegistrationError extends EcoSimError {
  /** Name of the registry that rejected the duplicate. */
  public readonly registryName: string;
  /** Duplicate identifier. */
  public readonly id: string;

  /**
   * Creates a {@link DuplicateRegistrationError}.
   *
   * @param registryName - Human-readable registry name.
   * @param id - Identifier that was already registered.
   */
  public constructor(registryName: string, id: string) {
    super(
      'DUPLICATE_REGISTRATION',
      `Cannot register "${id}" in ${registryName} registry: an entry with this id is already registered.`,
    );
    this.registryName = registryName;
    this.id = id;
  }
}

/**
 * Thrown when looking up an unknown id in a registry.
 */
export class RegistryNotFoundError extends EcoSimError {
  /** Name of the registry that was queried. */
  public readonly registryName: string;
  /** Missing identifier. */
  public readonly id: string;
  /** Identifiers currently registered in that registry. */
  public readonly availableIds: readonly string[];

  /**
   * Creates a {@link RegistryNotFoundError}.
   *
   * @param registryName - Human-readable registry name.
   * @param id - Requested identifier.
   * @param availableIds - List of currently registered identifiers.
   */
  public constructor(registryName: string, id: string, availableIds: readonly string[]) {
    const available =
      availableIds.length > 0 ? availableIds.join(', ') : '(registry is currently empty)';
    super(
      'REGISTRY_NOT_FOUND',
      `Unknown id "${id}" in ${registryName} registry. Available ids: ${available}.`,
    );
    this.registryName = registryName;
    this.id = id;
    this.availableIds = [...availableIds];
  }
}

/**
 * Thrown when a species Blueprint fails schema or structural validation.
 */
export class BlueprintValidationError extends EcoSimError {
  /** Optional path inside the Blueprint where validation failed. */
  public readonly path: string | undefined;

  /**
   * Creates a {@link BlueprintValidationError}.
   *
   * @param message - Descriptive validation failure explanation.
   * @param path - Optional dotted path inside the Blueprint.
   */
  public constructor(message: string, path?: string) {
    const prefix = path
      ? `Blueprint validation failed at "${path}": `
      : 'Blueprint validation failed: ';
    super('BLUEPRINT_VALIDATION', `${prefix}${message}`);
    this.path = path;
  }
}

/**
 * Thrown when signal wiring references missing instances, incompatible ports, or invalid fan-in.
 */
export class WiringError extends EcoSimError {
  /** Optional source port address. */
  public readonly source: string | undefined;
  /** Optional target port address. */
  public readonly target: string | undefined;

  /**
   * Creates a {@link WiringError}.
   *
   * @param message - Descriptive explanation of the wiring error.
   * @param source - Optional source address (`<instanceId>:<port>`).
   * @param target - Optional target address (`<instanceId>:<port>`).
   */
  public constructor(message: string, source?: string, target?: string) {
    const endpoints =
      source && target
        ? ` (${source} -> ${target})`
        : source
          ? ` (from ${source})`
          : target
            ? ` (to ${target})`
            : '';
    super('WIRING_ERROR', `Signal wiring error${endpoints}: ${message}`);
    this.source = source;
    this.target = target;
  }
}

/**
 * Thrown when one or more Constraint Rules fail at `error` severity or when a locked rule is
 * illegally overridden.
 */
export class RuleViolationError extends EcoSimError {
  /** List of rule violations that caused this error. */
  public readonly violations: readonly RuleViolationDetail[];

  /**
   * Creates a {@link RuleViolationError}.
   *
   * @param message - High-level summary of the failure.
   * @param violations - Individual rule violations.
   */
  public constructor(message: string, violations: readonly RuleViolationDetail[]) {
    const details =
      violations.length > 0
        ? `\n${violations
            .map((v) => {
              const loc = v.path ? ` [${v.path}]` : '';
              return `- (${v.ruleId})${loc}: ${v.message}`;
            })
            .join('\n')}`
        : '';
    super('RULE_VIOLATION', `${message}${details}`);
    this.violations = [...violations];
  }
}

/**
 * Thrown when an internal simulation invariant is broken (e.g. operating on a dead entity).
 */
export class InvariantViolationError extends EcoSimError {
  /**
   * Creates an {@link InvariantViolationError}.
   *
   * @param message - Explanation of the broken invariant.
   */
  public constructor(message: string) {
    super('INVARIANT_VIOLATION', `Simulation invariant violated: ${message}`);
  }
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
