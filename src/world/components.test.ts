import { describe, expect, it } from 'vitest';
import {
  PhysicsBodyComponent,
  RenderableStubComponent,
  TagsComponent,
  TransformComponent,
} from './components';

describe('world ECS components', () => {
  it('defines stable kebab-case component tokens', () => {
    expect(TransformComponent.id).toBe('transform');
    expect(PhysicsBodyComponent.id).toBe('physics-body');
    expect(RenderableStubComponent.id).toBe('renderable-stub');
    expect(TagsComponent.id).toBe('tags');
  });
});
