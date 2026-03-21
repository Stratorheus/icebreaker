# Defrag (`defrag`)

## Player Guide
A grid of hidden cells conceals mines. Click or use arrow keys + Space to uncover cells. Numbers on revealed cells indicate how many adjacent cells contain mines. Cells with 0 adjacent mines cascade open automatically (flood fill). Your goal is to uncover every safe cell without hitting a mine. Right-click or Enter to flag suspected mines. The first click is always safe and triggers a cascade. At higher difficulty the grid is larger and contains more mines, and you have less time.

## Mechanic

### Board Generation
`generateBoard(difficulty)` creates an NxN grid where N = `Math.round(5 + difficulty * 4)`. Cells are initialized without mines. The mine count is `Math.min(Math.round(2 + difficulty * 8), Math.floor(totalCells * 0.20))`, capping at 20% of total cells.

### First-Click Safety
Mines are NOT placed until the player's first click. `placeMines()` is called on first click with the clicked cell index as the "safe index". The clicked cell and all its neighbors (up to 8 cells) form a protected zone where no mines can be placed. This guarantees the first click always opens a cascade (the clicked cell has 0 adjacent mines since all its neighbors are also mine-free).

### Mine Placement
Candidates (all cells not in the protected zone) are shuffled via Fisher-Yates, then the first `mineCount` are selected. After placement, adjacency counts are recomputed for every non-mine cell by counting mine neighbors.

### Flood Fill (BFS)
When a cell with 0 adjacent mines is uncovered, `floodFill()` runs a BFS: it reveals the cell, then for each 0-adjacency cell, adds all hidden neighbors to the queue. Flagged cells are skipped. The function returns the count of newly revealed cells.

### Win Condition
A `useEffect` watches `revealedCount` against `safeCellCount` (total cells minus mine count). When `revealedCount >= safeCellCount`, `complete(true)` fires.

### Fail Condition
Uncovering a mine cell sets `showMines = true` (briefly reveals all mines with a magenta flash) and calls `fail()` after 600ms.

### Flagging
`toggleFlag(cellIndex)` toggles a hidden cell between `"hidden"` and `"flagged"`. Flagged cells cannot be uncovered (clicking them does nothing). Revealed cells cannot be flagged. Flags are cosmetic and informational -- they do not affect win/lose logic.

## Difficulty Scaling

| Parameter | Formula | d=0 | d=0.5 | d=1 |
|---|---|---|---|---|
| Grid size (NxN) | `Math.round(5 + difficulty * 4)` | 5x5 (25 cells) | 7x7 (49 cells) | 9x9 (81 cells) |
| Raw mine count | `Math.round(2 + difficulty * 8)` | 2 | 6 | 10 |
| Mine cap | `Math.floor(totalCells * 0.20)` | 5 | 9 | 16 |
| Actual mines | `min(raw, cap)` | 2 | 6 | 10 |
| Safe cells | `totalCells - mineCount` | 23 | 43 | 71 |
| Mine density | mines / totalCells | 8% | 12.2% | 12.3% |

The 20% mine cap prevents degenerate boards at any difficulty. At d=1, raw mines (10) is well below the cap (16), so the cap only matters if the formula were changed.

## Power-Up Support

| Name | ID | Effect Type | What It Does | Code Location |
|---|---|---|---|---|
| (defrag-safe-start removed) | `defrag-safe-start` | `minigame-specific` | Was: guaranteed safe first click. Now: this is built-in default behavior. The meta upgrade entry is registered in `buildMetaPowerUps` but the upgrade itself was removed from `META_UPGRADE_POOL`. | `MinigameScreen.tsx` line 389-391 (still referenced but no-op) |
| Time bonuses (run-shop) | various | `time-bonus` | Adds seconds to timer | `MinigameScreen.tsx` line 443 |
| Delay Injector (meta) | `delay-injector` | `global-time-bonus` | Multiplies time by `1.03^tier` | `MinigameScreen.tsx` line 444 |
| Difficulty Reducer (meta) | `difficulty-reducer` | `difficulty-reduction` | Reduces effective difficulty, resulting in smaller grid and fewer mines | `MinigameScreen.tsx` line 438-439 |

Note: Defrag currently has **no active game-specific power-ups**. The `defrag-safe-start` upgrade was removed because safe first click became the default behavior. There are no run-shop items that specifically target defrag.

## Controls
### Desktop
- `Arrow keys` (Up/Down/Left/Right) -- move the cursor across the grid
- `Space` -- uncover the cell under the cursor
- `Enter` -- toggle flag on the cell under the cursor
- `Left-click` -- uncover a cell
- `Right-click` -- toggle flag on a cell (context menu is prevented)

### Mobile
- `Tap` a cell -- uncover it (in default mode) or flag it (in flag mode)
- `MODE` toggle button -- switches between Uncover and Flag mode
- `D-pad` via `<TouchControls type="dpad" />` -- arrow key navigation

## Base Time Limit
**40 seconds** (`BASE_TIME_LIMITS["defrag"] = 40`).

This is the longest base time of any minigame, reflecting the strategic depth of minesweeper. At d=0: full 40s. At d=1: `40 * 0.6 = 24s`. After floor 15, additional 2%-per-floor decay applies.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference
- Component: `src/components/minigames/Defrag.tsx`
- `generateBoard(difficulty)` -- lines 73-88: creates grid shell with size and mine count
- `placeMines(cells, cols, rows, mineCount, safeIndex)` -- lines 94-128: places mines avoiding the safe zone, recomputes adjacency
- `getNeighbors(index, cols, rows)` -- lines 42-63: returns array of valid neighbor indices (8-directional)
- `floodFill(startIndex, states)` -- lines 199-230: BFS cascade for 0-adjacency cells
- `uncoverCell(cellIndex)` -- lines 233-273: main interaction handler; triggers mine placement on first click, flood fill, mine-hit detection
- `toggleFlag(cellIndex)` -- lines 276-290: flag toggling logic
- Win check `useEffect` -- lines 293-299: compares revealedCount to safeCellCount
- Keyboard navigation `keyMap` -- lines 302-331: arrow keys, Space, Enter
- State variables:
  - `board` -- `{ cells, cols, rows, mineCount }`, generated on mount
  - `cellStates: CellState[]` -- `"hidden" | "revealed" | "flagged"` per cell
  - `revealedCount` / `revealedCountRef` -- count of revealed safe cells
  - `cursorRow`, `cursorCol` -- keyboard navigation position
  - `flagMode` -- boolean, touch-only mode toggle
  - `showMines` -- boolean, true during the fail reveal animation
  - `firstClickRef` / `minesPlacedRef` -- track whether mines have been placed

## Tuning Guide
- **Grid size**: Change `Math.round(5 + difficulty * 4)` in `generateBoard()` at line 74. The `4` controls how much the grid grows.
- **Mine count**: Change `Math.round(2 + difficulty * 8)` at line 79. The `8` controls mine scaling.
- **Mine density cap**: Change `0.20` at line 80. Higher values allow denser boards.
- **Protected zone size**: Currently protects the clicked cell + all neighbors (up to 9 cells total). To change, modify the `protectedSet` construction in `placeMines()` at line 103.
- **Fail reveal duration**: Change the 600ms timeout in `uncoverCell()` at line 253. Controls how long mines are shown before fail triggers.
- **Cell size classes**: Modify `cellSizeClass` at lines 339-344 for different visual sizing at different grid dimensions.
- **Base time**: Change `"defrag": 40` in `BASE_TIME_LIMITS` at `src/components/screens/MinigameScreen.tsx` line 281.
- **Number colors**: Change `NUMBER_COLORS` at lines 29-38 to adjust the color coding for adjacency numbers.
- **Add game-specific power-up**: Create a new entry in `src/data/meta-upgrades.ts` targeting `minigame: "defrag"` and add detection logic in the component. Potential ideas: reveal one mine location, larger protected zone, or an "undo last click" ability.
