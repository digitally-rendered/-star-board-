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
  const { idleMs, onTimeout, enabled = true } = options;
  const warningMs = options.warningMs ?? Math.floor(idleMs / 5);
  // The event list is keyed by value: a consumer passing a fresh array on every render must not
  // re-arm the timer each render (that would keep a session alive forever).
  const eventsKey = (options.events ?? ACTIVITY_EVENTS).join(',');
  const eventsRef = useRef<readonly string[]>(options.events ?? ACTIVITY_EVENTS);
  eventsRef.current = options.events ?? ACTIVITY_EVENTS;
  const [state, setState] = useState<SessionTimeoutState>('active');
  // The latest callback, so a re-render never re-arms the timer.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const [epoch, setEpoch] = useState(0);
  const lastResetRef = useRef(0);
  // Wall-clock deadline: timers pause while a tab sleeps, so expiry is also checked against the
  // clock on every activity or visibility change. Expiry is terminal: `reset()` never revives it.
  const deadlineRef = useRef(Number.POSITIVE_INFINITY);
  // Disabling the guard is explicit (`enabled: false`); it never happens by drift.
  const expiredRef = useRef(false);
  const expire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setState('expired');
    onTimeoutRef.current();
  }, []);
  const reset = useCallback(() => {
    if (expiredRef.current) return;
    lastResetRef.current = Date.now();
    deadlineRef.current = Date.now() + idleMs;
    setState('active');
    setEpoch((n) => n + 1);
  }, [idleMs]);

  useEffect(() => {
    if (!enabled || expiredRef.current) return undefined;
    // Every arm (mount, reset, a changed idle limit, re-enable) sets the deadline the timers
    // below are counting towards, so the clock check and the timers can never disagree.
    deadlineRef.current = Date.now() + idleMs;
    const warnAt = Math.max(0, idleMs - warningMs);
    const warning = setTimeout(() => {
      setState('warning');
    }, warnAt);
    const timeout = setTimeout(expire, idleMs);
    // The clock decides: if the deadline passed while timers were suspended, expire now.
    const checkClock = (): boolean => {
      if (Date.now() >= deadlineRef.current) {
        expire();
        return true;
      }
      return false;
    };
    // Genuine activity re-arms the timer (once per throttle window); a tab becoming visible is not
    // activity, it only triggers the clock check.
    const activity = (event: Event) => {
      if (checkClock()) return;
      if (event.type === 'visibilitychange') return;
      if (Date.now() - lastResetRef.current >= ACTIVITY_THROTTLE_MS) reset();
    };
    const events = eventsRef.current;
    for (const name of events) window.addEventListener(name, activity, { passive: true });
    document.addEventListener('visibilitychange', activity);
    return () => {
      clearTimeout(warning);
      clearTimeout(timeout);
      for (const name of events) window.removeEventListener(name, activity);
      document.removeEventListener('visibilitychange', activity);
    };
    // eventsKey stands in for the events array so an unstable array identity cannot re-arm.
  }, [enabled, epoch, eventsKey, expire, idleMs, reset, warningMs]);

  return { state, reset };
}
