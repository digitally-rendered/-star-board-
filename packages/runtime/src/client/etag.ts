/**
 * Optimistic concurrency (plan Part 2.3, typescript/02 §3). One function builds the weak ETag
 * the backend frameworks compare on PATCH/DELETE: `W/"<entity_id>:<record_version>"`.
 * Documents may arrive raw (`entity_id`) or through a generated camelCase mapper (`entityId`).
 */
export interface Versioned {
  entity_id?: string;
  record_version?: number;
  entityId?: string;
  recordVersion?: number;
}

export function etagOf(doc: Versioned): string {
  const id = doc.entityId ?? doc.entity_id;
  const version = doc.recordVersion ?? doc.record_version;
  if (id === undefined || version === undefined) {
    throw new TypeError('etagOf: document needs entity_id and record_version');
  }
  return `W/"${id}:${version}"`;
}
