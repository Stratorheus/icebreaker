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

// ── Edge-based wall helpers ──────────────────────────────────────────

/** Walls stored as set of edge keys: "r1,c1-r2,c2" (normalized: smaller coord first) */
type WallSet = Set<string>;

function wallKey(r1: number, c1: number, r2: number, c2: number): string {
  if (r1 < r2 || (r1 === r2 && c1 < c2)) return `${r1},${c1}-${r2},${c2}`;
  return `${r2},${c2}-${r1},${c1}`;
}

function hasWall(walls: WallSet, r1: number, c1: number, r2: number, c2: number): boolean {
  return walls.has(wallKey(r1, c1, r2, c2));
}

/** For each cell, compute which borders have edge-walls */
function getCellWalls(
  r: number,
  c: number,
  rows: number,
  cols: number,
  walls: WallSet,
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  return {
    top: r > 0 && hasWall(walls, r - 1, c, r, c),
    right: c < cols - 1 && hasWall(walls, r, c, r, c + 1),
    bottom: r < rows - 1 && hasWall(walls, r, c, r + 1, c),
    left: c > 0 && hasWall(walls, r, c - 1, r, c),
  };
}

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
  /** Edge-based walls: set of "r1,c1-r2,c2" keys */
  walls: WallSet;
}

// ── Hamiltonian path helpers ─────────────────────────────────────────

/** Get orthogonal neighbors within bounds */
function getNeighbors(
  r: number,
  c: number,
  rows: number,
  cols: number,
): [number, number][] {
  const result: [number, number][] = [];
  if (r > 0) result.push([r - 1, c]);
  if (r < rows - 1) result.push([r + 1, c]);
  if (c > 0) result.push([r, c - 1]);
  if (c < cols - 1) result.push([r, c + 1]);
  return result;
}

/**
 * Generate a random Hamiltonian path using Warnsdorff's heuristic with
 * randomized tiebreaking, plus DFS backtracking as fallback.
 *
 * Warnsdorff: always pick the unvisited neighbor with the fewest
 * unvisited neighbors of its own (most constrained first). This
 * almost always finds a solution on the first try for grids ≤ 10×10.
 * Random tiebreaking ensures diverse puzzles.
 *
 * Returns null if no path found (caller should fall back to zigzag).
 */
function generateRandomHamiltonianPath(
  rows: number,
  cols: number,
): [number, number][] | null {
  const totalCells = rows * cols;
  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  );
  const path: [number, number][] = [];

  // Start from (0, 0) — top-left corner for natural starting position
  const startR = 0;
  const startC = 0;

  /** Count unvisited neighbors of (r, c), excluding `excludeR, excludeC` */
  function degree(r: number, c: number): number {
    let count = 0;
    for (const [nr, nc] of getNeighbors(r, c, rows, cols)) {
      if (!visited[nr][nc]) count++;
    }
    return count;
  }

  /** Get unvisited neighbors sorted by Warnsdorff degree, with random tiebreaking */
  function getSortedNeighbors(
    r: number,
    c: number,
  ): [number, number][] {
    const neighbors = getNeighbors(r, c, rows, cols).filter(
      ([nr, nc]) => !visited[nr][nc],
    );

    // Compute degree for each neighbor
    const withDegree: { pos: [number, number]; deg: number; rnd: number }[] =
      neighbors.map((pos) => ({
        pos,
        deg: degree(pos[0], pos[1]) - 1, // -1 because current cell will be visited
        rnd: Math.random(),
      }));

    // Sort by degree ascending, random tiebreak
    withDegree.sort((a, b) => a.deg - b.deg || a.rnd - b.rnd);

    return withDegree.map((w) => w.pos);
  }

  // Track backtrack count to enforce a budget
  let backtracks = 0;
  const MAX_BACKTRACKS = 50_000;

  function dfs(r: number, c: number): boolean {
    visited[r][c] = true;
    path.push([r, c]);

    if (path.length === totalCells) return true;

    const neighbors = getSortedNeighbors(r, c);
    for (const [nr, nc] of neighbors) {
      if (dfs(nr, nc)) return true;
      backtracks++;
      if (backtracks > MAX_BACKTRACKS) return false;
    }

    // Backtrack
    visited[r][c] = false;
    path.pop();
    return false;
  }

  if (dfs(startR, startC) && path.length === totalCells) {
    return path;
  }

  return null;
}

/** Fallback zigzag Hamiltonian path (guaranteed to work) */
function generateZigzagPath(
  rows: number,
  cols: number,
): [number, number][] {
  const path: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c++) path.push([r, c]);
    } else {
      for (let c = cols - 1; c >= 0; c--) path.push([r, c]);
    }
  }
  return path;
}

/** Fisher-Yates shuffle (in-place) */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a solvable snake/ZIP puzzle using a random Hamiltonian path
 * (Warnsdorff's algorithm) with derived edge-based walls.
 *
 * Algorithm:
 * 1. Generate a random Hamiltonian path (non-zigzag, weaving route).
 * 2. Place checkpoints along the path with decent spacing.
 * 3. Wall EVERY non-path edge, then REMOVE a fraction to add ambiguity.
 *    The fewer walls removed, the harder the puzzle (more constrained).
 * 4. Solvability is guaranteed — the original path always works since
 *    we only remove walls, never add new ones on path edges.
 *
 * Difficulty scaling (0→1):
 * - Grid: 5×5 (d=0) → 7×7 (d=1)
 * - Checkpoints: 5 (d=0) → 9 (d=1)
 * - Wall removal: 70% removed at d=0 (forgiving) → 20% at d=1 (constrained)
 */
function generatePuzzle(difficulty: number): GeneratedPuzzle {
  const size = Math.round(5 + difficulty * 2);
  const rows = size;
  const cols = size;
  const totalCells = rows * cols;

  // Step 1: Generate a random Hamiltonian path (fall back to zigzag if needed)
  const path: [number, number][] =
    generateRandomHamiltonianPath(rows, cols) ?? generateZigzagPath(rows, cols);

  // Step 2: Place checkpoints along the path with spacing
  const nodeCount = Math.round(5 + difficulty * 4);

  // Minimum spacing between checkpoints (in path steps)
  const minSpacing = Math.max(2, Math.floor(totalCells / (nodeCount + 1)));

  // The last path cell is always the highest checkpoint
  // For the remaining nodeCount - 1 checkpoints, distribute with spacing
  const chosenPathIndices: number[] = [];

  // Generate candidate positions with minimum spacing
  // Divide the path (excluding first cell and last cell) into zones
  const usableStart = 1; // skip index 0 (snake start, not a checkpoint)
  const usableEnd = totalCells - 2; // last cell reserved for final checkpoint

  if (nodeCount <= 1) {
    // Only the end checkpoint
    chosenPathIndices.push(totalCells - 1);
  } else {
    const innerCount = nodeCount - 1;
    // Try to space checkpoints evenly, then jitter
    const segmentLength = (usableEnd - usableStart + 1) / innerCount;

    for (let i = 0; i < innerCount; i++) {
      const idealPos = usableStart + Math.round(segmentLength * (i + 0.5));
      // Add jitter: ±25% of segment length
      const jitter = Math.round((Math.random() - 0.5) * segmentLength * 0.5);
      let pos = idealPos + jitter;
      // Clamp within usable range
      pos = Math.max(usableStart, Math.min(usableEnd, pos));
      chosenPathIndices.push(pos);
    }

    // Ensure minimum spacing — sort first, then enforce
    chosenPathIndices.sort((a, b) => a - b);
    for (let i = 1; i < chosenPathIndices.length; i++) {
      if (chosenPathIndices[i] - chosenPathIndices[i - 1] < minSpacing) {
        chosenPathIndices[i] = Math.min(
          usableEnd,
          chosenPathIndices[i - 1] + minSpacing,
        );
      }
    }

    // De-duplicate (in case clamping caused overlaps)
    const uniqueIndices = [...new Set(chosenPathIndices)];
    chosenPathIndices.length = 0;
    chosenPathIndices.push(...uniqueIndices);

    // Add the final checkpoint at end
    chosenPathIndices.push(totalCells - 1);
  }

  // Step 3: Derive walls from the path
  // Build set of consecutive path edges (these must NEVER have walls)
  const pathEdges = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    const [r1, c1] = path[i];
    const [r2, c2] = path[i + 1];
    pathEdges.add(wallKey(r1, c1, r2, c2));
  }

  // Enumerate ALL non-path edges and wall them all initially
  const nonPathEdges: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) {
        const key = wallKey(r, c, r, c + 1);
        if (!pathEdges.has(key)) nonPathEdges.push(key);
      }
      if (r < rows - 1) {
        const key = wallKey(r, c, r + 1, c);
        if (!pathEdges.has(key)) nonPathEdges.push(key);
      }
    }
  }

  // Start with ALL non-path edges walled
  const walls: WallSet = new Set<string>(nonPathEdges);

  // Remove walls based on difficulty.
  // INVERTED: more walls removed = more open grid = HARDER (no corridors guiding you)
  // d=0: remove 30% → 70% walls remain (corridors guide you, easy)
  // d=0.5: remove 60% → 40% remain (some guidance, moderate)
  // d=1: remove 90% → 10% walls remain (wide open, must figure out path yourself)
  const removalRate = 0.30 + difficulty * 0.60;
  const wallList = shuffleArray([...nonPathEdges]);
  const removeCount = Math.round(wallList.length * removalRate);

  for (let i = 0; i < removeCount; i++) {
    walls.delete(wallList[i]);
  }

  // Step 4: Build grid
  const grid: GridNode[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      pathIndex: -1,
      label: null,
    })),
  );

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

  return { rows, cols, grid, path, checkpoints, nodeCount: chosenPathIndices.length, walls };
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
 * Walls are edges BETWEEN cells (ZIP style) — they block movement
 * between two adjacent cells but don't remove cells from the grid.
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

  const { rows, cols, grid, nodeCount, walls } = puzzle;
  const totalCells = rows * cols; // All cells must be filled (no cell-based walls)

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

      // Edge-wall check: cannot cross a wall between current cell and target cell
      if (hasWall(walls, head[0], head[1], nr, nc)) return;

      // Collision check: cannot move into a cell already occupied by the snake
      const targetKey = `${nr},${nc}`;
      const currentOccupied = new Set<string>();
      for (const [sr, sc] of currentSnake) {
        currentOccupied.add(`${sr},${sc}`);
      }
      if (currentOccupied.has(targetKey)) return;

      // Valid move — extend the snake
      const newSnake = [...currentSnake, [nr, nc] as [number, number]];

      // Check for checkpoint collection
      const newVisited = checkAndCollectNode(nr, nc, visitedNodesRef.current);

      setSnake(newSnake);
      setLastDir(dir);
      setVisitedNodes(newVisited);
    },
    [isActive, rows, cols, grid, walls, checkAndCollectNode],
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

  // Wall border thickness
  const wallBorder = "3px solid var(--color-cyber-magenta)";

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

              // Compute edge-wall borders for this cell
              const cw = getCellWalls(r, c, rows, cols, walls);

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
                    borderTop: cw.top ? wallBorder : undefined,
                    borderRight: cw.right ? wallBorder : undefined,
                    borderBottom: cw.bottom ? wallBorder : undefined,
                    borderLeft: cw.left ? wallBorder : undefined,
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
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm border-2 border-cyber-magenta/60" />
            <span className="text-cyber-magenta/60">Wall</span>
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
