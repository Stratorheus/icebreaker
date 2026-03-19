import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

// ── Types ─────────────────────────────────────────────────────────────

interface GridNode {
  /** 0-based order along the Hamiltonian path */
  pathIndex: number;
  /** If this cell is a numbered checkpoint, its 1-based label; otherwise null */
  label: number | null;
}

type Direction = "up" | "down" | "left" | "right";

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const DIR_FROM_KEY: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// ── Puzzle generation ─────────────────────────────────────────────────

interface GeneratedPuzzle {
  rows: number;
  cols: number;
  grid: GridNode[][];
  /** The Hamiltonian path as [row, col] pairs (index 0 = start) */
  path: [number, number][];
  /** Checkpoint positions in order, 1-indexed labels */
  checkpoints: { row: number; col: number; label: number }[];
  nodeCount: number;
}

/**
 * Generate a solvable snake/ZIP puzzle using a zigzag Hamiltonian path.
 *
 * 1. Create a zigzag path that visits every cell exactly once.
 * 2. Place numbered checkpoints at random positions along this path.
 * 3. The first cell of the path is the snake's starting position.
 *
 * Difficulty scaling (0-1):
 * - size = Math.round(4 + difficulty * 2)  →  4x4 to 6x6
 * - nodeCount = Math.round(3 + difficulty * 4)  →  3 to 7
 *
 * The LAST cell of the Hamiltonian path (final snake move) always
 * contains the highest-numbered checkpoint so the snake naturally
 * finishes there.
 */
function generatePuzzle(difficulty: number): GeneratedPuzzle {
  const size = Math.round(4 + difficulty * 2);
  const rows = size;
  const cols = size;
  const totalCells = rows * cols;

  // Build a zigzag Hamiltonian path:
  // Even rows go left-to-right, odd rows go right-to-left (snake pattern)
  const path: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c++) path.push([r, c]);
    } else {
      for (let c = cols - 1; c >= 0; c--) path.push([r, c]);
    }
  }

  // Determine number of checkpoints (increased: 3 at d=0, 7 at d=1)
  const nodeCount = Math.round(3 + difficulty * 4);

  // Place checkpoints at random (non-start) positions along the path,
  // maintaining their order along the path.
  // Reserve index 0 for the snake start (not a checkpoint).
  // Reserve the LAST path index (totalCells - 1) for the highest checkpoint.
  const availableIndices: number[] = [];
  for (let i = 1; i < totalCells - 1; i++) {
    availableIndices.push(i);
  }

  // We need nodeCount - 1 random positions (the last checkpoint is at the end)
  const innerCount = nodeCount - 1;
  const chosenPathIndices: number[] = [];
  for (let i = 0; i < innerCount && i < availableIndices.length; i++) {
    const j = i + Math.floor(Math.random() * (availableIndices.length - i));
    [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
    chosenPathIndices.push(availableIndices[i]);
  }

  // Sort chosen indices so checkpoints are numbered in path order
  chosenPathIndices.sort((a, b) => a - b);

  // Append the last path cell as the final (highest) checkpoint
  chosenPathIndices.push(totalCells - 1);

  // Build grid
  const grid: GridNode[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      pathIndex: -1,
      label: null,
    })),
  );

  // Fill path indices
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    grid[r][c] = { pathIndex: i, label: null };
  }

  // Place checkpoint labels
  const checkpoints: GeneratedPuzzle["checkpoints"] = [];
  for (let i = 0; i < chosenPathIndices.length; i++) {
    const pathIdx = chosenPathIndices[i];
    const [r, c] = path[pathIdx];
    const label = i + 1;
    grid[r][c].label = label;
    checkpoints.push({ row: r, col: c, label });
  }

  return { rows, cols, grid, path, checkpoints, nodeCount };
}

// ── Component ─────────────────────────────────────────────────────────

/**
 * DataStream — snake/ZIP puzzle minigame.
 *
 * Guide a data stream (snake) through a grid, visiting all numbered
 * nodes IN ORDER while filling every cell. The snake grows with each
 * move. Moving in the opposite direction of the last move retracts
 * the head (undo). Space resets the puzzle.
 *
 * Win: all cells filled AND all checkpoints visited in order.
 * Fail: timeout only.
 */
export function DataStream(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, isActive } = useMinigame("data-stream", props);

  // Node Beacon module: next node pulses more prominently
  const hasNodeBeacon = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "data-stream",
    );
  }, [activePowerUps]);

  const resolvedRef = useRef(false);

  // Generate puzzle on mount (stable across re-renders)
  const puzzle = useMemo(
    () => generatePuzzle(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { rows, cols, grid, nodeCount } = puzzle;
  const totalCells = rows * cols;

  // ── Snake state ─────────────────────────────────────────────────────
  // The snake is stored as an ordered list of [row, col] positions.
  // snake[0] is the tail, snake[snake.length - 1] is the head.
  const startPos = puzzle.path[0];

  const [snake, setSnake] = useState<[number, number][]>([startPos]);
  const snakeRef = useRef<[number, number][]>([startPos]);

  // Direction of the last move (null if no move yet)
  const [lastDir, setLastDir] = useState<Direction | null>(null);
  const lastDirRef = useRef<Direction | null>(null);

  // Track which checkpoints have been visited (by label, 1-indexed)
  const [visitedNodes, setVisitedNodes] = useState<number>(0);
  const visitedNodesRef = useRef(0);

  // Sync refs
  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);
  useEffect(() => {
    lastDirRef.current = lastDir;
  }, [lastDir]);
  useEffect(() => {
    visitedNodesRef.current = visitedNodes;
  }, [visitedNodes]);

  // Build a Set of occupied cells for O(1) collision checking
  const occupiedSet = useMemo(() => {
    const s = new Set<string>();
    for (const [r, c] of snake) {
      s.add(`${r},${c}`);
    }
    return s;
  }, [snake]);

  // ── Win check ───────────────────────────────────────────────────────
  useEffect(() => {
    if (resolvedRef.current) return;
    if (snake.length === totalCells && visitedNodes === nodeCount) {
      resolvedRef.current = true;
      complete(true);
    }
  }, [snake.length, visitedNodes, totalCells, nodeCount, complete]);

  // ── Check if a position has a checkpoint and if it should be collected ──
  const checkAndCollectNode = useCallback(
    (r: number, c: number, currentVisited: number): number => {
      const cell = grid[r][c];
      if (cell.label !== null && cell.label === currentVisited + 1) {
        return currentVisited + 1;
      }
      return currentVisited;
    },
    [grid],
  );

  // ── Move handler ────────────────────────────────────────────────────
  const handleMove = useCallback(
    (dir: Direction) => {
      if (!isActive || resolvedRef.current) return;

      const currentSnake = snakeRef.current;
      const currentLastDir = lastDirRef.current;
      const head = currentSnake[currentSnake.length - 1];

      // Check for UNDO: moving in opposite direction of last move
      if (currentLastDir && dir === OPPOSITE[currentLastDir] && currentSnake.length > 1) {
        // Retract: remove head, restore previous direction
        const newSnake = currentSnake.slice(0, -1);

        // Determine the new last direction from the last two cells of the shortened snake
        let newLastDir: Direction | null = null;
        if (newSnake.length >= 2) {
          const prev = newSnake[newSnake.length - 2];
          const curr = newSnake[newSnake.length - 1];
          const dr = curr[0] - prev[0];
          const dc = curr[1] - prev[1];
          if (dr === -1) newLastDir = "up";
          else if (dr === 1) newLastDir = "down";
          else if (dc === -1) newLastDir = "left";
          else if (dc === 1) newLastDir = "right";
        }

        // Check if the removed head had a checkpoint that we collected.
        // If so, un-visit it.
        const removedCell = grid[head[0]][head[1]];
        let newVisited = visitedNodesRef.current;
        if (removedCell.label !== null && removedCell.label === newVisited) {
          newVisited = newVisited - 1;
        }

        // Also check if the new head position has a checkpoint we need to recollect
        // (it was already visited when we first moved there, so it stays visited if label <= newVisited)
        // Actually, the new head's checkpoint was already counted, so no action needed.
        // But we need to check: did we un-visit a node, and does the new head
        // have a node that's now the next target? The new head's node was collected
        // before, so its label <= newVisited (before decrement) which means
        // label <= newVisited (after decrement) + 1, so it's still valid.

        setSnake(newSnake);
        setLastDir(newLastDir);
        setVisitedNodes(newVisited);
        return;
      }

      // Normal move: extend head in direction
      const [dr, dc] = DELTA[dir];
      const nr = head[0] + dr;
      const nc = head[1] + dc;

      // Bounds check
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;

      // Collision check: cannot move into a cell already occupied by the snake
      const key = `${nr},${nc}`;
      const currentOccupied = new Set<string>();
      for (const [sr, sc] of currentSnake) {
        currentOccupied.add(`${sr},${sc}`);
      }
      if (currentOccupied.has(key)) return;

      // Valid move — extend the snake
      const newSnake = [...currentSnake, [nr, nc] as [number, number]];

      // Check for checkpoint collection
      const newVisited = checkAndCollectNode(nr, nc, visitedNodesRef.current);

      setSnake(newSnake);
      setLastDir(dir);
      setVisitedNodes(newVisited);
    },
    [isActive, rows, cols, grid, checkAndCollectNode],
  );

  // ── Reset handler ───────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!isActive || resolvedRef.current) return;
    setSnake([startPos]);
    setLastDir(null);
    setVisitedNodes(0);
  }, [isActive, startPos]);

  // ── Keyboard navigation ─────────────────────────────────────────────
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};

    for (const [key, dir] of Object.entries(DIR_FROM_KEY)) {
      map[key] = () => handleMove(dir);
    }

    // Space = reset puzzle
    map[" "] = handleReset;

    return map;
  }, [handleMove, handleReset]);

  useKeyboard(keyMap);

  // ── Dynamic cell sizing ─────────────────────────────────────────────
  const cellPx = cols <= 4 ? 52 : cols <= 5 ? 44 : 36;

  // ── Render helpers ──────────────────────────────────────────────────
  const headPos = snake[snake.length - 1];
  const nextTargetLabel = visitedNodes < nodeCount ? visitedNodes + 1 : null;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-4" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full">
        {/* Header */}
        <div className="text-center">
          <p className="text-cyber-cyan text-xs uppercase tracking-[0.3em] font-mono font-bold mb-1 animate-pulse">
            Data stream routing...
          </p>
          <div className="flex items-center justify-center gap-6 text-white/50 text-xs uppercase tracking-widest">
            <span>
              NODES: <span className={visitedNodes === nodeCount ? "text-cyber-green" : "text-cyber-cyan"}>{visitedNodes}/{nodeCount}</span>
            </span>
            <span>
              CELLS: <span className={snake.length === totalCells ? "text-cyber-green" : "text-cyber-cyan"}>{snake.length}/{totalCells}</span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/10" />

        {/* Grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
            gap: "2px",
          }}
        >
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const cell = grid[r][c];
              const isHead = r === headPos[0] && c === headPos[1];
              const isOccupied = occupiedSet.has(`${r},${c}`);
              const isCheckpoint = cell.label !== null;
              const isVisited = cell.label !== null && cell.label <= visitedNodes;
              const isNextTarget = cell.label !== null && cell.label === nextTargetLabel;

              // Cell styling
              let cellClass = "";
              let content: React.ReactNode = null;

              if (isHead) {
                // Snake head — bright cyan/white
                cellClass =
                  "bg-cyan-300/60 border-cyan-200 shadow-[0_0_12px_rgba(0,255,255,0.6)]";
                if (isCheckpoint) {
                  content = (
                    <span
                      className={`font-bold font-mono ${isVisited ? "text-cyber-green" : "text-white"}`}
                      style={{ fontSize: cellPx * 0.4 }}
                    >
                      {cell.label}
                    </span>
                  );
                } else {
                  content = (
                    <span className="text-white font-bold" style={{ fontSize: cellPx * 0.35 }}>
                      &#9670;
                    </span>
                  );
                }
              } else if (isOccupied) {
                // Snake body
                cellClass = "bg-cyber-cyan/30 border-cyber-cyan/40";
                if (isCheckpoint) {
                  content = (
                    <span
                      className={`font-bold font-mono ${isVisited ? "text-cyber-green" : "text-cyber-magenta"}`}
                      style={{ fontSize: cellPx * 0.4 }}
                    >
                      {cell.label}
                    </span>
                  );
                }
              } else if (isCheckpoint) {
                // Unoccupied checkpoint cell
                const checkpointClass = isVisited
                  ? "bg-cyber-green/15 border-cyber-green/40"
                  : isNextTarget
                    ? hasNodeBeacon
                      ? "bg-cyber-magenta/30 border-cyber-magenta/80 animate-pulse shadow-[0_0_16px_rgba(255,0,102,0.5)]"
                      : "bg-cyber-magenta/20 border-cyber-magenta/60 animate-pulse"
                    : "bg-cyber-magenta/10 border-cyber-magenta/30";

                cellClass = checkpointClass;
                content = (
                  <span
                    className={`font-bold font-mono ${
                      isVisited
                        ? "text-cyber-green"
                        : isNextTarget
                          ? "text-cyber-magenta"
                          : "text-cyber-magenta/60"
                    }`}
                    style={{ fontSize: cellPx * 0.4 }}
                  >
                    {cell.label}
                  </span>
                );
              } else {
                // Empty unoccupied cell
                cellClass = "bg-white/[0.04] border-white/[0.06]";
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex items-center justify-center border rounded-sm ${cellClass}`}
                  style={{
                    width: cellPx,
                    height: cellPx,
                  }}
                >
                  {content}
                </div>
              );
            }),
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 text-xs uppercase tracking-widest font-mono flex-wrap justify-center">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-cyan-300/50 border border-cyan-200/60" />
            <span className="text-cyan-300/70">Head</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-cyber-cyan/30 border border-cyber-cyan/50" />
            <span className="text-cyber-cyan/70">Body</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-cyber-magenta/20 border border-cyber-magenta/50" />
            <span className="text-cyber-magenta/70">Target</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-cyber-green/20 border border-cyber-green/50" />
            <span className="text-cyber-green/70">Visited</span>
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Arrows = move &nbsp;|&nbsp; Reverse = undo &nbsp;|&nbsp; Space = reset
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
            Space
          </kbd>
        </div>
      </div>
    </div>
  );
}
