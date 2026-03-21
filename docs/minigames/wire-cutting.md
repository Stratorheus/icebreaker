# Wire Cutting (`wire-cutting`)

## Player Guide

A set of coloured wires is displayed alongside a rules panel. Read the rules carefully to deduce the correct order in which to cut the wires. Press the number key matching a wire's position (or tap on mobile) to cut it. Cutting in the wrong order causes immediate failure. Some wires may be marked "DO NOT CUT" -- leave those alone. Cut all required wires in the correct sequence to succeed.

## Mechanic

**Puzzle generation:**

1. The 8 available wire colours (RED, BLUE, GREEN, YELLOW, PURPLE, ORANGE, WHITE, CYAN) are shuffled.
2. The first `wireCount` colours are selected as the wires for this puzzle.
3. A number of wires are designated as "skipped" (DO NOT CUT):
   - d < 0.3: 0 skips.
   - d 0.3-0.7: 0-1 skips.
   - d > 0.7: 0-2 skips (capped at `wireCount - 2`).
4. The remaining (non-skipped) wire indices are shuffled to determine the **correct cut order**.
5. Rules are generated via `buildRules()`:
   - "DO NOT CUT {color}" rules for skipped wires.
   - Positional rules: "Cut X first", "Cut X last", "Cut X before Y", "Cut X at position N".
   - At d >= 0.5, there is a 40% chance of an "alphabetical order" shortcut rule if the order happens to be alphabetical.
   - Every wire in the correct order is guaranteed to be constrained by at least one rule.
   - Rules are shuffled so the player must read and cross-reference them all.

**Rule count targets:**
- d < 0.3: up to 2 rules.
- d 0.3-0.6: up to 3 rules.
- d > 0.6: up to 4 rules.
Additional rules are added to ensure every wire in the cut order is mentioned.

**Resolution:**
- Pressing a wire number: if it matches `correctOrder[cutIndex]`, advance. If all cut, success via `complete(true)`.
- Wrong wire: immediate failure via `fail()`.
- Already-cut wires are ignored on re-press.
- Timer expiration: failure.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1.0 | Formula |
|-----------|-----|-------|-------|---------|
| Wire count | 3 | 5 | 7 | `round(3 + d * 4)` |
| Max skips (DO NOT CUT) | 0 | 1 | 2 | Stepped: 0 if d<0.3, 0-1 if d<0.7, 0-2 otherwise |
| Rule complexity | Positional only | Mixed positional + relative | Alphabetical possible | See rule generation logic |
| Target rule count | 2 | 3 | 4 | Stepped by difficulty band |

## Power-Up Support

| Power-Up | Source | Effect Type | Behaviour |
|----------|--------|-------------|-----------|
| **Wire Guide** (`wire-labels`) | Meta upgrade | `hint` | Dims non-target wires and highlights the next wire to cut. The keyboard hint bar also shows the next wire key in green. |
| **Delay Injector** (`delay-injector`) | Meta upgrade (global) | `global-time-bonus` | Time limit multiplied by `1.03^tier`. |
| **Difficulty Reducer** (`difficulty-reducer`) | Meta upgrade (global) | `difficulty-reduction` | Effective difficulty multiplied by `0.95^tier`. |

## Controls

### Desktop

- **Number keys 1-9** -- cut the wire at that position (1-indexed left to right).
- **Mouse click** -- click directly on any wire to cut it.

### Mobile

- **Tap** -- tap a wire to cut it.

## Base Time Limit

**12 seconds.**

Scaling formula: `round(12 * (1 - difficulty * 0.4) * floorScale * 1.03^timerExtTier)`

Where `floorScale = max(0.4, 1 - (floor - 15) * 0.02)` for floors > 15, otherwise 1.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

**Component path:** `src/components/minigames/WireCutting.tsx`

**Key functions:**
- `generatePuzzle(wireCount, difficulty)` -- full puzzle builder: picks colours, determines skip set, creates cut order, generates rules.
- `buildRules(wires, correctOrder, skippedIndices, difficulty)` -- constructs the human-readable rule set ensuring every cuttable wire is constrained.
- `handleNumberPress(wireNumber)` -- validates the cut against `correctOrder[cutIndex]` and resolves success or failure.
- `shuffle<T>(arr)` -- Fisher-Yates shuffle.

**State variables:**
- `cutIndex: number` -- position in the correct cut sequence (how many wires have been correctly cut).
- `cutWires: Set<number>` -- set of wire indices that have been cut.
- `hasWireOrderHint: boolean` -- whether the Wire Guide power-up is active.
- `nextWireIndex: number` -- the wire index that should be cut next (derived from `correctOrder[cutIndex]`).

**Constants:**
- `ALL_COLORS` -- 8 available wire colours.
- `COLOR_CSS` -- maps each colour name to its hex CSS value.

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Wire count range | Line 211: `3 + difficulty * 4` | Change multiplier for more/fewer wires |
| Skip (DO NOT CUT) count | `generatePuzzle()` lines 70-71 | Adjust difficulty thresholds and max |
| Available wire colours | `ALL_COLORS` constant (line 9) | Add new colours (also update `COLOR_CSS`) |
| Rule generation strategy | `buildRules()` lines 85-181 | Add new rule types or change selection logic |
| Alphabetical rule chance | Line 124: `Math.random() < 0.4` | Adjust probability or remove entirely |
| Target rule counts | Lines 100-105 in `buildRules()` | More rules = harder deduction |
| Wire Guide behaviour | Lines 273, 310-312 | Change what dims/highlights |
| Wire visual height | Line 338: `height: "120px"` | Adjust wire bar display size |
