# Address Lookup (`find-symbol`)

## Player Guide

A grid of two-character hex codes is displayed alongside a target sequence at the top of the screen. The player must locate and select each target code in the grid, in the order shown. Only one target is active at a time -- it pulses with a cyan glow. Clicking or selecting a wrong cell causes immediate failure. Finding all targets in sequence completes the minigame successfully. A progress counter (`n/total`) tracks how many targets have been matched.

## Mechanic

1. **Puzzle generation** (`generatePuzzle`):
   - Grid dimensions: `cols = rows = round(3 + difficulty * 3)`. This gives a 3x3 grid at d=0 and a 6x6 grid at d=1.
   - Sequence length: `seqLen = round(2 + difficulty * 3)`. This means 2 targets at d=0 and 5 targets at d=1.
   - Unique target hex codes (e.g. `"A1"`, `"FE"`) are generated from the `0-9A-F` alphabet.
   - Each target is placed once in the grid. Remaining cells are filled with random hex codes.
   - At difficulty > 0.4, a proportion (`difficulty * 0.6`) of filler cells are generated as "similar" codes -- codes that differ from a random target by exactly one character. This makes visual scanning harder.
   - The grid is shuffled (Fisher-Yates) before display.

2. **Selection logic**:
   - The player selects cells one at a time. The current target index advances on correct match.
   - A correct match marks the cell with a green checkmark and moves to the next target in the sequence.
   - An incorrect match triggers immediate failure via `fail()`.
   - When `targetIndex >= targets.length`, the game calls `complete(true)`.

3. **Scoring**: Binary pass/fail. No partial credit. Speed bonus comes from the global timer system.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1 | Formula |
|-----------|-----|-------|-----|---------|
| Grid size | 3x3 (9 cells) | 5x5 (25 cells) | 6x6 (36 cells) | `round(3 + d * 3)` squared |
| Sequence length | 2 targets | 4 targets | 5 targets | `round(2 + d * 3)` |
| Similar distractors | None | ~30% of fillers | ~60% of fillers | Active when `d > 0.4`; probability = `d * 0.6` |

## Power-Up Support

| Power-Up | Source | Effect Type | Behavior |
|----------|--------|-------------|----------|
| **Symbol Scanner** | Meta upgrade (`symbol-scanner`) | `hint` + `find-symbol` | The current target hex code is subtly highlighted (lighter text/border) in the grid, making it easier to spot. |
| **Hint Module** | Run shop (`hint-module`) | `hint` | Shows a contextual hint during the countdown phase. |
| **Time bonuses** | Run shop (various) | `time-bonus` | Adds seconds to the timer for this floor. |

## Controls

### Desktop
- **Arrow keys** (`Up`/`Down`/`Left`/`Right`): Move the keyboard cursor across the grid. The cursor cell is highlighted with a cyan border and glow.
- **Enter** or **Space**: Select the cell under the cursor.
- **Mouse click**: Directly select any cell in the grid.

### Mobile
- **Tap**: Directly tap any hex code cell in the grid to select it.

## Base Time Limit

**12 seconds** (before scaling).

Effective time: `round(12 * (1 - difficulty * 0.4) * floorScale)`, then multiplied by `1.03^timerExtTier` for the Delay Injector meta upgrade.

- `floorScale = 1.0` for floors 1-15; `max(0.4, 1 - (floor - 15) * 0.02)` for floors 16+.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

- **Component**: `src/components/minigames/FindSymbol.tsx`
- **Key functions**:
  - `generatePuzzle(difficulty)` -- builds grid, targets, and dimensions
  - `randomHexCode()` -- produces a random 2-char hex string
  - `similarHexCode(ref)` -- produces a hex code differing by 1 character from `ref`
  - `shuffle(arr)` -- Fisher-Yates in-place shuffle
  - `handleSelect(cellIndex)` -- validates selection, advances or fails
- **State variables**:
  - `targetIndex` / `targetIndexRef` -- current position in the target sequence
  - `cursorRow`, `cursorCol` -- keyboard cursor position
  - `selectedCells: Set<number>` -- IDs of correctly matched cells
  - `puzzle` (memoized) -- contains `grid`, `targets`, `cols`, `rows`
- **Power-up detection**:
  - `hasProximityHint` -- checks for `hint` effect on `find-symbol`

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Grid size range | `generatePuzzle`, line `const cols = Math.round(3 + difficulty * 3)` | Change `3` (min) or `3` (scale) to adjust grid bounds |
| Sequence length | `generatePuzzle`, line `const seqLen = Math.round(2 + difficulty * 3)` | Change `2` (min) or `3` (scale) |
| Similar distractor threshold | `generatePuzzle`, condition `difficulty > 0.4` and probability `difficulty * 0.6` | Lower the threshold to introduce distractors earlier |
| Base time limit | `src/data/minigames/find-symbol.ts` `baseTimeLimit: 12` | Currently `12` |
| Symbol Scanner hint | `FindSymbol.tsx`, `isTargetHinted` conditional styling | Adjust brightness values for stronger/weaker hint |
| Hex alphabet | `HEX_CHARS` constant | Swap to a different character set for themed variants |
