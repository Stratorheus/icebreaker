import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { TouchControls } from "@/components/layout/TouchControls";
import { ArrowKeyHints } from "@/components/layout/ArrowKeyHints";
import { cellStyles } from "@/components/layout/GameCell";
import { useTouchDevice } from "@/hooks/use-touch-device";

// ── Types ─────────────────────────────────────────────────────────────

type CellState = "hidden" | "revealed" | "flagged";

interface DefragCell {
  id: number;
  isMine: boolean;
  /** Count of adjacent mines (0–8). Pre-computed on generation. */
  adjacentMines: number;
}

interface GeneratedBoard {
  cells: DefragCell[];
  cols: number;
  rows: number;
  mineCount: number;
}

// ── Number colors ─────────────────────────────────────────────────────

const NUMBER_COLORS: Record<number, string> = {
  1: "text-cyber-cyan",
  2: "text-cyber-green",
  3: "text-cyber-orange",
  4: "text-cyber-magenta",
  5: "text-cyber-magenta",
  6: "text-cyber-magenta",
  7: "text-cyber-magenta",
  8: "text-cyber-magenta",
};

// ── Board generation ──────────────────────────────────────────────────

function getNeighbors(
  index: number,
  cols: number,
  rows: number,
): number[] {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const neighbors: number[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push(nr * cols + nc);
      }
    }
  }

  return neighbors;
}

function generateBoard(difficulty: number): GeneratedBoard {
  // Grid: 4×4 (trivial) → 8×8 (insane). Smaller grids = fewer cells to uncover under time pressure.
  const size = Math.round(4 + difficulty * 4);
  const cols = size;
  const rows = size;
  const totalCells = rows * cols;

  // Mines: 1 (trivial) → 8 (insane), capped at 18% of grid
  const rawMines = Math.round(1 + difficulty * 7);
  const mineCount = Math.min(rawMines, Math.floor(totalCells * 0.18));

  const cells: DefragCell[] = Array.from({ length: totalCells }, (_, i) => ({
    id: i, isMine: false, adjacentMines: 0,
  }));

  return { cells, cols, rows, mineCount };
}

function placeMines(
  cells: DefragCell[],
  cols: number,
  rows: number,
  mineCount: number,
  safeIndex: number,
): void {
  const totalCells = rows * cols;
  const protectedSet = new Set([safeIndex, ...getNeighbors(safeIndex, cols, rows)]);

  const candidates = Array.from({ length: totalCells }, (_, i) => i)
    .filter((i) => !protectedSet.has(i));

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const actualMines = Math.min(mineCount, candidates.length);
  const minePositions = new Set(candidates.slice(0, actualMines));

  for (const cell of cells) {
    cell.isMine = minePositions.has(cell.id);
    cell.adjacentMines = 0;
  }
  for (const cell of cells) {
    if (!cell.isMine) {
      const neighbors = getNeighbors(cell.id, cols, rows);
      cell.adjacentMines = neighbors.filter((n) => cells[n].isMine).length;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────

export function Defrag(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("defrag", props);

  // Mine Radar: fraction of timer during which mine-containing rows/cols are highlighted
  const mineRadarFraction = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "defrag",
    );
    return pu ? pu.effect.value : 0;
  }, [activePowerUps]);

  const resolvedRef = useRef(false);

  const firstClickRef = useRef(true);
  const minesPlacedRef = useRef(false);

  const board = useMemo(
    () => generateBoard(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { cells, cols, rows, mineCount } = board;
  const totalCells = rows * cols;
  const safeCellCount = totalCells - mineCount;

  // ── Cell states ───────────────────────────────────────────────────
  const [cellStates, setCellStates] = useState<CellState[]>(
    () => Array(totalCells).fill("hidden") as CellState[],
  );
  const cellStatesRef = useRef(cellStates);

  useEffect(() => {
    cellStatesRef.current = cellStates;
  }, [cellStates]);

  const [revealedCount, setRevealedCount] = useState(0);
  const revealedCountRef = useRef(0);

  useEffect(() => {
    revealedCountRef.current = revealedCount;
  }, [revealedCount]);

  const [showMines, setShowMines] = useState(false);

  const [mineRowCounts, setMineRowCounts] = useState<number[]>([]);
  const [mineColCounts, setMineColCounts] = useState<number[]>([]);
  const radarVisible = minesPlacedRef.current && mineRadarFraction > 0 && timer.progress > (1 - mineRadarFraction);

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

  const isTouch = useTouchDevice();

  // ── Touch flag mode toggle ──────────────────────────────────────
  const [flagMode, setFlagMode] = useState(false);

  // ── Flood fill (BFS) for 0-cells ─────────────────────────────────
  const floodFill = useCallback(
    (startIndex: number, states: CellState[]): { newStates: CellState[]; newRevealed: number } => {
      const next = [...states];
      let revealed = 0;
      const queue: number[] = [startIndex];

      while (queue.length > 0) {
        const idx = queue.shift()!;
        if (next[idx] === "revealed") continue;
        if (next[idx] === "flagged") continue;

        const cell = cells[idx];
        if (cell.isMine) continue;

        next[idx] = "revealed";
        revealed++;

        if (cell.adjacentMines === 0) {
          const neighbors = getNeighbors(idx, cols, rows);
          for (const n of neighbors) {
            if (next[n] === "hidden") {
              queue.push(n);
            }
          }
        }
      }

      return { newStates: next, newRevealed: revealed };
    },
    [cells, cols, rows],
  );

  // ── Uncover a cell ────────────────────────────────────────────────
  const uncoverCell = useCallback(
    (cellIndex: number) => {
      if (!isActive || resolvedRef.current) return;

      const currentState = cellStatesRef.current[cellIndex];
      if (currentState !== "hidden") return;

      if (!minesPlacedRef.current) {
        minesPlacedRef.current = true;
        firstClickRef.current = false;
        placeMines(cells, cols, rows, mineCount, cellIndex);

        if (mineRadarFraction > 0) {
          const rowCounts = new Array(rows).fill(0) as number[];
          const colCounts = new Array(cols).fill(0) as number[];
          for (const cell of cells) {
            if (cell.isMine) {
              rowCounts[Math.floor(cell.id / cols)]++;
              colCounts[cell.id % cols]++;
            }
          }
          setMineRowCounts(rowCounts);
          setMineColCounts(colCounts);
        }
      }

      const cell = cells[cellIndex];

      if (cell.isMine) {
        resolvedRef.current = true;
        setShowMines(true);
        setTimeout(() => {
          fail();
        }, 600);
        return;
      }

      setCellStates((prev) => {
        const { newStates, newRevealed } = floodFill(cellIndex, prev);
        const totalRevealed = revealedCountRef.current + newRevealed;

        queueMicrotask(() => {
          setRevealedCount(totalRevealed);
        });

        return newStates;
      });
    },
    [isActive, cells, cols, rows, mineCount, mineRadarFraction, floodFill, fail],
  );

  // ── Toggle flag on a cell ─────────────────────────────────────────
  const toggleFlag = useCallback(
    (cellIndex: number) => {
      if (!isActive || resolvedRef.current) return;

      const currentState = cellStatesRef.current[cellIndex];
      if (currentState === "revealed") return;

      setCellStates((prev) => {
        const next = [...prev];
        next[cellIndex] = prev[cellIndex] === "flagged" ? "hidden" : "flagged";
        return next;
      });
    },
    [isActive],
  );

  // ── Win check ─────────────────────────────────────────────────────
  useEffect(() => {
    if (resolvedRef.current) return;
    if (revealedCount >= safeCellCount) {
      resolvedRef.current = true;
      complete(true);
    }
  }, [revealedCount, safeCellCount, complete]);

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

    map[" "] = () => {
      const cellIndex = cursorRowRef.current * cols + cursorColRef.current;
      uncoverCell(cellIndex);
    };

    map["Enter"] = () => {
      const cellIndex = cursorRowRef.current * cols + cursorColRef.current;
      toggleFlag(cellIndex);
    };

    return map;
  }, [rows, cols, uncoverCell, toggleFlag]);

  useKeyboard(keyMap);

  // ── Derived values ────────────────────────────────────────────────
  const flagCount = cellStates.filter((s) => s === "flagged").length;

  const cellSizeClass =
    cols <= 5
      ? "w-10 h-10 sm:w-12 sm:h-12 text-lg sm:text-xl"
      : cols <= 7
        ? "w-9 h-9 sm:w-10 sm:h-10 text-base sm:text-lg"
        : "w-7 h-7 sm:w-9 sm:h-9 text-sm sm:text-base";

  return (
    <MinigameShell
      timer={timer}
      timerGap="mb-4"
      gap="gap-4"
      desktopHint={
        <>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
            L-Click / Space = uncover &nbsp;|&nbsp; R-Click / Enter = flag
          </p>
          <ArrowKeyHints />
          <div className="desktop-only flex items-center gap-1 mt-1">
            <kbd className="px-4 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
              Space
            </kbd>
            <kbd className="px-4 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
              Enter
            </kbd>
          </div>
        </>
      }
      touchHint={
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
            TAP = {flagMode ? "flag" : "uncover"} &nbsp;|&nbsp; toggle mode below
          </p>
          <button
            type="button"
            onClick={() => setFlagMode((v) => !v)}
            className={`
              px-4 py-2 rounded-lg border text-xs uppercase tracking-widest font-mono font-bold
              transition-all duration-150
              ${flagMode
                ? "border-cyber-magenta/60 bg-cyber-magenta/15 text-cyber-magenta"
                : "border-cyber-cyan/60 bg-cyber-cyan/15 text-cyber-cyan"
              }
            `}
          >
            MODE: {flagMode ? "⚑ FLAG" : "◆ UNCOVER"}
          </button>
        </div>
      }
    >
      {/* Header */}
      <div className="text-center">
        <p className="text-cyber-cyan text-xs uppercase tracking-[0.3em] font-mono font-bold mb-1 animate-pulse">
          Defragmenting memory block...
        </p>
        <p className="text-white/50 text-xs uppercase tracking-widest">
          {revealedCount}/{safeCellCount} sectors clear &nbsp;|&nbsp; ⚑ {flagCount}/{mineCount}
        </p>
      </div>

      {/* Divider */}
      <div className="w-24 h-px bg-white/10" />

      {/* Grid with Mine Radar indicators */}
      <div className="flex flex-col items-center gap-0">
        {/* Column indicators (above grid) */}
        {radarVisible && mineColCounts.length > 0 && (
          <div className="flex gap-1 mb-1">
            <div className="w-5 mr-0.5 shrink-0" />
            {mineColCounts.map((count, c) => {
              const widthClasses = cellSizeClass.split(" ").filter(c => c.startsWith("w-") || c.startsWith("sm:w-")).join(" ");
              return (
                <div
                  key={`col-${c}`}
                  data-testid="mine-radar-indicator"
                  data-count={count}
                  className={`
                    flex items-center justify-center
                    ${widthClasses} h-5 font-mono font-bold text-[10px]
                    ${count > 0 ? "text-cyber-orange/70" : "text-white/10"}
                  `}
                >
                  {count > 0 ? count : "·"}
                </div>
              );
            })}
          </div>
        )}

        {/* Grid rows with optional row indicators */}
        <div className="flex gap-1">
          {/* Row indicators (left of grid) */}
          {radarVisible && mineRowCounts.length > 0 && (
            <div className="flex flex-col gap-1 justify-start mr-0.5">
              {mineRowCounts.map((count, r) => (
                <div
                  key={`row-${r}`}
                  data-testid="mine-radar-indicator"
                  data-count={count}
                  className={`
                    flex items-center justify-center
                    w-5 font-mono font-bold text-[10px]
                    ${cellSizeClass.replace(/w-\S+/g, "").replace(/text-\S+/g, "")}
                    ${count > 0 ? "text-cyber-orange/70" : "text-white/10"}
                  `}
                  style={{
                    height: cellSizeClass.includes("w-10") ? "2.5rem"
                      : cellSizeClass.includes("w-9") ? "2.25rem"
                      : "1.75rem",
                  }}
                >
                  {count > 0 ? count : "·"}
                </div>
              ))}
            </div>
          )}

          {/* Main grid */}
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {cells.map((cell, i) => {
              const cellRow = Math.floor(i / cols);
              const cellCol = i % cols;
              const isCursor = !isTouch && cellRow === cursorRow && cellCol === cursorCol;
              const state = cellStates[i];
              const isMineRevealed = showMines && cell.isMine;

              return (
                <button
                  key={cell.id}
                  data-testid="cell"
                  data-mine={cell.isMine}
                  data-index={i}
                  type="button"
                  disabled={!isActive || resolvedRef.current}
                  onClick={() => flagMode ? toggleFlag(i) : uncoverCell(i)}
                  onMouseEnter={() => {
                    if (!isTouch) {
                      setCursorRow(cellRow);
                      setCursorCol(cellCol);
                      cursorRowRef.current = cellRow;
                      cursorColRef.current = cellCol;
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleFlag(i);
                  }}
                  className={`
                    ${cellSizeClass} font-mono font-bold
                    ${
                      isMineRevealed
                        ? "flex items-center justify-center rounded-md border border-cyber-magenta bg-cyber-magenta/30 text-cyber-magenta shadow-[0_0_10px_rgba(255,0,102,0.4)] transition-all duration-150 focus:outline-none select-none"
                        : state === "revealed"
                          ? cell.adjacentMines > 0
                            ? "flex items-center justify-center rounded-md border border-white/5 bg-white/5 transition-all duration-150 focus:outline-none select-none " + (NUMBER_COLORS[cell.adjacentMines] ?? "text-cyber-magenta")
                            : "flex items-center justify-center rounded-md border border-white/5 bg-white/[0.03] transition-all duration-150 focus:outline-none select-none"
                          : state === "flagged"
                            ? "flex items-center justify-center rounded-md border border-cyber-magenta/60 bg-cyber-magenta/10 text-cyber-magenta transition-all duration-150 focus:outline-none select-none"
                            : cellStyles({ isCursor, isTouch })
                    }
                  `}
                >
                  {isMineRevealed ? (
                    <span className="text-sm">✦</span>
                  ) : state === "revealed" ? (
                    cell.adjacentMines > 0 ? (
                      <span>{cell.adjacentMines}</span>
                    ) : null
                  ) : state === "flagged" ? (
                    <span className="text-sm">⚑</span>
                  ) : (
                    <span className="text-white/10">·</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <TouchControls type="dpad" />
    </MinigameShell>
  );
}
