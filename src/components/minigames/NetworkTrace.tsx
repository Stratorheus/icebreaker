import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";
import { TouchControls } from "@/components/layout/TouchControls";
import { generateMaze } from "@/lib/maze-generator";

// ── Component ─────────────────────────────────────────────────────────

/**
 * NetworkTrace — maze navigation minigame.
 *
 * Navigate from the entry point (START) to the target server (END)
 * using arrow keys. Walls block movement. Win by reaching END.
 * Fail only by timeout.
 *
 * Difficulty scaling (0–1):
 * - Cell size: 5×5 (d=0) → 11×11 (d=1) via `Math.round(5 + difficulty * 6)`
 * - Grid size: (2*cells+1) × (2*cells+1)
 */
/** BFS to find shortest path through maze grid. Returns set of "r,c" keys. */
function solveMaze(grid: boolean[][], start: [number, number], end: [number, number]): Set<string> {
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (r: number, c: number) => `${r},${c}`;
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: [number, number][] = [start];
  visited.add(key(start[0], start[1]));
  parent.set(key(start[0], start[1]), null);

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    if (r === end[0] && c === end[1]) break;
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (grid[nr][nc]) continue; // wall
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      visited.add(k);
      parent.set(k, key(r, c));
      queue.push([nr, nc]);
    }
  }

  // Trace back from end
  const path = new Set<string>();
  let cur: string | null | undefined = key(end[0], end[1]);
  while (cur != null) {
    path.add(cur);
    cur = parent.get(cur);
  }
  return path;
}

export function NetworkTrace(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, isActive } = useMinigame("network-trace", props);

  const resolvedRef = useRef(false);

  // Path Highlight module: briefly flash correct path
  const hasPathHighlight = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "network-trace",
    );
  }, [activePowerUps]);

  // Generate maze on mount (stable across re-renders)
  const maze = useMemo(() => {
    const cellSize = Math.round(5 + difficulty * 6);
    return generateMaze(cellSize, cellSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { grid, start, end } = maze;
  const gridRows = grid.length;
  const gridCols = grid[0].length;

  // Solve the maze (for path highlight)
  const solutionPath = useMemo(() => {
    if (!hasPathHighlight) return new Set<string>();
    return solveMaze(grid, start, end);
  }, [hasPathHighlight, grid, start, end]);

  // Flash the path for 1s on mount
  const [showPathHighlight, setShowPathHighlight] = useState(hasPathHighlight);
  useEffect(() => {
    if (!hasPathHighlight) return;
    const timeout = setTimeout(() => setShowPathHighlight(false), 1000);
    return () => clearTimeout(timeout);
  }, [hasPathHighlight]);

  // ── Player position ────────────────────────────────────────────────
  const [playerRow, setPlayerRow] = useState(start[0]);
  const [playerCol, setPlayerCol] = useState(start[1]);
  const playerRowRef = useRef(start[0]);
  const playerColRef = useRef(start[1]);

  useEffect(() => {
    playerRowRef.current = playerRow;
  }, [playerRow]);
  useEffect(() => {
    playerColRef.current = playerCol;
  }, [playerCol]);

  // ── Win check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (resolvedRef.current) return;
    if (playerRow === end[0] && playerCol === end[1]) {
      resolvedRef.current = true;
      complete(true);
    }
  }, [playerRow, playerCol, end, complete]);

  // ── Movement ───────────────────────────────────────────────────────
  const tryMove = useCallback(
    (dr: number, dc: number) => {
      if (!isActive || resolvedRef.current) return;

      const cr = playerRowRef.current;
      const cc = playerColRef.current;
      const nr = cr + dr;
      const nc = cc + dc;

      // Bounds check
      if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) return;

      // Wall check — cannot move into a wall cell
      if (grid[nr][nc]) return;

      setPlayerRow(nr);
      setPlayerCol(nc);
    },
    [isActive, grid, gridRows, gridCols],
  );

  // ── Keyboard navigation ────────────────────────────────────────────
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};

    map["ArrowUp"] = () => tryMove(-1, 0);
    map["ArrowDown"] = () => tryMove(1, 0);
    map["ArrowLeft"] = () => tryMove(0, -1);
    map["ArrowRight"] = () => tryMove(0, 1);

    return map;
  }, [tryMove]);

  useKeyboard(keyMap);

  // ── Dynamic cell sizing to fit on screen ───────────────────────────
  // Target: maze should fit in roughly 70vh x 70vw with some padding
  // We compute pixel size per cell based on grid dimensions
  const cellPx = gridCols <= 11 ? 28 : gridCols <= 17 ? 18 : 13;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-4" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full">
        {/* Header */}
        <div className="text-center">
          <p className="text-cyber-cyan text-xs uppercase tracking-[0.3em] font-mono font-bold mb-1 animate-pulse">
            Tracing network path...
          </p>
          <p className="text-white/50 text-xs uppercase tracking-widest">
            Entry point → Target server
          </p>
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/10" />

        {/* Maze grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, ${cellPx}px)`,
            gridTemplateRows: `repeat(${gridRows}, ${cellPx}px)`,
            gap: 0,
          }}
        >
          {grid.map((row, r) =>
            row.map((isWall, c) => {
              const isPlayer = r === playerRow && c === playerCol;
              const isStart = r === start[0] && c === start[1];
              const isEnd = r === end[0] && c === end[1];

              let cellClass = "";
              let content: React.ReactNode = null;

              if (isWall) {
                // Wall cell
                cellClass = "bg-slate-900 border-slate-800/50";
              } else if (isPlayer) {
                // Player cursor
                cellClass =
                  "bg-cyber-cyan/40 border-cyber-cyan/80 shadow-[0_0_8px_rgba(0,255,255,0.5)]";
                content = (
                  <span className="text-cyber-cyan font-bold" style={{ fontSize: cellPx * 0.6 }}>
                    ◆
                  </span>
                );
              } else if (isEnd) {
                // Target server
                cellClass =
                  "bg-cyber-magenta/20 border-cyber-magenta/60 animate-pulse";
                content = (
                  <span className="text-cyber-magenta font-bold" style={{ fontSize: cellPx * 0.5 }}>
                    ◎
                  </span>
                );
              } else if (isStart) {
                // Entry point (already passed through)
                cellClass = "bg-cyber-green/10 border-cyber-green/30";
              } else if (showPathHighlight && solutionPath.has(`${r},${c}`)) {
                // Path highlight flash
                cellClass = "bg-cyber-green/20 border-cyber-green/40";
              } else {
                // Path cell
                cellClass = "bg-white/[0.04] border-white/[0.04]";
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex items-center justify-center border ${cellClass}`}
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
        <div className="flex items-center gap-6 text-xs uppercase tracking-widest font-mono">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-cyber-green/30 border border-cyber-green/50" />
            <span className="text-cyber-green/70">Entry</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-cyber-magenta/30 border border-cyber-magenta/50" />
            <span className="text-cyber-magenta/70">Target</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-cyber-cyan/30 border border-cyber-cyan/50" />
            <span className="text-cyber-cyan/70">You</span>
          </span>
        </div>
      </div>

      {/* Instructions — desktop */}
      <div className="desktop-only mt-4 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Arrow keys to navigate
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
        </div>
      </div>

      {/* Touch: D-pad + instruction */}
      <div className="touch-only mt-2 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Use the D-pad to navigate
        </p>
      </div>
      <TouchControls type="dpad" />
    </div>
  );
}
