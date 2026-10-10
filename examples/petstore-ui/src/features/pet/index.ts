import type { ComponentRegistry } from '@star-board/core';
import { NameFieldWithCounter } from './components/NameFieldWithCounter.js';
import { PetDetailOverride } from './components/PetDetailOverride.js';
import { StatusChip } from './components/StatusChip.js';

/**
 * The pet overrides, one per granularity (hexagonal-rules typescript/12 §3). Registered with
 * `source: 'override'` at exact (schema, target) coordinates, so each beats the renderer's
 * universal default and the generated screen; `star-board generate` never touches this folder.
 */
export function registerPetOverrides(registry: ComponentRegistry): void {
  registry.register({
    key: 'field.text',
    schema: 'pet',
    target: 'name',
    component: NameFieldWithCounter,
    source: 'override',
  });
  registry.register({
    key: 'list.column.enum',
    schema: 'pet',
    target: 'status',
    component: StatusChip,
    source: 'override',
  });
  registry.register({
    key: 'screen.detail',
    schema: 'pet',
    target: 'pet_get',
    component: PetDetailOverride,
    source: 'override',
  });
}
