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
 * - Grid size: 3×3 (d=0) → 6×6 (d=1)
 * - Mine count: 3 (d=0) → 10 (d=1), capped at ~40% of cells
 * - Preview duration: 3s (d=0) → 1s (d=1)
 */
function generateGrid(difficulty: number): GeneratedGrid {
  const size = Math.round(3 + difficulty * 3);
  const cols = size;
  const rows = size;
  const totalCells = rows * cols;

  // Cap mines at 40% of total cells
  const rawMines = Math.round(3 + difficulty * 7);
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
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "mine-sweep",
    props,
  );

  const resolvedRef = useRef(false);

  // 2h. Mine Detector (flag-mine): pre-reveal mines after preview ends
  const flagMineCount = useMemo(() => {
    let count = 0;
    for (const pu of activePowerUps) {
      if (pu.effect.type === "flag-mine" && (!pu.effect.minigame || pu.effect.minigame === "mine-sweep")) {
        count += pu.effect.value;
      }
    }
    return count;
  }, [activePowerUps]);

  // 3c. MineSweep minigame-specific: mines-visible (percentage of mines visible after preview)
  const minesVisiblePct = useMemo(() => {
    let pct = 0;
    for (const pu of activePowerUps) {
      if (pu.effect.type === "minigame-specific" && pu.effect.minigame === "mine-sweep") {
        pct = Math.max(pct, pu.effect.value); // use highest tier value
      }
    }
    return pct;
  }, [activePowerUps]);

  // Generate grid on mount (stable across re-renders)
  const grid = useMemo(
    () => generateGrid(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { cells, cols, rows, mineCount, previewMs } = grid;

  // Pre-compute which mines to auto-flag and which to keep visible
  const { autoFlaggedMines, visibleMines } = useMemo(() => {
    const mineIndices = cells
      .map((c, i) => (c.isMine ? i : -1))
      .filter((i) => i >= 0);
    const shuffled = [...mineIndices].sort(() => Math.random() - 0.5);

    // Auto-flagged mines (from flag-mine power-up)
    const flagCount = Math.min(flagMineCount, shuffled.length);
    const autoFlagged = new Set(shuffled.slice(0, flagCount));

    // Visible mines (from mines-visible meta upgrade, percentage-based) — pick from remaining
    const remaining = shuffled.filter((i) => !autoFlagged.has(i));
    const visCount = minesVisiblePct > 0
      ? Math.min(Math.max(1, Math.round(mineCount * minesVisiblePct)), remaining.length)
      : 0;
    const visible = new Set(remaining.slice(0, visCount));

    return { autoFlaggedMines: autoFlagged, visibleMines: visible };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      previewStartRef.current = null;
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

  // ── Marked cells (initialized with auto-flagged mines from flag-mine power-up)
  const [markedCells, setMarkedCells] = useState<Set<number>>(() => new Set(autoFlaggedMines));
  const markedCellsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    markedCellsRef.current = markedCells;
  }, [markedCells]);

  /** Toggle a cell's mark. Wrong mark = immediate fail. Auto-complete when all mines found. */
  const toggleMark = useCallback(
    (cellIndex: number) => {
      if (!isActive || resolvedRef.current) return;
      if (phaseRef.current !== "mark") return;

      const cell = cells[cellIndex];

      // Un-marking is allowed unless it was auto-flagged by Mine Detector
      if (markedCellsRef.current.has(cellIndex) && !autoFlaggedMines.has(cellIndex)) {
        setMarkedCells((prev) => {
          const next = new Set(prev);
          next.delete(cellIndex);
          return next;
        });
        return;
      }

      // Don't allow marking more than mineCount
      if (markedCellsRef.current.size >= mineCount) return;

      // Wrong mark = immediate fail
      if (!cell.isMine) {
        resolvedRef.current = true;
        fail();
        return;
      }

      // Correct mark
      setMarkedCells((prev) => {
        const next = new Set(prev);
        next.add(cellIndex);
        return next;
      });
    },
    [isActive, mineCount, cells, fail, autoFlaggedMines],
  );

  // Auto-complete when all mines are correctly marked
  useEffect(() => {
    if (phase !== "mark" || resolvedRef.current) return;
    if (markedCells.size !== mineCount) return;

    // All marks are guaranteed correct (wrong marks cause immediate fail above)
    resolvedRef.current = true;
    complete(true);
  }, [markedCells, mineCount, phase, complete]);

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
              Memorize targets
            </p>
            {/* Preview sub-timer bar */}
            <div className="w-40 h-1 rounded-full bg-white/10 mx-auto">
              <div
                className="h-full rounded-full"
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
              Mark {mineCount} corrupted sectors
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
            // 3c. mines-visible: keep certain mines visible even in mark phase
            const isVisibleMine = phase === "mark" && visibleMines.has(cell.id) && !isMarked;

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
                      : isVisibleMine
                        ? "border-cyber-magenta/40 bg-cyber-magenta/10 text-cyber-magenta/60"
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
                ) : isVisibleMine ? (
                  <span className="text-base opacity-60">⬟</span>
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
            Remember the corrupted sector positions
          </p>
        ) : (
          <>
            <p className="desktop-only text-white/40 text-xs uppercase tracking-widest mb-2">
              Click or arrow keys + Enter/Space to toggle mark
            </p>
            <p className="touch-only text-white/40 text-xs uppercase tracking-widest mb-2">
              TAP to mark corrupted sectors
            </p>
            <div className="desktop-only inline-flex flex-col items-center gap-1">
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
