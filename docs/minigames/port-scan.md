# Port Scan (`port-scan`)

## Player Guide

A grid of network port numbers is displayed. During the display phase, "open" ports flash green one by one while the timer is paused. After all ports have flashed, the timer starts and you must select every port that flashed. Selecting a wrong port causes immediate failure. Select all open ports correctly to win. You can deselect a previously selected port if you change your mind.

## Mechanic

**Puzzle generation:**

1. A pool of 50 common network port numbers (20, 21, 22, 23, 25, 53, ... 50000) is shuffled using Fisher-Yates.
2. The first `gridSize^2` ports are placed into a flat grid array.
3. `openCount` random indices from that grid are chosen as "open" ports.

**Display phase:**

- Timer is **paused** on mount via `timer.pause()`.
- Open ports flash sequentially: each port highlights green for `flashMs` milliseconds, with a gap of `max(150, flashMs * 0.4)` ms between flashes.
- An initial 500 ms delay precedes the first flash.
- After all flashes complete (plus a 200 ms buffer), the phase transitions to "select" and the timer starts.

**Select phase:**

- Player clicks/taps or navigates with arrow keys and toggles with Space.
- Selecting a port that is NOT open triggers immediate failure (after a 400 ms visual delay).
- Selecting a correct port increments the correct counter. When `correctCount >= openCount`, the player wins (after a 400 ms delay).
- Deselecting a correct port decrements the counter -- no penalty for deselect.

**Scoring:** Binary pass/fail. Speed bonus comes from the remaining timer fraction (handled by the game engine, not this component).

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1.0 | Formula |
|-----------|-----|-------|-------|---------|
| Grid size (NxN) | 3x3 (9 cells) | 4x4 (16 cells) | 5x5 (25 cells) | `round(3 + d * 2)` |
| Open port count | 2 | 4 | 6 | `round(2 + d * 4)` |
| Flash duration (ms) | 700 | 475 | 250 | `round(700 - d * 450)` |
| Gap between flashes (ms) | 280 | 190 | 150 | `max(150, flashMs * 0.4)` |

## Power-Up Support

| Power-Up | Source | Effect Type | Behaviour |
|----------|--------|-------------|-----------|
| **Deep Scan** (`port-scan-deep`) | Meta upgrade | `minigame-specific` | Open ports flash **twice** instead of once (`flashRepeat = 2`). A 200 ms gap separates the two full sequences. |
| **Port Logger** (`port-logger`) | Meta upgrade | `hint` | During the select phase, shows a sorted text list of all open port numbers below the phase indicator (e.g. "Open: 22, 80, 443, 3306"). 1 tier, price: 200 ◆. |
| **Delay Injector** (`delay-injector`) | Meta upgrade (global) | `global-time-bonus` | Time limit multiplied by `1.03^tier`. |
| **Difficulty Reducer** (`difficulty-reducer`) | Meta upgrade (global) | `difficulty-reduction` | Effective difficulty multiplied by `0.95^tier`. |

## Controls

### Desktop

- **Arrow keys** -- move the keyboard cursor across the grid (up/down/left/right within bounds).
- **Space** -- toggle select/deselect on the currently focused cell.
- **Mouse click** -- toggle any cell directly.

### Mobile

- **Tap** -- toggle select/deselect on any cell.

## Base Time Limit

**15 seconds.**

Scaling formula: `round(15 * (1 - difficulty * 0.4) * floorScale * 1.03^timerExtTier)`

Where `floorScale = max(0.4, 1 - (floor - 15) * 0.02)` for floors > 15, otherwise 1.

Note: the timer is paused during the entire display phase and only runs during the select phase.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

**Component path:** `src/components/minigames/PortScan.tsx`

**Key functions:**
- `getParams(difficulty)` -- computes `gridSize`, `openCount`, `flashMs` from difficulty scalar.
- `generatePuzzle(params)` -- builds port grid and selects open indices.
- `handleToggle(index)` -- core select/deselect logic with win/fail resolution.
- `shuffle<T>(arr)` -- Fisher-Yates shuffle used for port randomization.

**State variables:**
- `phase: "display" | "select"` -- current game phase.
- `flashingIndex: number | null` -- index of the currently flashing port during display.
- `selectedIndices: Set<number>` -- player-selected cell indices.
- `correctCount: number` -- how many correctly selected so far.
- `cursorIndex: number` -- keyboard navigation position.

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Grid size range | `getParams()` line 32: `3 + difficulty * 2` | Change multiplier for more/fewer cells |
| Open port count range | `getParams()` line 33: `2 + difficulty * 4` | Adjust the `4` to change max open ports |
| Flash duration range | `getParams()` line 34: `700 - difficulty * 450` | Lower minimum makes the game harder |
| Flash gap timing | Display effect, line 161: `max(150, flashMs * 0.4)` | Minimum 150 ms prevents overlap |
| Port pool | `PORT_POOL` constant at top of file | Add/remove port numbers |
| Win/fail delay | `handleToggle()`: `setTimeout(() => ..., 400)` | Visual feedback duration before resolution |
| Deep Scan repeat count | `meta-upgrades.ts` `port-scan-deep` entry, `value: 2` | Change to flash more times |
