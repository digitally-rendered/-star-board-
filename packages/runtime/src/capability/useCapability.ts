import type { OperationEntry } from '@star-board/core';
import { useServices } from '../services/ServicesProvider.js';

/** Pure: an operation is permitted when the principal holds every capability it names. */
export function hasCapabilities(
  capabilities: readonly string[] | undefined,
  required: readonly string[],
): boolean {
  if (capabilities === undefined) return false;
  return required.every((cap) => capabilities.includes(cap));
}

export function filterOperations<O extends Pick<OperationEntry, 'capabilities'>>(
  operations: readonly O[],
  capabilities: readonly string[] | undefined,
): O[] {
  return operations.filter((op) => hasCapabilities(capabilities, op.capabilities));
}

/** True when the current principal holds `cap`; false when anonymous. */
export function useCapability(cap: string): boolean {
  const { auth } = useServices();
  return hasCapabilities(auth.getPrincipal()?.capabilities, [cap]);
}

/**
 * The operations the principal may perform: this is what hides actions and screens, and it is
 * the same filter the application MCP applies to its tool list (shared/13 §3).
 */
export function useCapabilities<O extends Pick<OperationEntry, 'capabilities'>>(
  ops: readonly O[],
): O[] {
  const { auth } = useServices();
  return filterOperations(ops, auth.getPrincipal()?.capabilities);
}
