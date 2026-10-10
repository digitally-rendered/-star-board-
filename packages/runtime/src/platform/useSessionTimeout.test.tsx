import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_THROTTLE_MS, useSessionTimeout } from './useSessionTimeout.js';

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns before the idle limit, then expires once', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useSessionTimeout({ idleMs: 10_000, warningMs: 2_000, onTimeout }),
    );
    expect(result.current.state).toBe('active');
    act(() => {
      vi.advanceTimersByTime(7_999);
    });
    expect(result.current.state).toBe('active');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state).toBe('warning');
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.state).toBe('expired');
    expect(onTimeout).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(60_000);
      window.dispatchEvent(new Event('keydown'));
      vi.advanceTimersByTime(60_000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('expired');
  });

  it('activity and reset() restart the timer; a burst re-arms once per throttle window', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout({ idleMs: 10_000, onTimeout }));
    act(() => {
      vi.advanceTimersByTime(8_500);
    });
    expect(result.current.state).toBe('warning');
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(result.current.state).toBe('active');
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => {
      result.current.reset();
    });
    act(() => {
      vi.advanceTimersByTime(ACTIVITY_THROTTLE_MS - 1);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(9_000);
    });
    // The scroll inside the throttle window did not re-arm: 10s after reset the session expires.
    expect(result.current.state).toBe('warning');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useSessionTimeout({ idleMs: 1_000, onTimeout, enabled: false }),
    );
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.state).toBe('active');
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

describe('useSessionTimeout fails closed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reset() does not revive an expired session', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout({ idleMs: 1_000, onTimeout }));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.state).toBe('expired');
    act(() => {
      result.current.reset();
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.state).toBe('expired');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('expires by wall clock when timers were suspended (tab asleep) and the tab becomes visible', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout({ idleMs: 10_000, onTimeout }));
    act(() => {
      vi.setSystemTime(Date.now() + 60_000); // the clock moved; no timer fired
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.state).toBe('expired');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('a visibility change alone is not activity and does not re-arm the timer', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout({ idleMs: 10_000, onTimeout }));
    act(() => {
      vi.advanceTimersByTime(8_500);
    });
    expect(result.current.state).toBe('warning');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.state).toBe('warning');
  });

  it('a shorter idle limit moves the deadline with the timers (no drift between clock and timer)', () => {
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(
      ({ idleMs }: { idleMs: number }) => useSessionTimeout({ idleMs, onTimeout }),
      {
        initialProps: { idleMs: 60_000 },
      },
    );
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    rerender({ idleMs: 10_000 });
    act(() => {
      vi.setSystemTime(Date.now() + 10_000); // the new limit elapsed on the clock, timers suspended
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.state).toBe('expired');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('re-enabling re-arms from now rather than from a stale deadline', () => {
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSessionTimeout({ idleMs: 10_000, onTimeout, enabled }),
      {
        initialProps: { enabled: true },
      },
    );
    rerender({ enabled: false });
    act(() => {
      vi.setSystemTime(Date.now() + 60_000);
    });
    rerender({ enabled: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.state).toBe('active');
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.state).toBe('expired');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('a fresh events array on every render does not re-arm the timer', () => {
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(() =>
      useSessionTimeout({ idleMs: 10_000, onTimeout, events: ['keydown', 'pointerdown'] }),
    );
    for (let i = 0; i < 20; i++) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      rerender();
    }
    expect(result.current.state).toBe('expired');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});
