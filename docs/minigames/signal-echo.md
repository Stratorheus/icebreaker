# Signal Echo (`signal-echo`)

## Player Guide

Four colored directional panels are arranged in a cross layout resembling arrow keys: Cyan (Up), Magenta (Right), Green (Down), Orange (Left). The game plays a sequence by lighting panels one at a time. After the display, the player must repeat the sequence by pressing the matching arrow keys or tapping the panels. Each successful round adds one more step to the sequence. A wrong input at any point causes immediate failure. Completing all rounds wins the game. The timer is paused during the display phase and only runs during the player's input phase.

## Mechanic

1. **Parameter calculation** (on mount):
   - `startLength = 1` -- the sequence always starts with a single signal.
   - `displayMs = round(600 - difficulty * 350)` -- time each panel stays lit. 600ms at d=0, 250ms at d=1. If the Slow Replay power-up is active, this is multiplied by 1.3.
   - `totalRounds = round(3 + difficulty * 5)` -- number of rounds to complete. 3 rounds at d=0, 8 rounds at d=1.
   - `gapMs = max(150, displayMs * 0.4)` -- pause between lights in the sequence.

2. **Sequence growth**:
   - The initial sequence has `startLength` (1) random directions.
   - After each successful round, one random direction is appended.
   - By the final round, the sequence length is `startLength + totalRounds - 1` (e.g., 3 at d=0, 8 at d=1).

3. **Display phase**:
   - Timer is paused via `timer.pause()`.
   - Panels light up one by one with `displayMs` on-time and `gapMs` gap.
   - An initial 400ms delay precedes the first light.
   - Total display time: `400 + sequence.length * (displayMs + gapMs)`.
   - After the full sequence plays, the phase transitions to `"input"` and `timer.start()` resumes the countdown.

4. **Input phase**:
   - Timer is running.
   - Each press is compared to `sequence[inputIndex]`.
   - Correct: `inputIndex` advances. A brief 150ms flash on the pressed panel provides feedback.
   - Wrong: immediate `fail()`.
   - When `inputIndex >= sequence.length` for the current round:
     - If `currentRound + 1 >= totalRounds`: all rounds complete, `complete(true)`.
     - Otherwise: append a random direction to the sequence, increment round, transition back to `"display"` phase.

5. **Scoring**: Binary pass/fail. Timer-based speed bonus applies from the global system.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1 | Formula |
|-----------|-----|-------|-----|---------|
| Display speed per signal | 600ms | 425ms | 250ms | `round(600 - d * 350)` |
| Gap between signals | 240ms | 170ms | 150ms (min) | `max(150, displayMs * 0.4)` |
| Total rounds | 3 | 6 | 8 | `round(3 + d * 5)` |
| Start length | 1 | 1 | 1 | Always 1 |
| Final sequence length | 3 | 6 | 8 | `startLength + totalRounds - 1` |

## Power-Up Support

| Power-Up | Source | Effect Type | Behavior |
|----------|--------|-------------|----------|
| **Slow Replay** | Meta upgrade (`signal-echo-slow`) | `minigame-specific` + `signal-echo` | Multiplies `displayMs` by 1.3 (30% slower), giving the player more time to memorize the sequence. Gap between signals also increases proportionally since `gapMs = max(150, displayMs * 0.4)`. |
| **Time bonuses** | Run shop (various) | `time-bonus` | Adds seconds to the timer for this floor (only counts during input phases). |

## Controls

### Desktop
- **Arrow keys** (`Up`/`Down`/`Left`/`Right`): Press the direction matching the expected panel in the sequence.
- **Mouse click**: Click directly on the colored panel buttons.

### Mobile
- **Tap**: Tap the colored panel buttons on screen to repeat the sequence.

## Base Time Limit

**20 seconds** (before scaling).

Effective time: `round(20 * (1 - difficulty * 0.4) * floorScale) + bonusTimeSecs`, then multiplied by `1.03^timerExtTier`.

- At d=0: `round(20 * 1.0) = 20s` base.
- At d=1: `round(20 * 0.6) = 12s` base.

Important: The timer is **paused during display phases** and only ticks during input phases. So the effective pressure depends on how many rounds have input phases and how long each input phase lasts.

## Code Reference

- **Component**: `src/components/minigames/SignalEcho.tsx`
- **Key functions**:
  - `handlePress(dir)` -- validates input, advances sequence or triggers round/win/fail
  - `flashPanel(dir)` -- brief 150ms visual feedback on panel press
  - Display phase effect (lines 160-205) -- schedules panel lights via `setTimeout` chain
- **State variables**:
  - `sequence: Direction[]` -- the growing signal sequence
  - `currentRound` / `currentRoundRef` -- zero-indexed round counter
  - `phase: "display" | "input" | "success" | "fail"` -- current game phase
  - `litPanel: Direction | null` -- which panel is currently lit (display or flash)
  - `inputIndex` / `inputIndexRef` -- position in the sequence during input phase
- **Constants**:
  - `PANELS: Panel[]` -- 4 panel definitions with colors, keys, labels, and glow colors
  - `DIR_INDEX` -- maps direction strings to panel array indices
- **Timer control**:
  - `timer.pause()` on display phase entry
  - `timer.start()` on transition to input phase
  - Initial mount: `queueMicrotask(() => timer.pause())` to pause before the first display

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Display speed range | `params`, `Math.round(600 - difficulty * 350)` | Change `600` (slow) or `350` (reduction). Lower bound should stay above ~200ms for visibility. |
| Total rounds range | `params`, `Math.round(3 + difficulty * 5)` | Change `3` (min rounds) or `5` (scale). More rounds = longer game. |
| Start sequence length | `params`, `startLength = 1` | Increase to start with a longer initial sequence |
| Slow Replay multiplier | `SignalEcho.tsx`, `displayMs * 1.3` | Increase 1.3 for a stronger slow effect |
| Flash feedback duration | `flashPanel`, `setTimeout(..., 150)` | Increase for more visible press feedback |
| Initial display delay | Display effect, `initialDelay = 400` | Shorter for faster starts, longer for breathing room |
| Panel colors | `PANELS` array | Adjust `color`, `dimColor`, `glowColor` per panel |
| Base time limit | `MinigameScreen.tsx`, `BASE_TIME_LIMITS["signal-echo"]` | Currently `20` |
