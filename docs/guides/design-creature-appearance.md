# Guide: Design Creature Appearance

Use declarative part trees (`BodyPartSpec[]`) with the 7 registered shapes in [docs/catalog/shapes.md](../catalog/shapes.md).

## Common Body Plans

1. **Single shape:** One root part (e.g. simple microbe, berry, seed).
2. **Rigid compound (`cat` pattern):** Physical `torso` + `fixed` `head`, `visual` mirrored ears/paws (with actuators on visual limbs pushing the torso), and an optional `revolute` tail. See `CAT_BODY_PARTS` in `tests/fixtures/creatures.ts`.
3. **Jointed chain (`worm` pattern):** Use `chain({ count, shape, joint })` from `@appearance/index` to link segments back-to-front with revolute joints. See `WORM_BODY_PARTS` in `tests/fixtures/creatures.ts`.

## Best Practices

- Keep decorative parts `joint: 'visual'` so they add zero solver cost and never trip `min-collider-size`.
- Use `mirror: true` for symmetric limbs, eyes, ears, and differential-drive thrusters (`$actuator:power` resolves automatically to `thrust.l:power` / `thrust.r:power`).
- Check your Blueprint against all active rules in [docs/catalog/rules.md](../catalog/rules.md) via `evaluateRules('blueprint', blueprint, resolveRules())`.
