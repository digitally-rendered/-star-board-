import { useId } from 'react';

export interface FieldIds {
  id: string;
  /** The one helper-text element: error when present, otherwise help. */
  helperId: string;
}

/** Stable, unique ids for a field: `useId` keeps two forms on one page apart. */
export function useFieldIds(name: string): FieldIds {
  const uid = useId();
  const id = `field-${name}-${uid}`;
  return { id, helperId: `${id}-helper-text` };
}

export function testId(name: string): string {
  return `field-${name}`;
}
