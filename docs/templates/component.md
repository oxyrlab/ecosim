---
id: <kind>/<kebab-case-id>
kind: organ | sensor | actuator | brain-module | spine | shape | rule | species
status: experimental
files: [src/path/to/component.ts]
tests: [src/path/to/component.test.ts]
depends-on: []
---

# Component Name

**Purpose:** 1-2 sentences describing what this component does.

## Ports

| Port      | Direction | Kind   | Range    | Unit       | Description |
| --------- | --------- | ------ | -------- | ---------- | ----------- |
| `example` | out       | analog | `[0, 1]` | normalized | Description |

## Params

| Name           | Type   | Default | Range    | Description |
| -------------- | ------ | ------- | -------- | ----------- |
| `exampleParam` | number | `1`     | `(0, ∞)` | Description |

## Behavior

Short, precise description with formulas if applicable.

## Interactions

Which systems, fields, or components this component interacts with.

## Rules

Which Constraint Rules apply to this component.

## Example

```ts
// Minimal Blueprint snippet
```

## Gotchas

Pitfalls, edge cases, and performance notes.
