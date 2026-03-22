import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyPress } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

type Phase = "guard" | "prepare" | "attack";

/**
 * SlashTiming — 3-phase reflex minigame.
 *
 * Cycle: GUARD → PREPARE → ATTACK
 * - Player must press Space ONLY during the ATTACK window.
 * - Pressing during GUARD or PREPARE = immediate fail.
 * - Not pressing during ATTACK = cycle repeats (back to GUARD).
 * - Overall timer expiring = fail.
 */
export function SlashTiming(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "slash-timing",
    props,
  );

  // 2f/3a. Window-extend: widen attack window from both run shop and meta upgrades
  const windowExtendBonus = useMemo(() => {
    let bonus = 0;
    for (const pu of activePowerUps) {
      if (pu.effect.type === "window-extend" && (!pu.effect.minigame || pu.effect.minigame === "slash-timing")) {
        bonus += pu.effect.value;
      }
    }
    return bonus;
  }, [activePowerUps]);

  // --- Difficulty-scaled durations (ms) ---
  const baseAttackWindow = 800 - difficulty * 500; // 800ms (d=0) → 300ms (d=1)
  // Apply window-extend bonus (value is a fraction, e.g. 0.2 = 20% wider)
  const attackWindow = baseAttackWindow * (1 + windowExtendBonus);
  const prepareDuration = 500 - difficulty * 300; // 500ms (d=0) → 200ms (d=1)
  const guardMinDuration = 1000 - difficulty * 400; // 1000ms (d=0) → 600ms (d=1)
  const guardMaxDuration = 2000 - difficulty * 800; // 2000ms (d=0) → 1200ms (d=1)

  const [phase, setPhase] = useState<Phase>("guard");
  const phaseRef = useRef<Phase>("guard");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether we already resolved (success/fail) to avoid double calls
  const resolvedRef = useRef(false);

  const clearPhaseTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // Random guard duration within scaled range
  const getGuardDuration = useCallback(() => {
    return guardMinDuration + Math.random() * (guardMaxDuration - guardMinDuration);
  }, [guardMinDuration, guardMaxDuration]);

  // Start a guard phase (entry point for cycling)
  const startGuard = useCallback(() => {
    if (resolvedRef.current) return;
    setPhaseSync("guard");
    clearPhaseTimeout();

    timeoutRef.current = setTimeout(() => {
      if (resolvedRef.current) return;
      // Transition to PREPARE
      setPhaseSync("prepare");

      timeoutRef.current = setTimeout(() => {
        if (resolvedRef.current) return;
        // Transition to ATTACK
        setPhaseSync("attack");

        timeoutRef.current = setTimeout(() => {
          if (resolvedRef.current) return;
          // Attack window expired without input — cycle back to guard
          startGuard();
        }, attackWindow);
      }, prepareDuration);
    }, getGuardDuration());
  }, [
    attackWindow,
    prepareDuration,
    getGuardDuration,
    clearPhaseTimeout,
    setPhaseSync,
  ]);

  // Start the phase cycle on mount
  useEffect(() => {
    startGuard();
    return () => {
      clearPhaseTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Space key press
  const handleSpace = useCallback(() => {
    if (!isActive || resolvedRef.current) return;

    const currentPhase = phaseRef.current;

    if (currentPhase === "attack") {
      // Success — pressed during the attack window
      resolvedRef.current = true;
      clearPhaseTimeout();
      complete(true);
    } else {
      // Fail — pressed during guard or prepare
      resolvedRef.current = true;
      clearPhaseTimeout();
      fail();
    }
  }, [isActive, complete, fail, clearPhaseTimeout]);

  useKeyPress(" ", handleSpace);

  // --- Visual configuration per phase ---
  const phaseConfig = {
    guard: {
      label: "GUARD",
      icon: shieldIcon,
      borderColor: "border-cyber-cyan",
      textColor: "text-cyber-cyan",
      bgGlow: "shadow-[0_0_40px_rgba(0,255,255,0.15)]",
      ringColor: "ring-cyber-cyan/30",
      description: "HOLD...",
      animate: "",
    },
    prepare: {
      label: "PREPARE",
      icon: warningIcon,
      borderColor: "border-cyber-orange",
      textColor: "text-cyber-orange",
      bgGlow: "shadow-[0_0_40px_rgba(255,102,0,0.2)]",
      ringColor: "ring-cyber-orange/40",
      description: "GET READY...",
      animate: "animate-pulse",
    },
    attack: {
      label: "STRIKE!",
      icon: swordIcon,
      borderColor: "border-cyber-green",
      textColor: "text-cyber-green",
      bgGlow: "shadow-[0_0_60px_rgba(0,255,65,0.3)]",
      ringColor: "ring-cyber-green/50",
      description: "NOW!",
      animate: "animate-pulse",
    },
  } as const;

  const config = phaseConfig[phase];

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-8" />

      {/* Central indicator — tap anywhere to strike on mobile */}
      <div
        className="flex-1 flex items-center justify-center w-full cursor-pointer touch-manipulation"
        onClick={handleSpace}
      >
        <div
          data-testid="slash-phase"
          data-phase={phase}
          className={`
            relative flex flex-col items-center justify-center
            w-56 h-56 sm:w-72 sm:h-72
            rounded-2xl border-2 ring-4
            ${config.borderColor} ${config.ringColor} ${config.bgGlow}
            bg-cyber-bg/80 backdrop-blur-sm
            transition-all duration-150
            ${config.animate}
          `}
        >
          {/* Phase icon */}
          <div
            className={`text-5xl sm:text-6xl mb-3 ${config.textColor} transition-colors duration-150`}
            dangerouslySetInnerHTML={{ __html: config.icon }}
          />

          {/* Phase label */}
          <h2
            className={`text-2xl sm:text-3xl font-bold uppercase tracking-widest ${config.textColor} transition-colors duration-150`}
          >
            {config.label}
          </h2>

          {/* Phase description */}
          <p
            className={`mt-2 text-sm uppercase tracking-widest ${config.textColor}/60 transition-colors duration-150`}
          >
            {config.description}
          </p>
        </div>
      </div>

      {/* Instruction */}
      <div className="mt-8 text-center">
        <p className="desktop-only text-white/40 text-xs uppercase tracking-widest mb-2">
          Press Space to strike during the{" "}
          <span className="text-cyber-green">green</span> phase
        </p>
        <p className="touch-only text-white/40 text-xs uppercase tracking-widest mb-2">
          Tap to strike during the{" "}
          <span className="text-cyber-green">green</span> phase
        </p>
        <div className="desktop-only inline-flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg bg-white/5">
          <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold tracking-wider">
            SPACE
          </kbd>
        </div>
        <div className="touch-only inline-flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg bg-white/5">
          <span className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold tracking-wider">
            TAP TO STRIKE
          </span>
        </div>
      </div>
    </div>
  );
}

// --- SVG icons as inline strings ---

const shieldIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

const warningIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

const swordIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>`;
