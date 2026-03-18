import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

/**
 * Full symbol pool. At low difficulty we pick from clearly distinct symbols;
 * at high difficulty we include visually similar pairs.
 */
const DISTINCT_SYMBOLS = ["◆", "■", "▲", "●", "★", "♠", "♣", "♥", "⬟", "◉", "⊕", "⊗", "▼"];
const SIMILAR_PAIRS = ["◇", "□", "△", "○", "☆", "♦", "⬡", "◎", "⊘", "⊙", "▽"];

function getSymbolPool(difficulty: number): string[] {
  // At d=0 use only distinct symbols; at d=1 mix in all similar ones
  const similarCount = Math.round(difficulty * SIMILAR_PAIRS.length);
  return [...DISTINCT_SYMBOLS, ...SIMILAR_PAIRS.slice(0, similarCount)];
}

/** Shuffle an array in place (Fisher-Yates) and return it */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface GridCell {
  symbol: string;
  /** Unique id for React keys */
  id: number;
}

interface GeneratedPuzzle {
  grid: GridCell[];
  targets: string[];
  cols: number;
  rows: number;
}

/**
 * Generate a grid and a target sequence.
 *
 * 1. Pick `seqLen` target symbols (may repeat across the sequence).
 * 2. Fill the grid with random symbols from the pool, ensuring each
 *    target appears at least once.
 * 3. Shuffle grid positions.
 */
function generatePuzzle(difficulty: number): GeneratedPuzzle {
  const cols = Math.round(4 + difficulty * 2);
  const rows = cols; // square grid
  const totalCells = rows * cols;
  const seqLen = Math.round(2 + difficulty * 3);

  const pool = getSymbolPool(difficulty);

  // Pick target symbols for the sequence
  const targets: string[] = [];
  for (let i = 0; i < seqLen; i++) {
    targets.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Unique set of target symbols that must appear in the grid
  const uniqueTargets = [...new Set(targets)];

  // Start by placing one guaranteed copy of each unique target
  const cells: string[] = [...uniqueTargets];

  // Fill remaining cells with random symbols from the pool
  while (cells.length < totalCells) {
    cells.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Shuffle
  shuffle(cells);

  const grid: GridCell[] = cells.map((symbol, i) => ({ symbol, id: i }));

  return { grid, targets, cols, rows };
}

/**
 * FindSymbol -- grid-based symbol-finding minigame.
 *
 * A target sequence of symbols is shown at the top. The player must
 * find and click/select the current target symbol in the grid, in order.
 * Wrong cell = immediate fail. All targets found = success.
 *
 * Supports both mouse click and arrow-key + Enter navigation.
 */
export function FindSymbol(props: MinigameProps) {
  const { difficulty } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "find-symbol",
    props,
  );

  const resolvedRef = useRef(false);

  // Generate puzzle on mount (stable across re-renders)
  const puzzle = useMemo(
    () => generatePuzzle(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { grid, targets, cols, rows } = puzzle;

  // Current target index in the sequence
  const [targetIndex, setTargetIndex] = useState(0);
  const targetIndexRef = useRef(0);

  useEffect(() => {
    targetIndexRef.current = targetIndex;
  }, [targetIndex]);

  // Cursor position for keyboard navigation (row, col)
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

  // Track which cells have been correctly selected (by cell id)
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());

  /** Attempt to select a cell at the given grid index */
  const handleSelect = useCallback(
    (cellIndex: number) => {
      if (!isActive || resolvedRef.current) return;

      const idx = targetIndexRef.current;
      if (idx >= targets.length) return;

      const cell = grid[cellIndex];
      const expected = targets[idx];

      if (cell.symbol === expected) {
        // Correct -- mark cell, advance target
        const nextTarget = idx + 1;
        setTargetIndex(nextTarget);
        setSelectedCells((prev) => new Set(prev).add(cell.id));

        if (nextTarget >= targets.length) {
          resolvedRef.current = true;
          complete(true);
        }
      } else {
        // Wrong cell -- immediate fail
        resolvedRef.current = true;
        fail();
      }
    },
    [isActive, targets, grid, complete, fail],
  );

  // Keyboard navigation
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
    map["Enter"] = () => {
      const cellIndex = cursorRowRef.current * cols + cursorColRef.current;
      handleSelect(cellIndex);
    };

    return map;
  }, [rows, cols, handleSelect]);

  useKeyboard(keyMap);

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-6" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-lg">
        {/* Target sequence */}
        <div className="text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
            Find in order
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            {targets.map((symbol, i) => {
              const isCompleted = i < targetIndex;
              const isCurrent = i === targetIndex;

              return (
                <div
                  key={i}
                  className={`
                    flex items-center justify-center
                    w-10 h-10 sm:w-12 sm:h-12
                    rounded-lg border-2 font-mono font-bold
                    text-xl sm:text-2xl
                    transition-all duration-200
                    ${
                      isCompleted
                        ? "border-cyber-green/40 bg-cyber-green/10 text-cyber-green"
                        : isCurrent
                          ? "border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan animate-pulse shadow-[0_0_16px_rgba(0,255,255,0.3)]"
                          : "border-white/15 bg-white/5 text-white/40"
                    }
                  `}
                >
                  {isCompleted ? (
                    <span className="text-cyber-green text-base">&#10003;</span>
                  ) : (
                    symbol
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/10" />

        {/* Symbol grid */}
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {grid.map((cell, i) => {
            const cellRow = Math.floor(i / cols);
            const cellCol = i % cols;
            const isCursor = cellRow === cursorRow && cellCol === cursorCol;
            const isSelected = selectedCells.has(cell.id);

            return (
              <button
                key={cell.id}
                type="button"
                disabled={!isActive || resolvedRef.current}
                onClick={() => handleSelect(i)}
                className={`
                  flex items-center justify-center
                  w-10 h-10 sm:w-12 sm:h-12
                  rounded-md border-2 font-mono font-bold
                  text-lg sm:text-xl
                  transition-all duration-150
                  cursor-pointer
                  focus:outline-none
                  ${
                    isSelected
                      ? "border-cyber-green/60 bg-cyber-green/15 text-cyber-green"
                      : isCursor
                        ? "border-cyber-cyan bg-cyber-cyan/10 text-white shadow-[0_0_12px_rgba(0,255,255,0.25)]"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
                  }
                `}
              >
                {isSelected ? (
                  <span className="text-cyber-green text-sm">&#10003;</span>
                ) : (
                  cell.symbol
                )}
              </button>
            );
          })}
        </div>

        {/* Progress */}
        <p className="text-white/40 text-xs uppercase tracking-widest">
          {targetIndex}/{targets.length}
        </p>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Click or use arrow keys + Enter to select
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
            Enter
          </kbd>
        </div>
      </div>
    </div>
  );
}
