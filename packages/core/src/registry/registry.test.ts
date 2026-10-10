import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ComponentRegistry,
  specificityOf,
  type RegistrationInput,
  type Scope,
} from './registry.js';
import { RegistryError } from '../errors/index.js';

const reg = (over: Partial<RegistrationInput<string>> = {}): RegistrationInput<string> => ({
  key: 'field.text',
  schema: '*',
  target: '*',
  component: 'generated',
  source: 'generated',
  ...over,
});

describe('specificity (shared/01 §6a, role for channel)', () => {
  it('scores version+role 4, role 3, version 2, universal 1', () => {
    expect(specificityOf({})).toBe(1);
    expect(specificityOf({ version: '1' })).toBe(2);
    expect(specificityOf({ role: 'staff' })).toBe(3);
    expect(specificityOf({ version: '1', role: 'staff' })).toBe(4);
  });
});

describe('ComponentRegistry', () => {
  it('resolves the universal generated match when nothing else is registered', () => {
    const r = new ComponentRegistry();
    r.register(reg());
    expect(r.resolve('field.text', 'pet', 'name').component).toBe('generated');
  });
  it('an override at the same coordinates beats the generated registration', () => {
    const r = new ComponentRegistry();
    r.register(reg());
    r.register(reg({ source: 'override', component: 'custom' }));
    expect(r.resolve('field.text', 'pet', 'name').component).toBe('custom');
  });
  it('schema- and target-specific registrations beat universal ones; scope beats both only within the same exactness', () => {
    const r = new ComponentRegistry();
    r.register(reg({ component: 'universal' }));
    r.register(reg({ schema: 'pet', component: 'pet-any-field' }));
    r.register(reg({ schema: 'pet', target: 'name', component: 'pet-name' }));
    r.register(
      reg({ schema: 'pet', target: 'name', scope: { role: 'staff' }, component: 'pet-name-staff' }),
    );
    expect(r.resolve('field.text', 'pet', 'name').component).toBe('pet-name');
    expect(r.resolve('field.text', 'pet', 'name', { role: 'staff' }).component).toBe(
      'pet-name-staff',
    );
    expect(r.resolve('field.text', 'pet', 'other').component).toBe('pet-any-field');
    expect(r.resolve('field.text', 'order', 'x').component).toBe('universal');
  });
  it('excludes a registration whose scope constraint does not match', () => {
    const r = new ComponentRegistry();
    r.register(reg({ scope: { role: 'admin' }, component: 'admin-only' }));
    expect(() => r.resolve('field.text', 'pet', 'name', { role: 'staff' })).toThrow(RegistryError);
    expect(() => r.resolve('field.text', 'pet', 'name')).toThrow(/no registration/);
  });
  it('rejects a duplicate at equal specificity and an unknown key', () => {
    const r = new ComponentRegistry();
    r.register(reg({ source: 'override' }));
    expect(() => r.register(reg({ source: 'override' }))).toThrow(/duplicate/);
    expect(() => r.register(reg({ key: 'field.nope' as never }))).toThrow(/unknown component key/);
  });
  it('lists by filter', () => {
    const r = new ComponentRegistry();
    r.register(reg());
    r.register(reg({ key: 'action.create', source: 'override' }));
    expect(r.list({ source: 'override' })).toHaveLength(1);
    expect(r.size).toBe(2);
  });

  it('property: resolution is a total stable order independent of registration order', () => {
    const scopeArb: fc.Arbitrary<Scope> = fc.record(
      { version: fc.constantFrom('1', '2'), role: fc.constantFrom('staff', 'customer') },
      { requiredKeys: [] },
    );
    const inputArb = fc.record({
      schema: fc.constantFrom('*', 'pet', 'order'),
      target: fc.constantFrom('*', 'name', 'status'),
      scope: scopeArb,
      source: fc.constantFrom<'generated' | 'override'>('generated', 'override'),
    });
    fc.assert(
      fc.property(
        fc.uniqueArray(inputArb, {
          minLength: 1,
          maxLength: 12,
          comparator: (a, b) => JSON.stringify(a) === JSON.stringify(b),
        }),
        fc.constantFrom('pet', 'order'),
        fc.constantFrom('name', 'status'),
        scopeArb,
        (inputs, schema, target, ctx) => {
          const build = (order: typeof inputs) => {
            const r = new ComponentRegistry();
            order.forEach((i, idx) =>
              r.register({ key: 'field.text', component: `c${String(idx)}`, ...i }),
            );
            return r;
          };
          const forward = build(inputs);
          const reversed = build([...inputs].reverse());
          const pick = (r: ComponentRegistry) => {
            try {
              const w = r.resolve('field.text', schema, target, ctx);
              return JSON.stringify([w.schema, w.target, w.scope, w.source]);
            } catch {
              return 'unresolved';
            }
          };
          // Coordinates (not component ids) must agree: the same best row wins regardless of order
          // except when two rows tie on every rank key, which only happens for identical coordinates
          // and is rejected at registration.
          expect(pick(forward)).toBe(pick(reversed));
        },
      ),
      { numRuns: 300 },
    );
  });
});
