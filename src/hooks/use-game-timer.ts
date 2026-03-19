import { useCallback, useEffect, useRef, useState } from "react";

export interface GameTimerState {
  timeLeft: number;
  progress: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  addTime: (ms: number) => void;
}

export function useGameTimer(
  totalMs: number,
  onExpire: () => void,
): GameTimerState {
  // timeLeft drives re-renders; everything else lives in refs
  const [timeLeft, setTimeLeft] = useState(totalMs);

  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  // Timestamp of when the current run segment started
  const segmentStartRef = useRef<number | null>(null);
  // How many ms were remaining when the current segment started
  const segmentStartTimeLeftRef = useRef(totalMs);

  const rafRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);

  // Keep the callback fresh without restarting the loop
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (!isRunningRef.current || segmentStartRef.current === null) return;

    const elapsed = performance.now() - segmentStartRef.current;
    const remaining = Math.max(0, segmentStartTimeLeftRef.current - elapsed);

    setTimeLeft(remaining);

    if (remaining <= 0) {
      isRunningRef.current = false;
      setIsRunning(false);
      segmentStartRef.current = null;

      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    setIsRunning(true);

    // Snapshot: segment begins now with whatever time is left
    segmentStartRef.current = performance.now();
    // segmentStartTimeLeftRef already holds the correct value (set by pause/addTime)

    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (!isRunningRef.current || segmentStartRef.current === null) return;

    // Freeze remaining time so we can resume from here
    const elapsed = performance.now() - segmentStartRef.current;
    const remaining = Math.max(0, segmentStartTimeLeftRef.current - elapsed);
    segmentStartTimeLeftRef.current = remaining;
    segmentStartRef.current = null;

    isRunningRef.current = false;
    setIsRunning(false);
    setTimeLeft(remaining);

    cancelRaf();
  }, [cancelRaf]);

  const addTime = useCallback(
    (ms: number) => {
      if (segmentStartRef.current !== null) {
        // Running — compute current remaining then add
        const elapsed = performance.now() - segmentStartRef.current;
        const remaining = Math.max(0, segmentStartTimeLeftRef.current - elapsed);
        segmentStartTimeLeftRef.current = remaining + ms;
        segmentStartRef.current = performance.now();
        setTimeLeft(remaining + ms);
      } else {
        // Paused — just add to the snapshot
        segmentStartTimeLeftRef.current += ms;
        setTimeLeft((prev) => prev + ms);
      }
    },
    [],
  );

  // Cleanup on unmount — reset all refs so StrictMode double-mount works
  useEffect(() => {
    return () => {
      cancelRaf();
      isRunningRef.current = false;
      segmentStartRef.current = null;
      expiredRef.current = false;
    };
  }, [cancelRaf]);

  const progress = totalMs > 0 ? timeLeft / totalMs : 0;

  return { timeLeft, progress, isRunning, start, pause, addTime };
}
