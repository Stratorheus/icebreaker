import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";
import { TouchControls } from "@/components/layout/TouchControls";
import { ArrowKeyHints } from "@/components/layout/ArrowKeyHints";
import { generateMaze } from "@/lib/maze-generator";
import type { MazeData } from "@/lib/maze-generator";

// ── BFS solver ────────────────────────────────────────────────────────

/** BFS to find shortest path through edge-based maze. Returns set of "r,c" keys. */
function solveMaze(maze: MazeData): Set<string> {
  const { cells, rows, cols, start, end } = maze;
  const key = (r: number, c: number) => `${r},${c}`;
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: [number, number][] = [start];
  visited.add(key(start[0], start[1]));
  parent.set(key(start[0], start[1]), null);

  const dirs: { dr: number; dc: number; wall: "north" | "south" | "east" | "west" }[] = [
    { dr: -1, dc: 0, wall: "north" },
    { dr: 1, dc: 0, wall: "south" },
    { dr: 0, dc: -1, wall: "west" },
    { dr: 0, dc: 1, wall: "east" },
  ];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    if (r === end[0] && c === end[1]) break;

    for (const { dr, dc, wall } of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      // Check if wall blocks this direction
      if (cells[r][c][wall]) continue;
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

// ── Component ─────────────────────────────────────────────────────────

/**
 * NetworkTrace — maze navigation minigame with edge-based walls.
 *
 * Navigate from the entry point (START) to the target server (END).
 * Walls are rendered as CSS borders on cells — thin neon lines.
 *
 * Difficulty scaling (0–1):
 * - Cell size: 5×5 (d=0) → 11×11 (d=1)
 */
export function NetworkTrace(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, isActive } = useMinigame("network-trace", props);

  const resolvedRef = useRef(false);

  // Path Highlight module: show correct path for a fraction of the timer (tier value 0.25-1.0)
  const pathHighlightFraction = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "network-trace",
    );
    return pu ? pu.effect.value : 0;
  }, [activePowerUps]);

  // Generate maze on mount
  const maze = useMemo(() => {
    const cellSize = Math.round(5 + difficulty * 6);
    return generateMaze(cellSize, cellSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { cells, rows, cols, start, end } = maze;

  // Solve the maze (for path highlight)
  const solutionPath = useMemo(() => {
    if (pathHighlightFraction <= 0) return new Set<string>();
    return solveMaze(maze);
  }, [pathHighlightFraction, maze]);

  // Show path while timer.progress > (1 - fraction).
  // E.g. tier 1 (0.25): visible while progress > 0.75 (first 25% of time).
  // Tier 4 (1.0): visible always (progress > 0).
  const showPathHighlight = pathHighlightFraction > 0 && timer.progress > (1 - pathHighlightFraction);

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
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;

      // Wall check — check the edge in the direction of movement
      const cell = cells[cr][cc];
      if (dr === -1 && cell.north) return;
      if (dr === 1 && cell.south) return;
      if (dc === -1 && cell.west) return;
      if (dc === 1 && cell.east) return;

      setPlayerRow(nr);
      setPlayerCol(nc);
    },
    [isActive, cells, rows, cols],
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

  // ── Dynamic cell sizing ────────────────────────────────────────────
  const cellPx = cols <= 5 ? 40 : cols <= 7 ? 32 : cols <= 9 ? 24 : 18;
  const wallWidth = cols <= 7 ? 2 : 1;

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

        {/* Maze grid — edge-based walls via CSS borders */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
            gap: 0,
          }}
        >
          {cells.map((row, r) =>
            row.map((cell, c) => {
              const isPlayer = r === playerRow && c === playerCol;
              const isStart = r === start[0] && c === start[1];
              const isEnd = r === end[0] && c === end[1];
              const isOnPath = showPathHighlight && solutionPath.has(`${r},${c}`);

              // Wall colors — neon cyan for walls
              const wallColor = "rgba(0, 255, 255, 0.35)";
              const wallColorBright = "rgba(0, 255, 255, 0.6)";

              // Build border styles for each edge
              const borderTop = cell.north
                ? `${wallWidth}px solid ${wallColorBright}`
                : `${wallWidth}px solid transparent`;
              const borderBottom = cell.south
                ? `${wallWidth}px solid ${wallColor}`
                : `${wallWidth}px solid transparent`;
              const borderLeft = cell.west
                ? `${wallWidth}px solid ${wallColorBright}`
                : `${wallWidth}px solid transparent`;
              const borderRight = cell.east
                ? `${wallWidth}px solid ${wallColor}`
                : `${wallWidth}px solid transparent`;

              // Cell background
              let bgClass = "bg-transparent";
              let content: React.ReactNode = null;

              if (isPlayer) {
                bgClass = "bg-cyber-cyan/25";
                content = (
                  <span
                    data-testid="player"
                    data-row={r}
                    data-col={c}
                    className="text-cyber-cyan font-bold drop-shadow-[0_0_6px_rgba(0,255,255,0.8)]"
                    style={{ fontSize: cellPx * 0.5 }}
                  >
                    ◆
                  </span>
                );
              } else if (isEnd) {
                bgClass = "bg-cyber-magenta/15 animate-pulse";
                content = (
                  <span
                    data-testid="end"
                    data-row={r}
                    data-col={c}
                    className="text-cyber-magenta font-bold drop-shadow-[0_0_6px_rgba(255,0,102,0.6)]"
                    style={{ fontSize: cellPx * 0.4 }}
                  >
                    ◎
                  </span>
                );
              } else if (isStart && !(r === playerRow && c === playerCol)) {
                bgClass = "bg-cyber-green/8";
              } else if (isOnPath) {
                bgClass = "bg-cyber-green/15";
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex items-center justify-center ${bgClass}`}
                  style={{
                    width: cellPx,
                    height: cellPx,
                    borderTop,
                    borderBottom,
                    borderLeft,
                    borderRight,
                    boxSizing: "border-box",
                  }}
                >
                  {content}
                </div>
              );
            }),
          )}
        </div>

        {/* Hidden test helper: maze wall data for E2E pathfinding */}
        <span
          data-testid="maze-data"
          data-rows={rows}
          data-cols={cols}
          data-start={JSON.stringify(start)}
          data-end={JSON.stringify(end)}
          data-walls={JSON.stringify(cells.map(row => row.map(cell => ({
            n: cell.north ? 1 : 0,
            s: cell.south ? 1 : 0,
            e: cell.east ? 1 : 0,
            w: cell.west ? 1 : 0,
          }))))}
          className="hidden"
        />

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
        <ArrowKeyHints />
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
