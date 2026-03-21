# Memory Scan (`mine-sweep`)

## Player Guide

The game has two phases. In the **preview phase**, a grid is shown with "corrupted sectors" (mines) highlighted in magenta. A sub-timer counts down the preview duration. When it expires, the **mark phase** begins: all mines are hidden, and the player must mark the cells where they remember mines were. Marking a safe cell causes immediate failure. When the player has marked exactly as many cells as there are mines (all correct), the game auto-completes successfully. The overall timer runs throughout both phases.

## Mechanic

1. **Grid generation** (`generateGrid`):
   - Grid dimensions: `size = round(3 + difficulty * 3)` giving `size x size` cells. 3x3 at d=0, 6x6 at d=1.
   - Mine count: `rawMines = round(3 + difficulty * 7)`, capped at 40% of total cells. So 3 mines at d=0, up to 10 at d=1 (but capped at e.g. `floor(36 * 0.4) = 14`).
   - Preview duration: `previewMs = (3 - difficulty * 2) * 1000`. So 3000ms at d=0, 1000ms at d=1.
   - Mine positions are unique random indices.

2. **Preview phase**:
   - Mines are shown with a magenta border, background, and pentagon icon.
   - A sub-timer bar (magenta) counts down `previewMs`.
   - Cells are disabled (not clickable) during preview.
   - When the sub-timer reaches 0, phase transitions to `"mark"`.

3. **Mark phase**:
   - Mines are hidden. The player clicks/taps cells to toggle marks.
   - **Wrong mark** (cell is not a mine): immediate `fail()`.
   - **Correct mark**: cell is flagged with a cyan flag icon.
   - **Un-marking**: allowed for any cell the player marked, unless it was auto-flagged by the Sector Scanner power-up.
   - The player cannot mark more cells than `mineCount`.
   - **Auto-complete**: when `markedCells.size === mineCount`, all marks are guaranteed correct (wrong marks fail instantly), so `complete(true)` is called.

4. **Scoring**: Binary pass/fail. Speed affects credit bonuses via the global timer.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1 | Formula |
|-----------|-----|-------|-----|---------|
| Grid size | 3x3 (9 cells) | 5x5 (25 cells) | 6x6 (36 cells) | `round(3 + d * 3)` squared |
| Mine count | 3 | 7 | 10 (capped) | `min(round(3 + d * 7), floor(totalCells * 0.4))` |
| Preview duration | 3000ms | 2000ms | 1000ms | `(3 - d * 2) * 1000` |

## Power-Up Support

| Power-Up | Source | Effect Type | Behavior |
|----------|--------|-------------|----------|
| **Sector Scanner** | Run shop (`mine-detector`) | `flag-mine` | Pre-flags 1 random mine at the start of the mark phase. The flagged cell cannot be un-marked. Multiple instances stack (though the pool only has 1). |
| **Memory Echo** (T1/T2/T3) | Meta upgrade (`mine-echo`) | `minigame-specific` + `mine-sweep` | 20%/35%/50% of mines remain faintly visible (dimmed magenta pentagon) during the mark phase. These are chosen from mines not already auto-flagged. `visCount = max(1, round(mineCount * pct))`. |
| **Time bonuses** | Run shop (various) | `time-bonus` | Adds seconds to the overall timer for this floor. |

## Controls

### Desktop
- **Arrow keys** (`Up`/`Down`/`Left`/`Right`): Move the keyboard cursor across the grid (only active during mark phase).
- **Enter** or **Space**: Toggle mark on the cell under the cursor.
- **Mouse click**: Directly toggle mark on any cell.

### Mobile
- **Tap**: Tap any cell to toggle its mark.

## Base Time Limit

**15 seconds** (before scaling).

Effective time: `round(15 * (1 - difficulty * 0.4) * floorScale) + bonusTimeSecs`, then multiplied by `1.03^timerExtTier`.

- At d=0: `round(15 * 1.0) = 15s` base.
- At d=1: `round(15 * 0.6) = 9s` base.

Note: The preview phase consumes time from the overall timer, so the actual mark phase has `effectiveTime - previewMs/1000` seconds of active play.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

- **Component**: `src/components/minigames/MineSweep.tsx`
- **Key functions**:
  - `generateGrid(difficulty)` -- creates the grid, mines, and preview duration
  - `toggleMark(cellIndex)` -- handles marking/un-marking cells with validation
- **State variables**:
  - `phase: "preview" | "mark"` -- current game phase
  - `previewLeft: number` -- remaining preview time in ms (drives sub-timer bar)
  - `markedCells: Set<number>` -- indices of cells the player has marked
  - `cursorRow`, `cursorCol` -- keyboard cursor position (mark phase only)
  - `grid` (memoized) -- contains `cells`, `cols`, `rows`, `mineCount`, `previewMs`
- **Pre-computed sets**:
  - `autoFlaggedMines: Set<number>` -- mine indices pre-flagged by Sector Scanner
  - `visibleMines: Set<number>` -- mine indices kept visible by Memory Echo
- **Phase transition**: driven by `requestAnimationFrame` loop that counts down from `previewMs`

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Grid size range | `generateGrid`, `const size = Math.round(3 + difficulty * 3)` | Change `3` (min) or `3` (scale) |
| Mine count range | `generateGrid`, `const rawMines = Math.round(3 + difficulty * 7)` | Change `3` (min) or `7` (scale) |
| Mine cap percentage | `generateGrid`, `Math.floor(totalCells * 0.4)` | Raise/lower 0.4 to adjust max mine density |
| Preview duration range | `generateGrid`, `(3 - difficulty * 2) * 1000` | Change `3` (max seconds) or `2` (reduction scale) |
| Auto-flag count | `power-ups.ts`, Sector Scanner `value: 1` | Increase to flag more mines automatically |
| Memory Echo percentages | `meta-upgrades.ts`, `mine-echo` effects | Currently `[0.20, 0.35, 0.50]` |
| Base time limit | `MinigameScreen.tsx`, `BASE_TIME_LIMITS["mine-sweep"]` | Currently `15` |
