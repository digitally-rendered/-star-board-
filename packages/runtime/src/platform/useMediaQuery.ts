import { useSyncExternalStore } from 'react';

/**
 * Mobile breakpoints (typescript/05 §6): below this width a generated table becomes a card list
 * and forms go single-column. One authority for the threshold; the renderer reads it too.
 */
export const COMPACT_BREAKPOINT_PX = 600;
export const COMPACT_MEDIA_QUERY = `(max-width: ${COMPACT_BREAKPOINT_PX - 0.05}px)`;

function subscribe(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => {
    list.removeEventListener('change', onChange);
  };
}

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** Whether `query` matches; false where `matchMedia` is missing (server, bare jsdom). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => matches(query),
    () => false,
  );
}

/** True under the `sm` breakpoint: the container hands it to the screen as `compact`. */
export function useCompactLayout(): boolean {
  return useMediaQuery(COMPACT_MEDIA_QUERY);
}
