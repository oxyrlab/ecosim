import { registerBrainModule } from '../module-def';
import { behaviorArbiterModule } from './behavior-arbiter';
import { hungerDriveModule } from './hunger-drive';
import { randomWanderModule } from './random-wander';
import { seekGradientModule } from './seek-gradient';

/**
 * All shared Phase 5 brain modules automatically registered into {@link brainModuleRegistry}.
 */
export const BUILTIN_BRAIN_MODULES = [
  hungerDriveModule,
  seekGradientModule,
  randomWanderModule,
  behaviorArbiterModule,
] as const;

registerBrainModule(hungerDriveModule);
registerBrainModule(seekGradientModule);
registerBrainModule(randomWanderModule);
registerBrainModule(behaviorArbiterModule);

export {
  behaviorArbiterModule,
  behaviorArbiterParamsSchema,
  type BehaviorArbiterParams,
} from './behavior-arbiter';
export { hungerDriveModule, hungerDriveParamsSchema, type HungerDriveParams } from './hunger-drive';
export {
  randomWanderModule,
  randomWanderParamsSchema,
  type RandomWanderParams,
} from './random-wander';
export {
  seekGradientModule,
  seekGradientParamsSchema,
  type SeekGradientParams,
} from './seek-gradient';
