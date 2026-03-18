import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

type Phase = "preview" | "mark";

interface MineCell {
  id: number;
  isMine: boolean;
}

interface GeneratedGrid {
  cells: MineCell[];
  cols: number;
  rows: number;
  mineCount: number;
  /** Preview duration in ms */
  previewMs: number;
}

/**
 * Generate a grid with randomly placed mines.
 *
 * Difficulty scaling (0–1):
 * - Grid size: 3×3 (d=0) → 5×5 (d=1)
 * - Mine count: 2 (d=0) → 8 (d=1), capped at ~40% of cells
 * - Preview duration: 3s (d=0) → 1s (d=1)
 */
function generateGrid(difficulty: number): GeneratedGrid {
  const size = Math.round(3 + difficulty * 2);
  const cols = size;
  const rows = size;
  const totalCells = rows * cols;

  // Cap mines at 40% of total cells
  const rawMines = Math.round(2 + difficulty * 6);
  const mineCount = Math.min(rawMines, Math.floor(totalCells * 0.4));

  const previewMs = (3 - difficulty * 2) * 1000;

  // Pick unique mine positions
  const minePositions = new Set<number>();
  while (minePositions.size < mineCount) {
    minePositions.add(Math.floor(Math.random() * totalCells));
  }

  const cells: MineCell[] = Array.from({ length: totalCells }, (_, i) => ({
    id: i,
    isMine: minePositions.has(i),
  }));

  return { cells, cols, rows, mineCount, previewMs };
}

/**
 * MineSweep — memory-based mine marking minigame.
 *
 * Phase 1 (preview): Grid shown with mines highlighted. Sub-timer counts down.
 * Phase 2 (mark): Mines hidden. Player marks cells where they remember mines were.
 * Auto-checks when the player has marked exactly as many cells as there are mines.
 *
 * Supports both mouse click and arrow-key + Enter/Space navigation.
 */
export function MineSweep(props: MinigameProps) {
  const { difficulty } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "mine-sweep",
    props,
  );

  const resolvedRef = useRef(false);

  // Generate grid on mount (stable across re-renders)
  const grid = useMemo(
    () => generateGrid(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { cells, cols, rows, mineCount, previewMs } = grid;

  // ── Phase management ──────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("preview");
  const phaseRef = useRef<Phase>("preview");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Preview sub-timer (counts down from previewMs to 0)
  const [previewLeft, setPreviewLeft] = useState(previewMs);
  const previewStartRef = useRef<number | null>(null);
  const previewRafRef = useRef<number>(0);

  useEffect(() => {
    if (phase !== "preview") return;

    previewStartRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - (previewStartRef.current ?? now);
      const remaining = Math.max(0, previewMs - elapsed);
      setPreviewLeft(remaining);

      if (remaining <= 0) {
        setPhase("mark");
        return;
      }

      previewRafRef.current = requestAnimationFrame(tick);
    };

    previewRafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(previewRafRef.current);
    };
  }, [phase, previewMs]);

  // ── Cursor for keyboard navigation ────────────────────────────────
  const [cursorRow, setCursorRow] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const cursorRowRef = useRef(0);
  const cursorColRef = useRef(0);

  useEffect(() => {
    cursorRowRef.current = cursorRow;
  }, [cursorRow]);
  useEffect(() => {
    cursorColRef.current = cursorCol;
  }, [cursorCol]);

  // ── Marked cells ──────────────────────────────────────────────────
  const [markedCells, setMarkedCells] = useState<Set<number>>(new Set());
  const markedCellsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    markedCellsRef.current = markedCells;
  }, [markedCells]);

  /** Toggle a cell's mark and auto-check when mark count == mine count */
  const toggleMark = useCallback(
    (cellIndex: number) => {
      if (!isActive || resolvedRef.current) return;
      if (phaseRef.current !== "mark") return;

      setMarkedCells((prev) => {
        const next = new Set(prev);
        if (next.has(cellIndex)) {
          next.delete(cellIndex);
        } else {
          // Don't allow marking more than mineCount
          if (next.size >= mineCount) return prev;
          next.add(cellIndex);
        }
        return next;
      });
    },
    [isActive, mineCount],
  );

  // Auto-check when marked count equals mine count
  useEffect(() => {
    if (phase !== "mark" || resolvedRef.current) return;
    if (markedCells.size !== mineCount) return;

    // Check correctness
    const allCorrect = [...markedCells].every(
      (idx) => cells[idx].isMine,
    );

    resolvedRef.current = true;
    if (allCorrect) {
      complete(true);
    } else {
      fail();
    }
  }, [markedCells, mineCount, phase, cells, complete, fail]);

  // ── Keyboard navigation ───────────────────────────────────────────
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};

    map["ArrowUp"] = () => {
      setCursorRow((r) => Math.max(0, r - 1));
    };
    map["ArrowDown"] = () => {
      setCursorRow((r) => Math.min(rows - 1, r + 1));
    };
    map["ArrowLeft"] = () => {
      setCursorCol((c) => Math.max(0, c - 1));
    };
    map["ArrowRight"] = () => {
      setCursorCol((c) => Math.min(cols - 1, c + 1));
    };

    const handleToggle = () => {
      const cellIndex = cursorRowRef.current * cols + cursorColRef.current;
      toggleMark(cellIndex);
    };

    map["Enter"] = handleToggle;
    map[" "] = handleToggle;

    return map;
  }, [rows, cols, toggleMark]);

  useKeyboard(keyMap);

  // ── Derived values ────────────────────────────────────────────────
  const previewProgress = previewMs > 0 ? previewLeft / previewMs : 0;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Overall timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-4" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full max-w-lg">
        {/* Phase indicator + mine counter */}
        {phase === "preview" ? (
          <div className="text-center">
            <p className="text-cyber-magenta text-sm uppercase tracking-widest font-bold mb-2 animate-pulse">
              Memorize mines
            </p>
            {/* Preview sub-timer bar */}
            <div className="w-40 h-1 rounded-full bg-white/10 mx-auto">
              <div
                className="h-full rounded-full transition-all duration-100 ease-linear"
                style={{
                  width: `${previewProgress * 100}%`,
                  backgroundColor: "var(--color-cyber-magenta)",
                  boxShadow:
                    "0 0 8px var(--color-cyber-magenta), 0 0 16px var(--color-cyber-magenta)",
                }}
              />
            </div>
            <p className="text-white/40 text-xs mt-2">
              {Math.ceil(previewLeft / 1000)}s
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-cyber-cyan text-sm uppercase tracking-widest font-bold mb-1">
              Mark {mineCount} mines
            </p>
            <p className="text-white/50 text-xs uppercase tracking-widest">
              {markedCells.size}/{mineCount} marked
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="w-24 h-px bg-white/10" />

        {/* Grid */}
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell, i) => {
            const cellRow = Math.floor(i / cols);
            const cellCol = i % cols;
            const isCursor =
              phase === "mark" && cellRow === cursorRow && cellCol === cursorCol;
            const isMarked = markedCells.has(cell.id);
            const showMine = phase === "preview" && cell.isMine;

            return (
              <button
                key={cell.id}
                type="button"
                disabled={
                  !isActive || resolvedRef.current || phase === "preview"
                }
                onClick={() => toggleMark(i)}
                className={`
                  flex items-center justify-center
                  w-10 h-10 sm:w-12 sm:h-12
                  rounded-md border-2 font-mono font-bold
                  text-lg sm:text-xl
                  transition-all duration-150
                  focus:outline-none
                  ${
                    showMine
                      ? "border-cyber-magenta/80 bg-cyber-magenta/20 text-cyber-magenta shadow-[0_0_10px_rgba(255,0,102,0.3)]"
                      : isMarked
                        ? "border-cyber-cyan bg-cyber-cyan/15 text-cyber-cyan shadow-[0_0_12px_rgba(0,255,255,0.25)]"
                        : isCursor
                          ? "border-cyber-cyan/60 bg-cyber-cyan/10 text-white shadow-[0_0_10px_rgba(0,255,255,0.15)]"
                          : phase === "mark"
                            ? "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 cursor-pointer"
                            : "border-white/10 bg-white/5 text-white/30"
                  }
                `}
              >
                {showMine ? (
                  <span className="text-base">⬟</span>
                ) : isMarked ? (
                  <span className="text-base">⚑</span>
                ) : (
                  <span className="text-white/10">·</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center">
        {phase === "preview" ? (
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Remember the mine positions
          </p>
        ) : (
          <>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
              Click or arrow keys + Enter/Space to toggle mark
            </p>
            <div className="inline-flex flex-col items-center gap-1">
              <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
                {"\u2191"}
              </kbd>
              <div className="flex items-center gap-1">
                <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
                  {"\u2190"}
                </kbd>
                <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
                  {"\u2193"}
                </kbd>
                <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
                  {"\u2192"}
                </kbd>
              </div>
              <kbd className="px-6 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono mt-1">
                Enter / Space
              </kbd>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
