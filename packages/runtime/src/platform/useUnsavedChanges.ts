import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router';

/**
 * The unsaved-changes primitive (typescript/05 §9): while `isDirty`, in-app navigation is held
 * back through react-router's blocker and the tab asks before unloading. The screen renders the
 * renderer's `UnsavedChangesDialog` from `blocked` and wires `stay` / `leave`; the navigation that
 * follows a successful save goes through `release` so it is never questioned.
 *
 * Needs a data router (`createBrowserRouter` / `createMemoryRouter`), which the generated route
 * table assumes.
 */
export interface UnsavedChanges {
  /** True while a navigation is held back: show the dialog. */
  blocked: boolean;
  /** Keep editing: drop the held navigation. */
  stay: () => void;
  /** Discard the changes: continue the held navigation. */
  leave: () => void;
  /** Runs `navigate` with the guard lifted (after a successful save). */
  release: <T>(navigate: () => T) => T;
}

export function useUnsavedChanges(isDirty: boolean): UnsavedChanges {
  // The blocker reads a ref so `release` can lift the guard synchronously, before React re-renders.
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) =>
        dirtyRef.current &&
        (currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search),
      [],
    ),
  );
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [isDirty]);
  const stay = useCallback(() => {
    blocker.reset?.();
  }, [blocker]);
  const leave = useCallback(() => {
    blocker.proceed?.();
  }, [blocker]);
  const release = useCallback(<T>(navigate: () => T): T => {
    dirtyRef.current = false;
    return navigate();
  }, []);
  return { blocked: blocker.state === 'blocked', stay, leave, release };
}
