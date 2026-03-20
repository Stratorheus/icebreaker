import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

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
  gridSize: number; // rows=cols (3, 4, or 5)
  openCount: number;
  flashMs: number;
}

function getParams(difficulty: number): Params {
  // d=0: 3x3 grid (9 ports), 2 open, flash 700ms each
  // d=0.5: 4x4 grid (16 ports), 4 open, flash 400ms
  // d=1.0: 5x5 grid (25 ports), 6 open, flash 250ms
  const gridSize = Math.round(3 + difficulty * 2); // 3-5
  const openCount = Math.round(2 + difficulty * 4); // 2-6
  const flashMs = Math.round(700 - difficulty * 450); // 700-250
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
  ports: number[]; // flat array of port numbers, length = gridSize^2
  openIndices: Set<number>; // indices into ports[] that are "open"
}

function generatePuzzle(params: Params): PuzzleData {
  const totalCells = params.gridSize * params.gridSize;
  const shuffled = shuffle(PORT_POOL);
  const ports = shuffled.slice(0, totalCells);

  // Pick random subset as "open"
  const indices = Array.from({ length: totalCells }, (_, i) => i);
  const shuffledIndices = shuffle(indices);
  const openIndices = new Set(shuffledIndices.slice(0, params.openCount));

  return { ports, openIndices };
}

// -- Component ----------------------------------------------------------------

/**
 * PortScan -- reaction memory minigame.
 *
 * Grid of port numbers. "Open" ports flash green one by one. Player must
 * select all that flashed. Timer is PAUSED during display phase, RUNNING
 * during select phase.
 *
 * Difficulty scaling (0-1):
 *   d=0:   3x3 grid, 2 open, 700ms flash
 *   d=0.5: 4x4 grid, 4 open, 400ms flash
 *   d=1.0: 5x5 grid, 6 open, 250ms flash
 */
export function PortScan(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("port-scan", props);

  const resolvedRef = useRef(false);

  // Deep Scan module: flash ports multiple times
  const flashRepeat = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "port-scan",
    );
    return pu ? pu.effect.value : 1;
  }, [activePowerUps]);

  // -- Difficulty params (stable on mount) --
  const params = useMemo(() => getParams(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // -- Puzzle (stable on mount) --
  const puzzle = useMemo(() => generatePuzzle(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // -- Phase --
  const [phase, setPhase] = useState<Phase>("display");
  const phaseRef = useRef<Phase>("display");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // -- Currently flashing port index (during display) --
  const [flashingIndex, setFlashingIndex] = useState<number | null>(null);

  // -- Selected ports (during select phase) --
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const selectedIndicesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    selectedIndicesRef.current = selectedIndices;
  }, [selectedIndices]);

  // -- Correct count for display --
  const [correctCount, setCorrectCount] = useState(0);
  const correctCountRef = useRef(0);
  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  // -- Keyboard cursor --
  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorIndexRef = useRef(0);
  useEffect(() => {
    cursorIndexRef.current = cursorIndex;
  }, [cursorIndex]);

  // -- Pause timer immediately on mount (display phase starts first) --
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
    const gapMs = Math.max(150, ms * 0.4);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const initialDelay = 500;

    // Flash each open port `flashRepeat` times (Deep Scan = 2x)
    let t = initialDelay;
    for (let rep = 0; rep < flashRepeat; rep++) {
      for (let i = 0; i < openArr.length; i++) {
        const onTime = t;
        // Flash on
        timeouts.push(
          setTimeout(() => {
            setFlashingIndex(openArr[i]);
          }, onTime),
        );
        // Flash off
        timeouts.push(
          setTimeout(() => {
            setFlashingIndex(null);
          }, onTime + ms),
        );
        t += ms + gapMs;
      }
      // Gap between repeats
      if (rep < flashRepeat - 1) t += 200;
    }

    // Transition to select phase after all flashes
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
        // Deselect
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        // Adjust correct count if it was a correct selection
        if (puzzle.openIndices.has(index)) {
          setCorrectCount((c) => {
            const next = c - 1;
            correctCountRef.current = next;
            return next;
          });
        }
        return;
      }

      // New selection
      if (!puzzle.openIndices.has(index)) {
        // Wrong selection -- immediate fail
        resolvedRef.current = true;
        // Briefly show the wrong selection
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });
        setTimeout(() => fail(), 400);
        return;
      }

      // Correct selection
      const newCorrectCount = correctCountRef.current + 1;
      setCorrectCount(newCorrectCount);
      correctCountRef.current = newCorrectCount;

      setSelectedIndices((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });

      // Check if all open ports found
      if (newCorrectCount >= puzzle.openIndices.size) {
        resolvedRef.current = true;
        setTimeout(() => complete(true), 400);
      }
    },
    [isActive, puzzle, fail, complete],
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

  // -- Render --
  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-4" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-2xl">
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

        {/* Grid */}
        <div
          className={`grid ${gapSize}`}
          style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
        >
          {puzzle.ports.map((port, idx) => {
            const isFlashing = flashingIndex === idx;
            const isSelected = selectedIndices.has(idx);
            const isCursor = phase === "select" && cursorIndex === idx;
            const isOpen = puzzle.openIndices.has(idx);
            // After resolve, show correct answers
            const showCorrect = resolvedRef.current && isOpen && !isSelected;

            let cellClasses = `
              ${cellSize}
              flex items-center justify-center
              font-mono font-bold
              border rounded-md
              transition-all duration-150
            `;

            let cellStyle: React.CSSProperties = {};

            if (isFlashing) {
              // Display phase: green flash
              cellClasses += " bg-green-400/30 border-green-400 text-green-300";
              cellStyle = { boxShadow: "0 0 16px rgba(0, 255, 65, 0.5), 0 0 32px rgba(0, 255, 65, 0.3)" };
            } else if (isSelected) {
              // Selected: cyan border
              cellClasses += " bg-cyan-950/40 border-cyber-cyan text-cyber-cyan";
              cellStyle = { boxShadow: "0 0 8px rgba(0, 255, 255, 0.3)" };
            } else if (showCorrect) {
              // After resolve, show missed open ports in dim green
              cellClasses += " bg-green-950/30 border-green-700/50 text-green-500/60";
            } else {
              // Default: dark cell
              cellClasses += " bg-white/[0.03] border-white/10 text-white/50";
              if (phase === "select") {
                cellClasses += " hover:bg-white/[0.06] hover:border-white/20 cursor-pointer";
              }
            }

            if (isCursor) {
              cellClasses += " ring-2 ring-cyber-magenta ring-offset-0";
              cellStyle = {
                ...cellStyle,
                boxShadow: `${cellStyle.boxShadow ?? ""}, 0 0 12px rgba(255, 0, 255, 0.4)`.replace(
                  /^, /,
                  "",
                ),
              };
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggle(idx)}
                disabled={phase !== "select" || !isActive || resolvedRef.current}
                className={cellClasses}
                style={cellStyle}
              >
                {port}
              </button>
            );
          })}
        </div>
      </div>

      {/* Control hints — desktop */}
      <div className="desktop-only mt-4 text-center space-y-1">
        <p className="text-white/30 text-xs uppercase tracking-widest">
          Arrow keys to navigate, Space to toggle, or click
        </p>
        <div className="inline-flex flex-col items-center gap-1">
          <kbd className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">
            {"\u2191"}
          </kbd>
          <div className="flex items-center gap-1">
            <kbd className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">
              {"\u2190"}
            </kbd>
            <kbd className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">
              {"\u2193"}
            </kbd>
            <kbd className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">
              {"\u2192"}
            </kbd>
          </div>
          <kbd className="px-4 py-1 bg-cyan-950/50 border border-cyan-800/30 rounded text-[10px] text-cyan-500/70 font-mono">
            SPACE
          </kbd>
        </div>
      </div>

      {/* Touch instruction */}
      <div className="touch-only mt-4 text-center">
        <p className="text-white/30 text-xs uppercase tracking-widest">
          TAP to select open ports
        </p>
      </div>
    </div>
  );
}
