# ADR 0003: Lightweight Custom ECS with TypedArrays for Hot Paths

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Both animals and plants share a common world lifecycle (position, energy, age, tags, death, corpses), while animals additionally attach bodies, organs, signal buses, brains, and spines. We need a clean data model that is easy for humans and AI assistants to read without third-party ECS magic, while hitting a <= 8 ms tick budget.

## Decision

Implement a **lightweight custom ECS** (`src/core/ecs.ts`) using positive integer `EntityId`s and typed component maps, with deterministic ascending-id query order. Reserve `Float32Array` structures for actual hot paths (world grid fields, `SignalBus`, neural networks, and learners).

## Rejected options

- **bitECS:** Maximum raw throughput, but sparse-typed SoA schemas hurt readability and complicate variable-size per-creature structures (part trees, buses, brains).
- **Class inheritance hierarchy (`Entity -> Living -> Animal -> Rabbit`):** Rigid coupling; conflicts with declarative data Blueprints and plant/animal sharing.

## Consequences

- **Positive:** ~200 lines of transparent, zero-dependency, 100%-tested code with deterministic iteration order.
- **Positive:** Hot numerical loops still use `Float32Array` without GC pressure.
- **Negative:** If profiling in Phase 8 reveals ECS lookup bottlenecks, specific hot components can migrate to dense typed arrays behind the same API.
