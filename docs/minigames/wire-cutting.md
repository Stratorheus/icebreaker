# Process Kill (`wire-cutting`)

## Player Guide

A set of coloured processes is displayed alongside a rules panel. Read the rules carefully to deduce the correct order in which to terminate the processes. Press the number key matching a process's position (or tap on mobile) to terminate it. Terminating in the wrong order causes immediate failure. Some processes may be marked "DO NOT TERMINATE" -- leave those alone. Terminate all required processes in the correct sequence to succeed.

## Mechanic

**Puzzle generation:**

1. The 8 available stream colours (RED, BLUE, GREEN, YELLOW, PURPLE, ORANGE, WHITE, CYAN) are shuffled.
2. The first `processCount` colours are selected as the processes for this puzzle.
3. A number of processes are designated as "skipped" (DO NOT TERMINATE):
   - d < 0.3: 0 skips.
   - d 0.3-0.7: 0-1 skips.
   - d > 0.7: 0-2 skips (capped at `processCount - 2`).
4. The remaining (non-skipped) process indices are shuffled to determine the **correct termination order**.
5. Rules are generated via `buildRules()`:
   - "DO NOT TERMINATE {color}" rules for skipped processes.
   - Positional rules: "Terminate X first", "Terminate X last", "Terminate X before Y", "Terminate X at position N".
   - At d >= 0.5, there is a 40% chance of an "alphabetical order" shortcut rule if the order happens to be alphabetical.
   - Every process in the correct order is guaranteed to be constrained by at least one rule.
   - Rules are shuffled so the player must read and cross-reference them all.

**Rule count targets:**
- d < 0.3: up to 2 rules.
- d 0.3-0.6: up to 3 rules.
- d > 0.6: up to 4 rules.
Additional rules are added to ensure every process in the termination order is mentioned.

**Resolution:**
- Pressing a process number: if it matches `correctOrder[cutIndex]`, advance. If all terminated, success via `complete(true)`.
- Wrong process: immediate failure via `fail()`.
- Already-terminated processes are ignored on re-press.
- Timer expiration: failure.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1.0 | Formula |
|-----------|-----|-------|-------|---------|
| Process count | 3 | 5 | 7 | `round(3 + d * 4)` |
| Max skips (DO NOT TERMINATE) | 0 | 1 | 2 | Stepped: 0 if d<0.3, 0-1 if d<0.7, 0-2 otherwise |
| Rule complexity | Positional only | Mixed positional + relative | Alphabetical possible | See rule generation logic |
| Target rule count | 2 | 3 | 4 | Stepped by difficulty band |

## Power-Up Support

| Power-Up | Source | Effect Type | Behaviour |
|----------|--------|-------------|-----------|
| **Stream Monitor** (`wire-labels`) | Meta upgrade | `wire-color-labels` | Dims non-target processes and highlights the next process to terminate. The keyboard hint bar also shows the next process key in green. |
| **Delay Injector** (`delay-injector`) | Meta upgrade (global) | `global-time-bonus` | Time limit multiplied by `1.03^tier`. |
| **Difficulty Reducer** (`difficulty-reducer`) | Meta upgrade (global) | `difficulty-reduction` | Pushes max difficulty 2 floors further per tier. |

## Controls

### Desktop

- **Number keys 1-9** -- terminate the process at that position (1-indexed left to right).
- **Mouse click** -- click directly on any process to terminate it.

### Mobile

- **Tap** -- tap a process to terminate it.

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
- `generatePuzzle(processCount, difficulty)` -- full puzzle builder: picks colours, determines skip set, creates termination order, generates rules.
- `buildRules(processes, correctOrder, skippedIndices, difficulty)` -- constructs the human-readable rule set ensuring every terminable process is constrained.
- `handleNumberPress(processNumber)` -- validates the termination against `correctOrder[cutIndex]` and resolves success or failure.
- `shuffle<T>(arr)` -- Fisher-Yates shuffle.

**State variables:**
- `cutIndex: number` -- position in the correct termination sequence (how many processes have been correctly terminated).
- `cutWires: Set<number>` -- set of process indices that have been terminated.
- `hasWireOrderHint: boolean` -- whether the Stream Monitor power-up is active.
- `nextWireIndex: number` -- the process index that should be terminated next (derived from `correctOrder[cutIndex]`).

**Constants:**
- `ALL_COLORS` -- 8 available stream colours.
- `COLOR_CSS` -- maps each colour name to its hex CSS value.

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Process count range | Line 211: `3 + difficulty * 4` | Change multiplier for more/fewer processes |
| Skip (DO NOT TERMINATE) count | `generatePuzzle()` lines 70-71 | Adjust difficulty thresholds and max |
| Available stream colours | `ALL_COLORS` constant (line 9) | Add new colours (also update `COLOR_CSS`) |
| Rule generation strategy | `buildRules()` lines 85-181 | Add new rule types or change selection logic |
| Alphabetical rule chance | Line 124: `Math.random() < 0.4` | Adjust probability or remove entirely |
| Target rule counts | Lines 100-105 in `buildRules()` | More rules = harder deduction |
| Stream Monitor behaviour | Lines 273, 310-312 | Change what dims/highlights |
| Process visual height | Line 338: `height: "120px"` | Adjust process bar display size |
