import { useCallback, useEffect, useRef, useState } from "react";
import type { MinigameType } from "@/types/game";
import type { MinigameProps, MinigameResult } from "@/types/minigame";
import { useGameTimer, type GameTimerState } from "./use-game-timer";

export interface MinigameState {
  timer: GameTimerState;
  complete: (success: boolean) => void;
  fail: () => void;
  isActive: boolean;
  startTime: number;
}

/**
 * Standard lifecycle hook used by every minigame component.
 *
 * @param minigameType - The minigame's own type identifier (included in result)
 * @param props        - Standard MinigameProps passed from the game engine
 */
export function useMinigame(
  minigameType: MinigameType,
  props: MinigameProps,
): MinigameState {
  const { timeLimit, activePowerUps, onComplete } = props;

  // Convert timeLimit (seconds) → ms
  const timeLimitMs = timeLimit * 1000;

  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const [isActive, setIsActive] = useState(true);

  // Keep onComplete fresh without restarting effects
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleExpire = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsActive(false);

    const result: MinigameResult = {
      success: false,
      timeMs: Date.now() - startTimeRef.current,
      minigame: minigameType,
    };
    onCompleteRef.current(result);
  }, [minigameType]);

  const timer = useGameTimer(timeLimitMs, handleExpire);

  // Stable ref so the mount effect can call addTime without being
  // listed as a dependency (we only want this to run once).
  const addTimeRef = useRef(timer.addTime);
  useEffect(() => {
    addTimeRef.current = timer.addTime;
  }, [timer.addTime]);

  // Apply time-bonus power-ups and auto-start — runs once on mount
  useEffect(() => {
    const bonusMs = activePowerUps
      .filter((p) => p.effect.type === "time-bonus")
      .reduce((sum, p) => sum + p.effect.value, 0);

    if (bonusMs > 0) {
      addTimeRef.current(bonusMs);
    }

    timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const complete = useCallback(
    (success: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setIsActive(false);
      timer.pause();

      const result: MinigameResult = {
        success,
        timeMs: Date.now() - startTimeRef.current,
        minigame: minigameType,
      };
      onCompleteRef.current(result);
    },
    [timer, minigameType],
  );

  const fail = useCallback(() => {
    complete(false);
  }, [complete]);

  return {
    timer,
    complete,
    fail,
    isActive,
    startTime: startTimeRef.current,
  };
}
