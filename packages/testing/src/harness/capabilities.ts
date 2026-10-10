import type { FeatureModel } from '@star-board/core';
import type { Principal } from '@star-board/runtime';

/** Every capability any operation of the document names, sorted. */
export function allCapabilities(model: FeatureModel): string[] {
  return [...new Set(Object.values(model.operations).flatMap((op) => op.capabilities))].sort();
}

/** A principal holding exactly `capabilities` (role `staff` unless given). */
export function principalFor(capabilities: readonly string[], role = 'staff'): Principal {
  return { id: `principal-${role}`, roles: [role], capabilities: [...capabilities] };
}

export interface CapabilityCase {
  operationId: string;
  schema: string;
  /** The capabilities the operation requires (`x-capabilities`). */
  capabilities: string[];
  /** Holds every capability of the document: sees the action, the handler answers. */
  with: Principal;
  /** Holds every capability except the operation's: no action, the handler denies by posture. */
  without: Principal;
}

/**
 * The hide/deny matrix (hexagonal-rules shared/13 §3): for every operation with a capability, the
 * principal that may perform it and the one that may not. The same filter hides the action in the
 * UI and denies the request, so a test renders with each and asserts both halves.
 */
export function capabilityCases(model: FeatureModel): CapabilityCase[] {
  const all = allCapabilities(model);
  return Object.values(model.operations)
    .filter((op) => op.capabilities.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((op) => ({
      operationId: op.id,
      schema: op.schema,
      capabilities: [...op.capabilities],
      with: principalFor(all),
      without: principalFor(all.filter((cap) => !op.capabilities.includes(cap))),
    }));
}
