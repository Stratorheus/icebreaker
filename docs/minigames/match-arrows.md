# Packet Route (`match-arrows`)

## Player Guide

A row of arrow slots is displayed. The first arrow is revealed; the rest are hidden behind `?` placeholders. The player must press the matching arrow key (or tap the D-pad direction on mobile) to advance. A correct press reveals the next arrow in the sequence. A wrong press causes immediate failure. Matching all arrows in order completes the minigame. The game is purely reflexive -- there is no grid to navigate, just a sequence to echo back.

## Mechanic

1. **Sequence generation**:
   - Row length is randomized within a range: `min = round(3 + difficulty * 4)`, `max = round(5 + difficulty * 5)`. A random integer in `[min, max]` is chosen.
   - Each slot is filled with a random direction from `{ArrowUp, ArrowDown, ArrowLeft, ArrowRight}`.
   - Post-processing prevents 3+ consecutive identical arrows: if `seq[i] == seq[i-1] == seq[i-2]`, `seq[i]` is replaced with a different random direction.

2. **Input logic**:
   - On each key/tap, the pressed direction is compared to `sequence[currentIndex]`.
   - Correct: `currentIndex` increments. If `currentIndex >= sequence.length`, `complete(true)` is called.
   - Wrong: immediate `fail()`.

3. **Peek-ahead**: The Arrow Preview meta upgrade (5 tiers) reveals arrows beyond the current one. The number of peeked arrows is: `count = round(rowLength * value)` where value is 0.20/0.30/0.40/0.50/0.60. Peeked arrows display with a yellow/amber styling instead of `?`.

4. **Direction hint**: If the player has the `hint` + `match-arrows` meta upgrade, a large "Press [arrow]" indicator is displayed below the sequence row, making the current arrow unmissable.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1 | Formula |
|-----------|-----|-------|-----|---------|
| Row length (min) | 3 | 5 | 7 | `round(3 + d * 4)` |
| Row length (max) | 5 | 8 | 10 | `round(5 + d * 5)` |
| Actual length | 3-5 | 5-8 | 7-10 | Random in `[min, max]` |

Note: There is no speed scaling within this minigame. Difficulty only affects the number of arrows to match. Time pressure comes from the global timer.

## Power-Up Support

| Power-Up | Source | Effect Type | Behavior |
|----------|--------|-------------|----------|
| **Arrow Preview** (5 tiers) | Meta upgrade (`arrow-preview`) | `peek-ahead` | Pre-reveals 20/30/40/50/60% of the sequence length ahead of the current arrow. Peeked arrows show in yellow. |
| **Direction Hint** | Meta upgrade (via `hint` + `match-arrows`) | `hint` | Displays a large current-arrow indicator below the row (desktop: "Press [arrow]" with a large glow box). |
| **Time bonuses** | Run shop (various) | `time-bonus` | Adds seconds to the timer for this floor. |

## Controls

### Desktop
- **Arrow keys** (`Up`/`Down`/`Left`/`Right`): Press the direction matching the currently revealed arrow.

### Mobile
- **D-pad** (`TouchControls type="dpad"`): Tap the matching direction on the on-screen directional pad.

## Base Time Limit

**8 seconds** (before scaling).

Effective time: `round(8 * (1 - difficulty * 0.4) * floorScale)`, then multiplied by `1.03^timerExtTier`.

- At d=0: `round(8 * 1.0) = 8s` base.
- At d=1: `round(8 * 0.6) = 5s` base.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

- **Component**: `src/components/minigames/MatchArrows.tsx`
- **Key functions**:
  - Sequence generation via `useMemo` (lines 68-82) -- random arrows with no-triple-repeat constraint
  - `handleArrowPress(key)` -- validates input against `sequence[currentIndex]`
- **State variables**:
  - `currentIndex` / `currentIndexRef` -- position in the arrow sequence
  - `sequence: ArrowKey[]` -- the generated arrow sequence (stable after mount)
  - `peekAhead: number` -- how many arrows ahead are visible
  - `hasDirectionHint: boolean` -- whether to show the large direction indicator
- **Constants**:
  - `ARROWS` -- array of `{key, char, label}` for the 4 directions

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Row length range | Lines `rowMin = Math.round(3 + difficulty * 4)` and `rowMax = Math.round(5 + difficulty * 5)` | Adjust base and scale factors |
| No-triple-repeat rule | Post-processing loop at line 74 | Remove or loosen for harder sequences |
| Peek-ahead values | `src/data/minigames/match-arrows.ts` (`arrow-preview` effects: 0.20/0.30/0.40/0.50/0.60) | Increase values for more generous previews |
| Base time limit | `src/data/minigames/match-arrows.ts` `baseTimeLimit: 8` | Currently `8` |
| Direction hint visibility | `hasDirectionHint` check | Always show by removing the power-up gate for an easier default |
