import { RegistryError } from '../errors/index.js';
import { isComponentKey, type ComponentKey } from '../contract/keys.js';

/**
 * Scope resolution (hexagonal-rules shared/01 §6a) with `role` in the channel slot:
 * version+role 4, role 3, version 2, universal 1; a non-matching constraint excludes the
 * registration. Ties are broken by schema exactness, target exactness, source (override beats
 * generated) and registration order, so resolution is a total stable order.
 */
export interface Scope {
  version?: string;
  role?: string;
}
export type Specificity = 1 | 2 | 3 | 4;
export type Source = 'generated' | 'override';

export interface RegistrationInput<C = unknown> {
  key: ComponentKey;
  /** schema name or '*' */
  schema: string;
  /** operation, field or slot name, or '*' */
  target: string;
  scope?: Scope;
  component: C;
  source: Source;
}
export interface Registration<C = unknown> extends Required<
  Pick<RegistrationInput<C>, 'key' | 'schema' | 'target' | 'component' | 'source'>
> {
  scope: Scope;
  specificity: Specificity;
  order: number;
}

export function specificityOf(scope: Scope): Specificity {
  if (scope.version !== undefined && scope.role !== undefined) return 4;
  if (scope.role !== undefined) return 3;
  if (scope.version !== undefined) return 2;
  return 1;
}

function scopeMatches(reg: Scope, ctx: Scope): boolean {
  if (reg.version !== undefined && reg.version !== ctx.version) return false;
  if (reg.role !== undefined && reg.role !== ctx.role) return false;
  return true;
}

const SOURCE_RANK: Record<Source, number> = { generated: 0, override: 1 };

function rank(
  r: Registration,
  schema: string,
  target: string,
): [number, number, number, number, number] {
  return [
    r.schema === schema ? 1 : 0,
    r.target === target ? 1 : 0,
    r.specificity,
    SOURCE_RANK[r.source],
    -r.order,
  ];
}
function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function sameCoordinates(a: Registration, b: RegistrationInput): boolean {
  return (
    a.key === b.key &&
    a.schema === b.schema &&
    a.target === b.target &&
    a.source === b.source &&
    a.scope.version === b.scope?.version &&
    a.scope.role === b.scope?.role
  );
}

export class ComponentRegistry {
  private readonly rows: Registration[] = [];
  private order = 0;

  register<C>(input: RegistrationInput<C>): Registration<C> {
    if (!isComponentKey(input.key)) {
      throw new RegistryError(
        'REGISTRY_UNKNOWN_KEY',
        `unknown component key ${String(input.key)}`,
        { key: input.key },
      );
    }
    const dup = this.rows.find((r) => sameCoordinates(r, input));
    if (dup) {
      throw new RegistryError(
        'REGISTRY_DUPLICATE_SPECIFICITY',
        `duplicate ${input.source} registration for ${input.key} ${input.schema}/${input.target} at equal specificity`,
        { key: input.key, schema: input.schema, target: input.target, scope: input.scope ?? {} },
      );
    }
    const scope = { ...(input.scope ?? {}) };
    const row: Registration<C> = {
      key: input.key,
      schema: input.schema,
      target: input.target,
      component: input.component,
      source: input.source,
      scope,
      specificity: specificityOf(scope),
      order: this.order++,
    };
    this.rows.push(row);
    return row;
  }

  /** Deterministic: the best-ranked matching registration, or REGISTRY_UNRESOLVED. */
  resolve<C = unknown>(
    key: ComponentKey,
    schema: string,
    target: string,
    ctx: Scope = {},
  ): Registration<C> {
    const candidates = this.rows.filter(
      (r) =>
        r.key === key &&
        (r.schema === '*' || r.schema === schema) &&
        (r.target === '*' || r.target === target) &&
        scopeMatches(r.scope, ctx),
    );
    if (candidates.length === 0) {
      throw new RegistryError(
        'REGISTRY_UNRESOLVED',
        `no registration for ${key} ${schema}/${target}`,
        { key, schema, target, ctx },
      );
    }
    candidates.sort((a, b) => compareRank(rank(a, schema, target), rank(b, schema, target)));
    return candidates[0] as Registration<C>;
  }

  list(
    filter: Partial<Pick<Registration, 'key' | 'schema' | 'target' | 'source'>> = {},
  ): readonly Registration[] {
    return this.rows.filter(
      (r) =>
        (filter.key === undefined || r.key === filter.key) &&
        (filter.schema === undefined || r.schema === filter.schema) &&
        (filter.target === undefined || r.target === filter.target) &&
        (filter.source === undefined || r.source === filter.source),
    );
  }

  get size(): number {
    return this.rows.length;
  }
}
