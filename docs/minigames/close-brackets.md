# Code Inject (`close-brackets`)

## Player Guide
A sequence of opening brackets is displayed on screen. Your job is to type the matching closing brackets in reverse order (stack-style, matching the rightmost opener first). For example, if you see `( [ {`, you must type `} ] )`. The closers appear inline as you type them. Any wrong key causes immediate failure. Close all brackets to win. At higher difficulty the sequence is longer and may include unusual bracket types like `|` and `\`.

## Mechanic
On mount, the component generates a random sequence of opening brackets from the available pool. The expected closers are computed by reversing the opener sequence and mapping each opener to its closer via `BRACKET_PAIRS`:

```
( -> )    [ -> ]    { -> }    < -> >    | -> |    \ -> /
```

The player presses closer keys one at a time. Each keypress is compared against `expectedClosers[currentIndex]`. If correct, `currentIndex` advances. When `currentIndex >= expectedClosers.length`, `complete(true)` fires. If wrong, `fail()` fires immediately.

### Auto-Close
If the player has the Bracket Auto-Close power-up, `autoCloseCount` closers are pre-filled at the start. The `currentIndex` state initializes to `autoCloseCount` instead of 0, effectively skipping that many brackets.

### Bracket Reducer
If the Bracket Reducer meta upgrade is owned, the hardest bracket types (`\` and `|`) are removed from the opener pool, reducing the number of distinct bracket types the player must handle. The filter ensures at least 2 bracket types remain.

### Next-Char Hint
If the player has the Bracket Mirror or a hint-type upgrade targeting `close-brackets`, the next expected closer is displayed in a large highlighted box below the bracket sequence.

## Difficulty Scaling

| Parameter | Formula | d=0 | d=0.5 | d=1 |
|---|---|---|---|---|
| bracketMin | `Math.round(2 + difficulty * 4)` | 2 | 4 | 6 |
| bracketMax | `Math.round(4 + difficulty * 4)` | 4 | 6 | 8 |
| bracketCount | random in `[bracketMin, bracketMax]` | 2-4 | 4-6 | 6-8 |
| Bracket types | All 6 by default; reduced by Bracket Reducer | `( [ { < \| \` | Same | Same |

The actual bracket count is: `bracketMin + Math.floor(Math.random() * (bracketMax - bracketMin + 1))`.

Note: The bracket type pool does NOT change with difficulty -- all 6 types are always available (unless Bracket Reducer removes some). Difficulty only affects sequence length.

## Power-Up Support

| Name | ID | Effect Type | What It Does | Code Location |
|---|---|---|---|---|
| Bracket Auto-Close (run-shop) | `bracket-auto-close` | `auto-close` | Pre-closes 1 bracket (skips 1 position). Multiple copies stack additively. Capped at `expectedClosers.length`. | `CloseBrackets.tsx` lines 89-97 (`autoCloseCount` memo) |
| Bracket Reducer (meta) | `bracket-reducer` | `bracket-type-removal` / `minigame-specific` | Removes `\` and `|` from the opener pool, leaving only `( [ { <` | `CloseBrackets.tsx` lines 54-65 (`availableOpeners` memo) |
| Bracket Mirror (meta) | `bracket-mirror` | `auto-close` (repurposed) | Enables the "Next char hint" display showing the next expected closer | `CloseBrackets.tsx` lines 45-51 (`hasNextCharHint` memo), lines 216-235 (render) |
| Time bonuses (run-shop) | various | `time-bonus` | Adds seconds to timer | `MinigameScreen.tsx` line 443 |
| Delay Injector (meta) | `delay-injector` | `global-time-bonus` | Multiplies time by `1.03^tier` | `MinigameScreen.tsx` line 444 |
| Difficulty Reducer (meta) | `difficulty-reducer` | `difficulty-reduction` | Reduces effective difficulty, resulting in shorter bracket sequences | `MinigameScreen.tsx` line 438-439 |

## Controls
### Desktop
- `)`, `]`, `}`, `>`, `|`, `/` -- type the matching closer. These are the only accepted keys (defined in `CLOSER_KEYS`).
- No backspace or undo. Each keystroke is final.

### Mobile
- Touch bracket buttons rendered by `<TouchControls type="brackets" />` at the bottom of the screen.
- Tapping a button dispatches the corresponding closer key.

## Base Time Limit
**8 seconds** (`BASE_TIME_LIMITS["close-brackets"] = 8`).

At d=0: full 8s. At d=1: `8 * 0.6 = 4.8s` (rounds to 5s). After floor 15, additional 2%-per-floor decay applies. The short base time reflects the simple input mechanic -- the challenge is speed and accuracy under pressure.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference
- Component: `src/components/minigames/CloseBrackets.tsx`
- `BRACKET_PAIRS` -- lines 9-16: opener-to-closer mapping object
- `CLOSER_KEYS` -- line 21: `[")", "]", "}", ">", "|", "/"]`
- `availableOpeners` memo -- lines 54-65: filters opener pool based on Bracket Reducer
- `sequence` memo -- lines 73-80: generates random opener sequence on mount
- `expectedClosers` memo -- lines 83-86: reverses sequence and maps to closers
- `autoCloseCount` memo -- lines 89-97: counts auto-close power-ups, caps at sequence length
- `handleKeyPress(key)` -- lines 108-132: validates key against expected closer, win/fail
- `keyMap` memo -- lines 135-141: maps CLOSER_KEYS to handleKeyPress calls
- State variables:
  - `sequence: string[]` -- the opener sequence, generated on mount
  - `expectedClosers: string[]` -- derived from sequence, the answer key
  - `currentIndex` / `currentIndexRef` -- which closer the player must type next
  - `hasNextCharHint` -- boolean, true if hint/bracket-mirror upgrade is active
  - `autoCloseCount` -- number of pre-filled closers

## Tuning Guide
- **Bracket count range**: Modify `bracketMin` and `bracketMax` formulas at lines 68-69. Currently `2 + d*4` to `4 + d*4`.
- **Bracket types**: Add or remove entries in `BRACKET_PAIRS` (line 9) and `CLOSER_KEYS` (line 21). Also update `OPENERS` (derived automatically from `BRACKET_PAIRS` keys).
- **Bracket Reducer behavior**: Change which types are filtered in `availableOpeners` at lines 60-61. Currently removes `\` and `|`.
- **Auto-close stacking**: The cap is at `expectedClosers.length` (line 96). To limit stacking, add a hard cap (e.g. `Math.min(count, 3)`).
- **Base time**: Change `"close-brackets": 8` in `BASE_TIME_LIMITS` at `src/components/screens/MinigameScreen.tsx` line 275.
- **Touch controls**: The `TouchControls` component with `type="brackets"` is rendered at line 261. Its layout is defined in `src/components/layout/TouchControls.tsx`.
