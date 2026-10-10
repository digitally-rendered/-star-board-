import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The session-timeout primitive (typescript/05 §9): an idle timer reset by user activity. After
 * `idleMs - warningMs` of silence the state turns `warning` (the app shows its dialog); after
 * `idleMs` it turns `expired` and `onTimeout` fires once. `reset()` (the dialog's "stay signed in")
 * restarts the timer.
 */
export type SessionTimeoutState = 'active' | 'warning' | 'expired';

export interface SessionTimeoutOptions {
  /** Silence after which the session times out. */
  idleMs: number;
  /** How long before `idleMs` the warning state starts; default a fifth of `idleMs`. */
  warningMs?: number;
  onTimeout: () => void;
  /** DOM events that count as activity; default {@link ACTIVITY_EVENTS}. */
  events?: readonly string[];
  /** `false` stops the timer (no session to guard). Default true. */
  enabled?: boolean;
}

export interface SessionTimeout {
  state: SessionTimeoutState;
  /** Restart the idle timer (and leave the warning state). */
  reset: () => void;
}

/** Activity re-arms the timer at most once per this many milliseconds. */
export const ACTIVITY_THROTTLE_MS = 1_000;

export const ACTIVITY_EVENTS: readonly string[] = [
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
  'visibilitychange',
];

export function useSessionTimeout(options: SessionTimeoutOptions): SessionTimeout {
  const { idleMs, onTimeout, events = ACTIVITY_EVENTS, enabled = true } = options;
  const warningMs = options.warningMs ?? Math.floor(idleMs / 5);
  const [state, setState] = useState<SessionTimeoutState>('active');
  // The latest callback, so a re-render never re-arms the timer.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const [epoch, setEpoch] = useState(0);
  const lastResetRef = useRef(0);
  const reset = useCallback(() => {
    lastResetRef.current = Date.now();
    setState('active');
    setEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let expired = false;
    const warnAt = Math.max(0, idleMs - warningMs);
    const warning = setTimeout(() => {
      setState('warning');
    }, warnAt);
    const timeout = setTimeout(() => {
      expired = true;
      setState('expired');
      onTimeoutRef.current();
    }, idleMs);
    // Activity during the warning counts as "stay"; after expiry nothing revives the session.
    // A burst of events (scrolling) re-arms the timer once per second at most.
    const activity = () => {
      if (!expired && Date.now() - lastResetRef.current >= ACTIVITY_THROTTLE_MS) reset();
    };
    for (const name of events) window.addEventListener(name, activity, { passive: true });
    return () => {
      clearTimeout(warning);
      clearTimeout(timeout);
      for (const name of events) window.removeEventListener(name, activity);
    };
  }, [enabled, epoch, events, idleMs, reset, warningMs]);

  return { state, reset };
}
