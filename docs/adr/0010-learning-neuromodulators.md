# ADR 0010: Simple Event-Driven Neuromodulators for Learning

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

Phase 6 introduces lifetime learning modules (such as `threat-memory`, Section 5.3.1) that update internal associative weights only when meaningful biological events occur. Before implementing Phase 6, `docs/STATUS.md` required deciding four open questions about the neuromodulator architecture:

1. Which simulation events release which neuromodulators (`hormone.reward`, `hormone.aversive`)?
2. What strength and duration/decay should each release have?
3. Should hormone channels emit raw event magnitudes or computed prediction errors (RPE)?
4. Should learning modulators directly influence non-learning behaviors (e.g. reward suppressing fear)?

## Decision

Keep the neuromodulator layer intentionally simple, inspectable, and decoupled for v1:

1. **Two learning-trigger channels mapped to concrete biological events:**
   - `hormone.reward`: released when the creature assimilates food energy (`assimilated / maxEnergy`) or reproduces successfully (fixed `0.8` pulse).
   - `hormone.aversive`: released when the creature takes physical or starvation damage (`damage / maxHealth`).
2. **Short proportional pulses (`< 0.5 s` decay):**
   - Each release writes a normalized value in `[0, 1]` proportional to the event magnitude and decays exponentially with time constant `τ = 0.2 s` (effectively returning to `0` in `< 0.5 s`), long enough to bridge discrete ticks and overlap with eligibility traces.
3. **Raw affective values on the bus; prediction errors inside learners:**
   - `hormone.reward` and `hormone.aversive` publish raw normalized event strength so values stay transparent in the Inspector and reusable across any learning algorithm.
   - Prediction-error updates (`ΔV = α(λ − V)`) are computed inside individual learners (e.g. `RescorlaWagnerLearner` / `EligibilityTraceLearner`), not inside the hormone bus.
4. **Strict separation from non-learning behaviors:**
   - `hormone.reward` and `hormone.aversive` **only** gate learning updates (`learn()`).
   - Direct behavioral modulation remains exclusively on dedicated behavioral hormones (`hormone.adrenaline`, `hormone.satiety`, `hormone.fatigue`).

## Rejected Options

- **Centralized RPE computation in the endocrine system:** adds hidden critic state to the bus, couples all learning modules to one global expectation model, and complicates debugging.
- **Cross-wiring learning modulators into innate behavior modules:** creates unpredictable feedback loops between foraging, flight, and conditioning that make ecosystem balancing harder.

## Consequences

- Every learning module can subscribe cleanly to `hormone.reward` and/or `hormone.aversive` (and optionally accept direct `pain` pulse inputs in unit tests).
- Creatures without learning modules pay zero extra computation beyond two scalar decay operations.
- Future phases can introduce richer neuromodulator dynamics behind the same hormone channel contracts without breaking existing blueprints.
