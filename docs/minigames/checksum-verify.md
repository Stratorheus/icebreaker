# Checksum Verify (`checksum-verify`)

## Player Guide
A series of math expressions is displayed one at a time. Type the correct numerical answer using the digit keys (0-9) and the minus key (-), then press Enter or Space to confirm. A wrong answer causes immediate failure. Solve all expressions in the series to win. At low difficulty you face simple single-digit addition; at high difficulty you encounter multiplication and two-digit arithmetic.

## Mechanic
On mount, the component generates a fixed number of `Expression` objects via `generateExpression(difficulty)`. Each expression has a `display` string (e.g. `"3 + 5"`) and a pre-computed integer `answer`. The player types digits into a text input buffer (`input` state). On confirm (Enter/Space), the input is parsed with `parseInt(currentInput, 10)` and compared strictly (`===`) against `expressions[currentIndex].answer`. If the parsed value does not match, `fail()` is called after a 400ms red flash. If it matches, a 300ms green flash plays, then the game advances to the next expression. When the last expression is answered correctly, `complete(true)` fires after a 400ms delay.

There is no partial credit and no retry. Empty or non-numeric input is silently ignored on confirm.

## Difficulty Scaling

| Difficulty Range | Expression Type | Operand Ranges | Expression Count |
|---|---|---|---|
| d <= 0.15 | Single-digit add/subtract | a: 1-9, b: 1-9 (subtract: b <= a) | 2 |
| 0.15 < d <= 0.45 | Two-digit +/- single-digit | a: 10-99, b: 1-9 | 3 |
| 0.45 < d <= 0.75 | Two-digit +/- two-digit | a: 10-99, b: 10-99 | 4 |
| d > 0.75 | 50% chance: multiplication (2-9 x 2-9), 50% chance: two-digit add (10-99 + 10-99) | See description | 5 |

Key functions:
- `getExpressionCount(difficulty)` — returns 2/3/4/5 based on thresholds at 0.15, 0.45, 0.75
- `generateExpression(difficulty)` — picks operation type and operand ranges per difficulty band

## Power-Up Support

| Name | ID | Effect Type | What It Does | Code Location |
|---|---|---|---|---|
| Calculator | `checksum-calculator` | `minigame-specific` | Shows an intermediate result hint next to the expression: the sign (if negative) plus the first digit of the answer, followed by `...`. E.g. for answer `42` shows `= 4...` | `ChecksumVerify.tsx` line 97-101 (`hasCalculator` memo), line 300-304 (render) |
| Error Margin | `error-margin` | `hint` | Answers within ±1/±2/±3/±4/±5 of the correct value are accepted. Tolerance is shown in UI as "±N tolerance active". 5 tiers, prices: 100/200/350/500/700 ◆. | `ChecksumVerify.tsx` (`errorTolerance` memo, `withinTolerance` check in `handleConfirm`, UI indicator) |
| Range Hint | `range-hint` | `preview` | Shows the approximate range of the answer: "Answer is between X and Y". Range is ±10/±5/±3 of the correct answer. 3 tiers, prices: 150/300/500 ◆. | `ChecksumVerify.tsx` (`rangeHintPct` memo, range display above equals sign) |
| Time Freeze / Clock Boost / etc. | various | `time-bonus` | Adds bonus seconds to the timer (applied externally in `MinigameRouter`) | `MinigameScreen.tsx` (MinigameRouter) |
| Delay Injector (meta) | `delay-injector` | `global-time-bonus` | Multiplies total time by `1.03^tier` | `MinigameScreen.tsx` (MinigameRouter) |
| Difficulty Reducer (meta) | `difficulty-reducer` | `difficulty-reduction` | Pushes max difficulty 2 floors further per tier, reducing expression complexity and count | `MinigameScreen.tsx` (MinigameRouter) |

## Controls
### Desktop
- `0-9` — type digits
- `-` — type minus sign (only accepted at position 0)
- `Backspace` — delete last character
- `Enter` or `Space` — confirm answer

### Mobile
- Tap "TAP HERE TO TYPE" to open the system numeric keyboard via a hidden `<input>` with `inputMode="numeric"`
- Each character typed is dispatched as a synthetic `keydown` event
- Tap "CONFIRM" button to submit (dispatches Enter keydown)

## Base Time Limit
**15 seconds** (`baseTimeLimit: 15` in `src/data/minigames/checksum-verify.ts`).

Scaled by difficulty: `baseTime * (1 - difficulty * 0.4)`. At d=0 the player gets the full 15s; at d=1 they get 9s. After floor 15, an additional floor-based decay of 2% per floor applies (down to 40% of the difficulty-adjusted time).

Additional modifiers:
- **Time-bonus** power-ups (run shop, various): flat seconds added by `useMinigame` hook on mount
- `timerExtensionTier` from meta upgrade (multiplicative: `* 1.03^tier`)
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).

## Code Reference
- Component: `src/components/minigames/ChecksumVerify.tsx`
- `generateExpression(difficulty)` — lines 15-58: expression generation with 4 difficulty bands
- `getExpressionCount(difficulty)` — lines 60-65: returns expression count per difficulty
- `handleConfirm()` — lines 131-171: answer validation, flash feedback, advance/win/fail logic
- `handleDigit(digit)` — lines 174-185: appends digit to input buffer
- `handleMinus()` — lines 188-198: allows minus only at start of input
- `handleBackspace()` — lines 201-209: removes last character
- State variables:
  - `expressions: Expression[]` — generated on mount, stable
  - `currentIndex` / `currentIndexRef` — which expression is active
  - `input` / `inputRef` — current typed string
  - `flash` — `"correct" | "wrong" | null` for visual feedback
  - `hasCalculator` — boolean, true if Calculator power-up is active

## Tuning Guide
- **Expression complexity**: Modify the difficulty thresholds in `generateExpression()` (lines 16, 28, 37) and the operand ranges within each band.
- **Expression count**: Change the return values in `getExpressionCount()` (lines 60-65). Current: 2/3/4/5.
- **Base time**: Change `baseTimeLimit: 15` in `src/data/minigames/checksum-verify.ts`.
- **Flash duration**: Correct flash is 300ms (line 163), wrong flash is 400ms (line 149). Adjust the `setTimeout` delays.
- **Calculator hint detail**: Currently shows first digit + `...` (line 302). Could show more digits or the full answer by editing the template literal.
- **Difficulty-to-time scaling**: Governed by `getTimeLimit()` in `src/data/balancing.ts` line 60-66. The `0.4` multiplier controls how much time shrinks at max difficulty.
