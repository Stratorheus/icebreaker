# Network Trace (`network-trace`)

## Player Guide

A maze is displayed as a grid of cells with neon cyan wall edges. The player controls a diamond marker (cyan) starting at the top-left corner and must navigate to a pulsing target (magenta circle) at the bottom-right corner. Movement is restricted by walls -- the player can only move through open passages. There is no fail condition other than the timer running out. Reaching the target cell completes the minigame. At higher difficulties the maze is significantly larger and more complex.

## Mechanic

1. **Maze generation** (`generateMaze` in `maze-generator.ts`):
   - Uses **recursive backtracking** (iterative stack variant) to produce a **perfect maze** (exactly one path between any two cells, no loops).
   - Grid dimensions: `cellSize = round(5 + difficulty * 6)`, giving a `cellSize x cellSize` maze. 5x5 at d=0, 11x11 at d=1.
   - All cells start with all four walls (`north`, `south`, `east`, `west` = `true`).
   - The algorithm starts at `[0,0]`, marks cells visited, and carves passages by removing walls between adjacent cells. When no unvisited neighbor exists, it backtracks via the stack.
   - Start: `[0, 0]` (top-left). End: `[rows-1, cols-1]` (bottom-right).

2. **Movement logic** (`tryMove`):
   - The player presses an arrow key or D-pad direction.
   - The code checks the current cell's wall in the movement direction. If the wall is `true`, movement is blocked.
   - If the wall is `false` and the target cell is within bounds, the player position updates.

3. **Win condition**: When `playerRow === end[0] && playerCol === end[1]`, `complete(true)` is called. There is no explicit fail action -- the only way to lose is timeout.

4. **Path highlight** (power-up): If active, the solution path (computed via BFS) is highlighted with a green background for 1 second at the start of the game.

5. **BFS solver** (`solveMaze`):
   - Standard BFS from `start` to `end`, respecting wall edges.
   - Returns a `Set<string>` of `"r,c"` keys forming the shortest path.
   - Only computed if the Path Highlight power-up is active.

6. **Visual sizing**: Cell pixel size adapts to maze dimensions:
   - `cols <= 5`: 40px
   - `cols <= 7`: 32px
   - `cols <= 9`: 24px
   - `cols > 9`: 18px
   - Wall border width: 2px for `cols <= 7`, 1px otherwise.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1 | Formula |
|-----------|-----|-------|-----|---------|
| Maze dimensions | 5x5 (25 cells) | 8x8 (64 cells) | 11x11 (121 cells) | `round(5 + d * 6)` squared |
| Cell pixel size | 40px | 24px | 18px | Step function based on `cols` |
| Wall width | 2px | 2px | 1px | `cols <= 7 ? 2 : 1` |

Note: The maze algorithm always produces a perfect maze regardless of size, so the structural complexity scales naturally with dimensions.

## Power-Up Support

| Power-Up | Source | Effect Type | Behavior |
|----------|--------|-------------|----------|
| **Path Highlight** | Meta upgrade (`network-trace-highlight`) | `minigame-specific` + `network-trace` | At game start, the BFS-solved shortest path is highlighted with a green background for 1 second, then fades. |
| **Time bonuses** | Run shop (various) | `time-bonus` | Adds seconds to the timer for this floor. |

## Controls

### Desktop
- **Arrow keys** (`Up`/`Down`/`Left`/`Right`): Move the player one cell in the given direction (if no wall blocks).

### Mobile
- **D-pad** (`TouchControls type="dpad"`): Tap the matching direction on the on-screen directional pad.

## Base Time Limit

**20 seconds** (before scaling).

Effective time: `round(20 * (1 - difficulty * 0.4) * floorScale) + bonusTimeSecs`, then multiplied by `1.03^timerExtTier`.

- At d=0: `round(20 * 1.0) = 20s` base.
- At d=1: `round(20 * 0.6) = 12s` base.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

- **Component**: `src/components/minigames/NetworkTrace.tsx`
- **Maze generator**: `src/lib/maze-generator.ts`
- **Key functions**:
  - `generateMaze(rows, cols)` -- recursive backtracking maze generation, returns `MazeData`
  - `solveMaze(maze)` -- BFS shortest-path solver, returns `Set<string>` of path cells
  - `tryMove(dr, dc)` -- validates movement against walls and bounds
- **State variables**:
  - `playerRow`, `playerCol` / refs -- current player position in the maze
  - `maze` (memoized) -- the generated `MazeData` with `cells`, `rows`, `cols`, `start`, `end`
  - `solutionPath: Set<string>` -- BFS solution (empty if no Path Highlight)
  - `showPathHighlight: boolean` -- true for the first 1000ms if power-up is active
- **Types** (from `maze-generator.ts`):
  - `CellWalls { north, south, east, west: boolean }`
  - `MazeData { cells: CellWalls[][], rows, cols, start: [r,c], end: [r,c] }`

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Maze size range | `NetworkTrace.tsx`, `const cellSize = Math.round(5 + difficulty * 6)` | Change `5` (min) or `6` (scale). Large mazes (>11) may overflow small screens. |
| Cell pixel sizes | `NetworkTrace.tsx`, step function at line 167 | Adjust thresholds and pixel values for different screen targets |
| Path highlight duration | `NetworkTrace.tsx`, `setTimeout(..., 1000)` | Change `1000` ms to show the path longer/shorter |
| Maze algorithm | `maze-generator.ts` | Replace recursive backtracking with a different algorithm (Prim's, Kruskal's, etc.) for different maze characteristics |
| Start/End positions | `maze-generator.ts`, return value `start: [0,0], end: [rows-1, cols-1]` | Randomize for variety |
| Base time limit | `MinigameScreen.tsx`, `BASE_TIME_LIMITS["network-trace"]` | Currently `20` |
