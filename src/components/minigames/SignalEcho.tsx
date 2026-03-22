import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

// ── Panel definitions ─────────────────────────────────────────────────

type Direction = "up" | "right" | "down" | "left";

interface Panel {
  dir: Direction;
  key: string;
  label: string;
  color: string;       // bright/active tailwind classes
  dimColor: string;     // dim/inactive tailwind classes
  glowColor: string;    // CSS glow shadow color
}

const PANELS: Panel[] = [
  {
    dir: "up",
    key: "ArrowUp",
    label: "\u2191",
    color: "bg-cyan-950/60 border-cyan-400 text-cyan-300",
    dimColor: "bg-cyan-950/40 border-cyan-800/50 text-cyan-600/50",
    glowColor: "rgba(0, 255, 255, 0.4)",
  },
  {
    dir: "right",
    key: "ArrowRight",
    label: "\u2192",
    color: "bg-fuchsia-950/60 border-fuchsia-400 text-fuchsia-300",
    dimColor: "bg-fuchsia-950/40 border-fuchsia-800/50 text-fuchsia-600/50",
    glowColor: "rgba(255, 0, 255, 0.4)",
  },
  {
    dir: "down",
    key: "ArrowDown",
    label: "\u2193",
    color: "bg-green-950/60 border-green-400 text-green-300",
    dimColor: "bg-green-950/40 border-green-800/50 text-green-600/50",
    glowColor: "rgba(0, 255, 65, 0.4)",
  },
  {
    dir: "left",
    key: "ArrowLeft",
    label: "\u2190",
    color: "bg-orange-950/60 border-orange-400 text-orange-300",
    dimColor: "bg-orange-950/40 border-orange-800/50 text-orange-600/50",
    glowColor: "rgba(255, 136, 0, 0.4)",
  },
];

const DIR_INDEX: Record<Direction, number> = { up: 0, right: 1, down: 2, left: 3 };

type Phase = "display" | "input" | "success" | "fail";

// ── Component ─────────────────────────────────────────────────────────

/**
 * SignalEcho -- Simon Says-style minigame.
 *
 * 4 colored panels in a cross/diamond layout. A sequence lights up one
 * by one, then the player repeats it. Each successful round adds one
 * element to the sequence. Wrong input = immediate fail.
 *
 * Timer is PAUSED during the display phase and RUNNING during input.
 *
 * Difficulty scaling (0-1):
 *   startLength = Math.round(3 + difficulty * 2)
 *   displayMs   = Math.round(800 - difficulty * 500)
 *   totalRounds = Math.round(3 + difficulty * 2)
 */
export function SignalEcho(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("signal-echo", props);

  const resolvedRef = useRef(false);

  // Slow Replay module: 30% slower display
  const hasSlowReplay = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "signal-echo",
    );
  }, [activePowerUps]);

  // ── Difficulty parameters (stable on mount) ────────────────────────
  const params = useMemo(() => {
    // Start from 1 signal always. Trivial: 1→3 (3 rounds). Insane: 1→8+ (8 rounds).
    const startLength = 1;
    let displayMs = Math.round(600 - difficulty * 350); // 600ms→250ms per signal
    if (hasSlowReplay) {
      displayMs = Math.round(displayMs * 1.3);
    }
    const totalRounds = Math.round(3 + difficulty * 5); // 3→8 rounds
    return { startLength, displayMs, totalRounds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sequence state ──────────────────────────────────────────────────
  // The full sequence grows each round. Initial length = startLength.
  // After each successful round, one random element is appended.
  const [sequence, setSequence] = useState<Direction[]>(() => {
    const dirs: Direction[] = ["up", "right", "down", "left"];
    const seq: Direction[] = [];
    for (let i = 0; i < params.startLength; i++) {
      seq.push(dirs[Math.floor(Math.random() * dirs.length)]);
    }
    return seq;
  });
  const sequenceRef = useRef(sequence);
  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);

  // Current round (0-indexed)
  const [currentRound, setCurrentRound] = useState(0);
  const currentRoundRef = useRef(0);
  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  // Phase: display or input
  const [phase, setPhase] = useState<Phase>("display");
  const phaseRef = useRef<Phase>("display");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Which panel is currently lit (during display or input flash)
  const [litPanel, setLitPanel] = useState<Direction | null>(null);

  // Player input index within current round
  const [inputIndex, setInputIndex] = useState(0);
  const inputIndexRef = useRef(0);
  useEffect(() => {
    inputIndexRef.current = inputIndex;
  }, [inputIndex]);

  // ── Pause timer immediately on mount (display phase starts first) ──
  // useMinigame auto-starts the timer. We pause it right away because
  // the first phase is always display.
  const pausedOnMountRef = useRef(false);
  useEffect(() => {
    if (!pausedOnMountRef.current) {
      pausedOnMountRef.current = true;
      // Use queueMicrotask to ensure pause runs after the timer.start()
      // in useMinigame's mount effect
      queueMicrotask(() => {
        timer.pause();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Display phase: play sequence ────────────────────────────────────
  // Runs whenever phase becomes "display". Lights panels one by one,
  // then transitions to input phase.
  useEffect(() => {
    if (phase !== "display") return;

    timer.pause();

    const seq = sequenceRef.current;
    const ms = params.displayMs;
    const gapMs = Math.max(150, ms * 0.4); // gap between lights
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Small initial delay before the sequence starts
    const initialDelay = 400;

    for (let i = 0; i < seq.length; i++) {
      // Light on
      const onTime = initialDelay + i * (ms + gapMs);
      timeouts.push(
        setTimeout(() => {
          setLitPanel(seq[i]);
        }, onTime),
      );
      // Light off
      timeouts.push(
        setTimeout(() => {
          setLitPanel(null);
        }, onTime + ms),
      );
    }

    // After entire sequence plays, transition to input
    const totalDisplayTime = initialDelay + seq.length * (ms + gapMs);
    timeouts.push(
      setTimeout(() => {
        if (resolvedRef.current) return;
        setPhase("input");
        setInputIndex(0);
        inputIndexRef.current = 0;
        timer.start();
      }, totalDisplayTime),
    );

    return () => {
      for (const t of timeouts) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentRound]);

  // ── Input flash (brief light on press) ──────────────────────────────
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashPanel = useCallback((dir: Direction) => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setLitPanel(dir);
    flashTimeoutRef.current = setTimeout(() => {
      setLitPanel(null);
      flashTimeoutRef.current = null;
    }, 150);
  }, []);

  // Cleanup flash timeout on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  // ── Handle panel press (keyboard or click) ──────────────────────────
  const handlePress = useCallback(
    (dir: Direction) => {
      if (!isActive || resolvedRef.current) return;
      if (phaseRef.current !== "input") return;

      const seq = sequenceRef.current;
      const idx = inputIndexRef.current;
      const expected = seq[idx];

      flashPanel(dir);

      if (dir !== expected) {
        // Wrong input -- immediate fail
        resolvedRef.current = true;
        setPhase("fail");
        fail();
        return;
      }

      // Correct input
      const nextIdx = idx + 1;
      setInputIndex(nextIdx);
      inputIndexRef.current = nextIdx;

      if (nextIdx >= seq.length) {
        // Completed this round's sequence
        const nextRound = currentRoundRef.current + 1;

        if (nextRound >= params.totalRounds) {
          // All rounds complete -- win!
          resolvedRef.current = true;
          setPhase("success");
          complete(true);
        } else {
          // Add one random element and start next round
          const dirs: Direction[] = ["up", "right", "down", "left"];
          const newDir = dirs[Math.floor(Math.random() * dirs.length)];
          setSequence((prev) => [...prev, newDir]);
          setCurrentRound(nextRound);
          currentRoundRef.current = nextRound;
          setInputIndex(0);
          inputIndexRef.current = 0;
          // Transition to display phase (timer paused in display effect)
          setPhase("display");
        }
      }
    },
    [isActive, fail, complete, params.totalRounds, flashPanel],
  );

  // ── Keyboard bindings ───────────────────────────────────────────────
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const panel of PANELS) {
      const dir = panel.dir;
      map[panel.key] = () => handlePress(dir);
    }
    return map;
  }, [handlePress]);

  useKeyboard(keyMap);

  // ── Render ──────────────────────────────────────────────────────────

  const renderPanel = (panel: Panel) => {
    const isLit = litPanel === panel.dir;
    const isInputPhase = phase === "input";

    return (
      <button
        key={panel.dir}
        data-testid="echo-panel"
        type="button"
        onClick={() => handlePress(panel.dir)}
        disabled={!isActive || phase !== "input"}
        className={`
          flex items-center justify-center
          w-20 h-20 sm:w-24 sm:h-24
          rounded-xl border-2 font-mono font-bold
          text-3xl sm:text-4xl
          transition-all duration-150
          select-none
          ${isLit ? panel.color : panel.dimColor}
          ${isInputPhase && !isLit ? "hover:brightness-125 cursor-pointer" : ""}
          ${!isInputPhase ? "cursor-default" : ""}
        `}
        style={
          isLit
            ? { boxShadow: `0 0 12px ${panel.glowColor}` }
            : undefined
        }
      >
        {panel.label}
      </button>
    );
  };

  // Panel layout: cross/diamond (up=top, left=left, right=right, down=bottom)
  const upPanel = PANELS[DIR_INDEX.up];
  const rightPanel = PANELS[DIR_INDEX.right];
  const downPanel = PANELS[DIR_INDEX.down];
  const leftPanel = PANELS[DIR_INDEX.left];

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-4" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-2xl">
        {/* Header */}
        <p className="text-cyber-cyan text-xs uppercase tracking-widest font-mono glitch-subtle">
          Intercepting Signal...
        </p>

        {/* Round progress */}
        <p className="text-white/50 text-sm font-mono tracking-wider">
          ROUND {currentRound + 1}/{params.totalRounds}
          <span className="text-white/30 ml-3">
            SEQ {sequence.length}
          </span>
        </p>

        {/* Phase indicator */}
        <div className="h-6 flex items-center justify-center">
          {phase === "display" && (
            <p className="text-cyber-orange text-xs uppercase tracking-widest animate-pulse font-mono">
              Watch the sequence...
            </p>
          )}
          {phase === "input" && (
            <p className="text-cyber-green text-xs uppercase tracking-widest animate-pulse font-mono">
              Your turn! Repeat the sequence
            </p>
          )}
        </div>

        {/* Input progress dots */}
        {phase === "input" && (
          <div className="flex items-center justify-center gap-1.5">
            {sequence.map((dir, i) => {
              const panel = PANELS[DIR_INDEX[dir]];
              const isDone = i < inputIndex;
              const isCurrent = i === inputIndex;
              return (
                <div
                  key={i}
                  className={`
                    w-3 h-3 rounded-full transition-all duration-150
                    ${isDone ? "bg-cyber-green" : isCurrent ? "bg-white/60 animate-pulse" : "bg-white/15"}
                  `}
                  style={isDone ? { boxShadow: `0 0 6px ${panel.glowColor}` } : undefined}
                />
              );
            })}
          </div>
        )}

        {/* Keyboard-style panel layout */}
        <div className="flex flex-col items-center gap-2 sm:gap-3 mt-2">
          {/* Top row: Up (centered) */}
          <div className="flex justify-center">
            {renderPanel(upPanel)}
          </div>
          {/* Bottom row: Left + Down + Right (like arrow keys) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {renderPanel(leftPanel)}
            {renderPanel(downPanel)}
            {renderPanel(rightPanel)}
          </div>
        </div>
      </div>

      {/* Hidden test helper: echo sequence */}
      <span data-testid="echo-sequence" data-sequence={JSON.stringify(sequence)} className="hidden" />

      {/* Arrow key hints — desktop */}
      <div className="desktop-only mt-4 text-center">
        <p className="text-white/30 text-xs uppercase tracking-widest mb-2">
          Arrow keys or click panels
        </p>
        <div className="inline-flex flex-col items-center gap-1">
          <kbd className="px-3 py-1.5 bg-cyan-950/50 border border-cyan-800/30 rounded text-sm text-cyan-500/70 font-bold font-mono">
            {"\u2191"}
          </kbd>
          <div className="flex items-center gap-1">
            <kbd className="px-3 py-1.5 bg-orange-950/50 border border-orange-800/30 rounded text-sm text-orange-500/70 font-bold font-mono">
              {"\u2190"}
            </kbd>
            <kbd className="px-3 py-1.5 bg-green-950/50 border border-green-800/30 rounded text-sm text-green-500/70 font-bold font-mono">
              {"\u2193"}
            </kbd>
            <kbd className="px-3 py-1.5 bg-fuchsia-950/50 border border-fuchsia-800/30 rounded text-sm text-fuchsia-500/70 font-bold font-mono">
              {"\u2192"}
            </kbd>
          </div>
        </div>
      </div>

      {/* Touch instruction */}
      <div className="touch-only mt-4 text-center">
        <p className="text-white/30 text-xs uppercase tracking-widest">
          TAP the panels to repeat the sequence
        </p>
      </div>
    </div>
  );
}
