import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ComponentKey, ComponentRegistry, Registration, Scope } from '@star-board/core';
import { useServices } from '../services/ServicesProvider.js';

const RegistryContext = createContext<ComponentRegistry | null>(null);
const ScopeContext = createContext<Scope | null>(null);

/** One registry per app; generated code and overrides both register into it (typescript/01 §1). */
export function RegistryProvider(props: { registry: ComponentRegistry; children?: ReactNode }) {
  return (
    <RegistryContext.Provider value={props.registry}>{props.children}</RegistryContext.Provider>
  );
}

export function useRegistry(): ComponentRegistry {
  const registry = useContext(RegistryContext);
  if (registry === null) throw new Error('useRegistry: no RegistryProvider above this component');
  return registry;
}

/**
 * The resolution scope `{ version, role }` (shared/01 §6a with role in the channel slot).
 * `version` is the FeatureModel schema version the caller is rendering; `role` defaults to the
 * current principal's first role and may be pinned explicitly (demo personas, typescript/05 §5).
 */
export function ScopeProvider(props: { version?: string; role?: string; children?: ReactNode }) {
  const value = useMemo<Scope>(() => {
    const scope: Scope = {};
    if (props.version !== undefined) scope.version = props.version;
    if (props.role !== undefined) scope.role = props.role;
    return scope;
  }, [props.version, props.role]);
  return <ScopeContext.Provider value={value}>{props.children}</ScopeContext.Provider>;
}

export function useScope(): Scope {
  const pinned = useContext(ScopeContext);
  const { auth } = useServices();
  const role = pinned?.role ?? auth.getPrincipal()?.roles[0];
  const version = pinned?.version;
  return useMemo<Scope>(() => {
    const scope: Scope = {};
    if (version !== undefined) scope.version = version;
    if (role !== undefined) scope.role = role;
    return scope;
  }, [version, role]);
}

/**
 * The registration resolved for `key` on `schema`/`target` in the current scope; render its
 * `component`, show its `source` and `specificity` in a why panel. Without a pinned version the
 * schema's version from the FeatureModel applies. A RegistryError propagates unchanged.
 */
export function useComponent<C = unknown>(
  key: ComponentKey,
  schema: string,
  target: string,
): Registration<C> {
  const registry = useRegistry();
  const scope = useScope();
  const { model } = useServices();
  const version = scope.version ?? model?.schemas[schema]?.version;
  const ctx: Scope = {};
  if (version !== undefined) ctx.version = version;
  if (scope.role !== undefined) ctx.role = scope.role;
  return registry.resolve<C>(key, schema, target, ctx);
}
