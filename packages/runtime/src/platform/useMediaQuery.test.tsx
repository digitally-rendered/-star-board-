import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_MEDIA_QUERY, useCompactLayout, useMediaQuery } from './useMediaQuery.js';

type Listener = (event: { matches: boolean }) => void;

/** A controllable `matchMedia`: one list per query, flipped through `set`. */
function installMatchMedia(initial: Record<string, boolean>) {
  const lists = new Map<string, { matches: boolean; listeners: Set<Listener> }>();
  const matchMedia = vi.fn((query: string) => {
    const entry = lists.get(query) ?? { matches: initial[query] ?? false, listeners: new Set() };
    lists.set(query, entry);
    return {
      get matches() {
        return entry.matches;
      },
      media: query,
      addEventListener: (_: 'change', listener: Listener) => {
        entry.listeners.add(listener);
      },
      removeEventListener: (_: 'change', listener: Listener) => {
        entry.listeners.delete(listener);
      },
    } as unknown as MediaQueryList;
  });
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    set(query: string, matches: boolean) {
      const entry = lists.get(query);
      if (!entry) throw new Error(`no list for ${query}`);
      entry.matches = matches;
      for (const listener of entry.listeners) listener({ matches });
    },
    listeners: (query: string) => lists.get(query)?.listeners.size ?? 0,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery / useCompactLayout', () => {
  it('reports the current match and follows change events', () => {
    const media = installMatchMedia({ [COMPACT_MEDIA_QUERY]: false });
    const { result, unmount } = renderHook(() => useCompactLayout());
    expect(result.current).toBe(false);
    act(() => {
      media.set(COMPACT_MEDIA_QUERY, true);
    });
    expect(result.current).toBe(true);
    expect(media.listeners(COMPACT_MEDIA_QUERY)).toBe(1);
    unmount();
    expect(media.listeners(COMPACT_MEDIA_QUERY)).toBe(0);
  });

  it('is false without matchMedia (server, bare jsdom)', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1px)'));
    expect(result.current).toBe(false);
  });
});
