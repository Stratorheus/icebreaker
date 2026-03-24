import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { ArrowKeyHints } from "@/components/layout/ArrowKeyHints";
import { cellStyles } from "@/components/layout/GameCell";
import { useTouchDevice } from "@/hooks/use-touch-device";

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

function generateGrid(difficulty: number): GeneratedGrid {
  const size = Math.round(3 + difficulty * 3);
  const cols = size;
  const rows = size;
  const totalCells = rows * cols;

  const rawMines = Math.round(3 + difficulty * 7);
  const mineCount = Math.min(rawMines, Math.floor(totalCells * 0.4));

  const previewMs = (3 - difficulty * 2) * 1000;

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
 */
export function MineSweep(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "mine-sweep",
    props,
  );

  const resolvedRef = useRef(false);
  const isTouch = useTouchDevice();

  // mine-echo meta upgrade: percentage of mines visible after preview
  const minesVisiblePct = useMemo(() => {
    let pct = 0;
    for (const pu of activePowerUps) {
      if (pu.effect.type === "minigame-specific" && pu.effect.minigame === "mine-sweep") {
        pct = Math.max(pct, pu.effect.value);
      }
    }
    return pct;
  }, [activePowerUps]);

  const grid = useMemo(
    () => generateGrid(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { cells, cols, rows, mineCount, previewMs } = grid;

  // Pre-compute which mines to keep visible (mine-echo percentage)
  const visibleMines = useMemo(() => {
    if (minesVisiblePct <= 0) return new Set<number>();
    const mineIndices = cells
      .map((c, i) => (c.isMine ? i : -1))
      .filter((i) => i >= 0);
    const shuffled = [...mineIndices].sort(() => Math.random() - 0.5);
    const visCount = Math.min(Math.max(1, Math.round(mineCount * minesVisiblePct)), shuffled.length);
    return new Set(shuffled.slice(0, visCount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phase management ──────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("preview");
  const phaseRef = useRef<Phase>("preview");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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

  // ── Marked cells
  const [markedCells, setMarkedCells] = useState<Set<number>>(() => new Set());
  const markedCellsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    markedCellsRef.current = markedCells;
  }, [markedCells]);

  const toggleMark = useCallback(
    (cellIndex: number) => {
      if (!isActive || resolvedRef.current) return;
      if (phaseRef.current !== "mark") return;

      const cell = cells[cellIndex];

      if (markedCellsRef.current.has(cellIndex)) {
        setMarkedCells((prev) => {
          const next = new Set(prev);
          next.delete(cellIndex);
          return next;
        });
        return;
      }

      if (markedCellsRef.current.size >= mineCount) return;

      if (!cell.isMine) {
        resolvedRef.current = true;
        fail();
        return;
      }

      setMarkedCells((prev) => {
        const next = new Set(prev);
        next.add(cellIndex);
        return next;
      });
    },
    [isActive, mineCount, cells, fail],
  );

  // Auto-complete when all mines are correctly marked
  useEffect(() => {
    if (phase !== "mark" || resolvedRef.current) return;
    if (markedCells.size !== mineCount) return;

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

  // Build instruction footer based on phase
  const instructionFooter = phase === "preview" ? (
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
      <ArrowKeyHints />
      <kbd className="desktop-only px-6 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono mt-1">
        Enter / Space
      </kbd>
    </>
  );

  return (
    <MinigameShell
      timer={timer}
      timerGap="mb-4"
      gap="gap-5"
      outerProps={{ "data-testid": "mine-phase", "data-phase": phase }}
      desktopHint={instructionFooter}
      touchHint={instructionFooter}
    >
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
            !isTouch && phase === "mark" && cellRow === cursorRow && cellCol === cursorCol;
          const isMarked = markedCells.has(cell.id);
          const showMine = phase === "preview" && cell.isMine;
          const isVisibleMine = phase === "mark" && visibleMines.has(cell.id) && !isMarked;

          return (
            <button
              key={cell.id}
              data-testid="cell"
              data-mine={cell.isMine}
              data-visible-mine={isVisibleMine}
              data-index={i}
              type="button"
              disabled={
                !isActive || resolvedRef.current || phase === "preview"
              }
              onClick={() => toggleMark(i)}
              onMouseEnter={() => {
                if (!isTouch) {
                  setCursorRow(cellRow);
                  setCursorCol(cellCol);
                  cursorRowRef.current = cellRow;
                  cursorColRef.current = cellCol;
                }
              }}
              className={`
                w-10 h-10 sm:w-12 sm:h-12 font-mono font-bold text-lg sm:text-xl
                ${
                  showMine
                    ? "flex items-center justify-center rounded-md border border-cyber-magenta/80 bg-cyber-magenta/20 text-cyber-magenta shadow-[0_0_10px_rgba(255,0,102,0.3)] transition-all duration-150 focus:outline-none select-none"
                    : isVisibleMine
                      ? "flex items-center justify-center rounded-md border border-cyber-magenta/40 bg-cyber-magenta/10 text-cyber-magenta/60 transition-all duration-150 focus:outline-none select-none"
                      : isMarked
                        ? "flex items-center justify-center rounded-md border border-cyber-cyan bg-cyber-cyan/15 text-cyber-cyan shadow-[0_0_10px_rgba(0,255,255,0.25)] transition-all duration-150 focus:outline-none select-none"
                        : phase === "mark"
                          ? cellStyles({ isCursor, isTouch }) + " text-white/70"
                          : "flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/30 transition-all duration-150 focus:outline-none select-none"
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
    </MinigameShell>
  );
}
