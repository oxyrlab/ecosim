import { registerBrainModule } from './module-def';
import { threatMemoryModule } from './learning/threat-memory';
import { nnControllerModule } from './nn/nn-module';

registerBrainModule(nnControllerModule);
registerBrainModule(threatMemoryModule);

export * from './learning';
export {
  brainModuleRegistry,
  defineBrainModule,
  registerBrainModule,
  type BrainModuleDef,
  type BrainModuleHandles,
  type BrainModuleInstance,
  type BrainModuleKind,
} from './module-def';
export * from './modules';
export * from './nn';
