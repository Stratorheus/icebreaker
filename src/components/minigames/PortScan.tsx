import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { ArrowKeyHints } from "@/components/layout/ArrowKeyHints";
import { cellStyles } from "@/components/layout/GameCell";
import { useTouchDevice } from "@/hooks/use-touch-device";

// -- Port pool ----------------------------------------------------------------

const PORT_POOL = [
  20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 119, 123,
  135, 137, 143, 161, 389, 443, 445, 465, 514, 587, 636,
  993, 995, 1080, 1433, 1521, 1723, 2049, 3306, 3389, 4443,
  5432, 5672, 5900, 6379, 6443, 8080, 8443, 8888, 9090, 9200,
  9300, 11211, 15672, 27017, 50000,
];

type Phase = "display" | "select";

// -- Difficulty parameters ----------------------------------------------------

interface Params {
  gridSize: number;
  openCount: number;
  flashMs: number;
}

function getParams(difficulty: number): Params {
  const gridSize = Math.round(3 + difficulty * 2);
  const openCount = Math.round(2 + difficulty * 4);
  const flashMs = Math.round(450 - difficulty * 250);
  return { gridSize, openCount, flashMs };
}

// -- Fisher-Yates shuffle -----------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -- Puzzle generation --------------------------------------------------------

interface PuzzleData {
  ports: number[];
  openIndices: Set<number>;
}

function generatePuzzle(params: Params): PuzzleData {
  const totalCells = params.gridSize * params.gridSize;
  const shuffled = shuffle(PORT_POOL);
  const ports = shuffled.slice(0, totalCells);

  const indices = Array.from({ length: totalCells }, (_, i) => i);
  const shuffledIndices = shuffle(indices);
  const openIndices = new Set(shuffledIndices.slice(0, params.openCount));

  return { ports, openIndices };
}

// -- Component ----------------------------------------------------------------

export function PortScan(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("port-scan", props);

  const resolvedRef = useRef(false);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, []);
  const isTouch = useTouchDevice();

  // Deep Scan module: flash ports multiple times
  const flashRepeat = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "port-scan",
    );
    return pu ? pu.effect.value : 1;
  }, [activePowerUps]);

  // Port Logger: show list of open port numbers during select phase
  const hasPortLogger = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "hint" && p.effect.minigame === "port-scan",
    );
  }, [activePowerUps]);

  const params = useMemo(() => getParams(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const puzzle = useMemo(() => generatePuzzle(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [phase, setPhase] = useState<Phase>("display");
  const phaseRef = useRef<Phase>("display");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [flashingIndex, setFlashingIndex] = useState<number | null>(null);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const selectedIndicesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    selectedIndicesRef.current = selectedIndices;
  }, [selectedIndices]);

  const [correctCount, setCorrectCount] = useState(0);
  const correctCountRef = useRef(0);
  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorIndexRef = useRef(0);
  useEffect(() => {
    cursorIndexRef.current = cursorIndex;
  }, [cursorIndex]);

  // -- Pause timer immediately on mount --
  const pausedOnMountRef = useRef(false);
  useEffect(() => {
    if (!pausedOnMountRef.current) {
      pausedOnMountRef.current = true;
      queueMicrotask(() => {
        timer.pause();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Display phase: flash open ports sequentially --
  useEffect(() => {
    if (phase !== "display") return;

    timer.pause();

    const openArr = Array.from(puzzle.openIndices);
    const ms = params.flashMs;
    const gapMs = Math.max(100, ms * 0.35);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const initialDelay = 350;

    let t = initialDelay;
    for (let rep = 0; rep < flashRepeat; rep++) {
      for (let i = 0; i < openArr.length; i++) {
        const onTime = t;
        timeouts.push(
          setTimeout(() => {
            setFlashingIndex(openArr[i]);
          }, onTime),
        );
        timeouts.push(
          setTimeout(() => {
            setFlashingIndex(null);
          }, onTime + ms),
        );
        t += ms + gapMs;
      }
      if (rep < flashRepeat - 1) t += 200;
    }

    const totalDisplayTime = t + 200;
    timeouts.push(
      setTimeout(() => {
        if (resolvedRef.current) return;
        setPhase("select");
        phaseRef.current = "select";
        timer.start();
      }, totalDisplayTime),
    );

    return () => {
      for (const t of timeouts) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // -- Handle cell toggle (select phase) --
  const handleToggle = useCallback(
    (index: number) => {
      if (!isActive || resolvedRef.current) return;
      if (phaseRef.current !== "select") return;

      const alreadySelected = selectedIndicesRef.current.has(index);
      if (alreadySelected) {
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        if (puzzle.openIndices.has(index)) {
          setCorrectCount((c) => {
            const next = c - 1;
            correctCountRef.current = next;
            return next;
          });
        }
        return;
      }

      if (!puzzle.openIndices.has(index)) {
        resolvedRef.current = true;
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });
        delayRef.current = setTimeout(() => fail(), 400);
        return;
      }

      const newCorrectCount = correctCountRef.current + 1;
      setCorrectCount(newCorrectCount);
      correctCountRef.current = newCorrectCount;

      setSelectedIndices((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });

      if (newCorrectCount >= puzzle.openIndices.size) {
        resolvedRef.current = true;
        timer.pause(); // prevent handleExpire from firing during the flash delay
        delayRef.current = setTimeout(() => complete(true), 400);
      }
    },
    [isActive, puzzle, fail, complete, timer],
  );

  // -- Keyboard navigation --
  const totalCells = params.gridSize * params.gridSize;

  const handleUp = useCallback(() => {
    if (phaseRef.current !== "select") return;
    setCursorIndex((prev) => {
      const next = prev - params.gridSize;
      const val = next >= 0 ? next : prev;
      cursorIndexRef.current = val;
      return val;
    });
  }, [params.gridSize]);

  const handleDown = useCallback(() => {
    if (phaseRef.current !== "select") return;
    setCursorIndex((prev) => {
      const next = prev + params.gridSize;
      const val = next < totalCells ? next : prev;
      cursorIndexRef.current = val;
      return val;
    });
  }, [params.gridSize, totalCells]);

  const handleLeft = useCallback(() => {
    if (phaseRef.current !== "select") return;
    setCursorIndex((prev) => {
      const col = prev % params.gridSize;
      const val = col > 0 ? prev - 1 : prev;
      cursorIndexRef.current = val;
      return val;
    });
  }, [params.gridSize]);

  const handleRight = useCallback(() => {
    if (phaseRef.current !== "select") return;
    setCursorIndex((prev) => {
      const col = prev % params.gridSize;
      const val = col < params.gridSize - 1 ? prev + 1 : prev;
      cursorIndexRef.current = val;
      return val;
    });
  }, [params.gridSize]);

  const handleSpace = useCallback(() => {
    handleToggle(cursorIndexRef.current);
  }, [handleToggle]);

  const keyMap = useMemo(
    () => ({
      ArrowUp: handleUp,
      ArrowDown: handleDown,
      ArrowLeft: handleLeft,
      ArrowRight: handleRight,
      " ": handleSpace,
    }),
    [handleUp, handleDown, handleLeft, handleRight, handleSpace],
  );

  useKeyboard(keyMap);

  // -- Dynamic cell sizing --
  const cellSize =
    params.gridSize <= 3
      ? "w-20 h-20 sm:w-24 sm:h-24 text-sm sm:text-base"
      : params.gridSize <= 4
        ? "w-16 h-16 sm:w-20 sm:h-20 text-xs sm:text-sm"
        : "w-12 h-12 sm:w-16 sm:h-16 text-[10px] sm:text-xs";

  const gapSize =
    params.gridSize <= 3 ? "gap-2 sm:gap-3" : params.gridSize <= 4 ? "gap-1.5 sm:gap-2" : "gap-1 sm:gap-1.5";

  return (
    <MinigameShell
      timer={timer}
      timerGap="mb-4"
      gap="gap-4"
      maxWidth="max-w-2xl"
      outerProps={{ "data-testid": "port-phase", "data-phase": phase }}
      desktopHint={
        <div className="space-y-1">
          <p className="text-white/30 text-xs uppercase tracking-widest">
            Arrow keys to navigate, Space to toggle, or click
          </p>
          <ArrowKeyHints />
          <kbd className="desktop-only px-4 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono mt-1">
            Space
          </kbd>
        </div>
      }
      touchHint={
        <p className="text-white/30 text-xs uppercase tracking-widest">
          TAP to select open ports
        </p>
      }
    >
      {/* Header */}
      <p className="text-cyber-cyan text-xs uppercase tracking-widest font-mono glitch-subtle">
        Scanning Network Ports...
      </p>

      {/* Counter */}
      <p className="text-white/50 text-sm font-mono tracking-wider">
        {phase === "display" ? (
          <span className="text-cyber-orange animate-pulse">DETECTING OPEN PORTS...</span>
        ) : (
          <span>
            {correctCount}/{puzzle.openIndices.size} IDENTIFIED
          </span>
        )}
      </p>

      {/* Phase indicator */}
      <div className="flex flex-col items-center gap-1">
        <div className="h-5 flex items-center justify-center">
          {phase === "display" && (
            <p className="text-cyber-orange text-xs uppercase tracking-widest animate-pulse font-mono">
              Memorize the open ports...
            </p>
          )}
          {phase === "select" && (
            <p className="text-cyber-green text-xs uppercase tracking-widest animate-pulse font-mono">
              Select all open ports
            </p>
          )}
        </div>
        {/* Port Logger */}
        {hasPortLogger && phase === "select" && (
          <p className="text-cyber-orange/60 text-[10px] font-mono tracking-wider">
            Open: {Array.from(puzzle.openIndices).map((idx) => puzzle.ports[idx]).join(", ")}
          </p>
        )}
      </div>

      {/* Grid */}
      <div
        className={`grid ${gapSize}`}
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
      >
        {puzzle.ports.map((port, idx) => {
          const isFlashing = flashingIndex === idx;
          const isSelected = selectedIndices.has(idx);
          const isCursor = !isTouch && phase === "select" && cursorIndex === idx;
          const isOpen = puzzle.openIndices.has(idx);
          const showCorrect = resolvedRef.current && isOpen && !isSelected;

          let cellClasses: string;
          let cellStyle: React.CSSProperties = {};

          if (isFlashing) {
            cellClasses = `${cellSize} flex items-center justify-center font-mono font-bold rounded-md border border-green-400 bg-green-400/30 text-green-300 transition-all duration-150 focus:outline-none select-none`;
            cellStyle = { boxShadow: "0 0 16px rgba(0, 255, 65, 0.5), 0 0 32px rgba(0, 255, 65, 0.3)" };
          } else if (isSelected) {
            cellClasses = `${cellSize} flex items-center justify-center font-mono font-bold rounded-md border border-cyber-cyan bg-cyan-950/40 text-cyber-cyan transition-all duration-150 focus:outline-none select-none`;
            cellStyle = { boxShadow: "0 0 8px rgba(0, 255, 255, 0.3)" };
          } else if (showCorrect) {
            cellClasses = `${cellSize} flex items-center justify-center font-mono font-bold rounded-md border border-green-700/50 bg-green-950/30 text-green-500/60 transition-all duration-150 focus:outline-none select-none`;
          } else if (phase === "select") {
            cellClasses = `${cellSize} font-mono font-bold text-white/50 ${cellStyles({ isCursor, isTouch })}`;
          } else {
            cellClasses = `${cellSize} flex items-center justify-center font-mono font-bold rounded-md border border-white/10 bg-white/5 text-white/50 transition-all duration-150 focus:outline-none select-none`;
          }

          return (
            <button
              key={idx}
              data-testid="port-cell"
              data-open={isOpen}
              type="button"
              onClick={() => handleToggle(idx)}
              onMouseEnter={() => {
                if (!isTouch) {
                  setCursorIndex(idx);
                  cursorIndexRef.current = idx;
                }
              }}
              disabled={phase !== "select" || !isActive || resolvedRef.current}
              className={cellClasses}
              style={cellStyle}
            >
              {port}
            </button>
          );
        })}
      </div>
    </MinigameShell>
  );
}
