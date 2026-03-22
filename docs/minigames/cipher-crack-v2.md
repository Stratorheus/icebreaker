# Cipher Crack V2 (`cipher-crack-v2`)

## Player Guide
An encrypted word is shown alongside a permanent alphabet reference chart that maps original letters to their shifted counterparts. The cipher is always a ROT (rotation) cipher with a shift of +1 to +3. Find each encrypted letter on the bottom row of the chart, read the original letter above it, and type the decoded word letter by letter. Any wrong keystroke is immediate failure. This version is more methodical than V1 -- the alphabet chart gives you all the information you need, but you must be fast and accurate.

## Mechanic
On mount, the component picks a random word from a difficulty-appropriate pool, always uses the `"rot"` cipher method, picks a random rotation of 1-3 via `pickRotN()`, and encrypts the word using `rotWord(word, n)`. The `rotChar` function shifts each character: `((charCode - 97 + n) % 26 + 26) % 26 + 97`, handling wrap-around correctly.

An `AlphabetChart` component renders a 13-column grid showing original A-Z on top rows and their shifted equivalents on bottom rows. The player uses this chart to decode each letter.

Input works identically to CipherCrack V1: each keypress is compared against `puzzle.word[charIndex]`. Correct key advances the cursor; wrong key triggers `fail()`. Only a-z keys are accepted. When all characters are typed correctly, `complete(true)` fires.

### Encryption
`rotWord(word, n)` applies `rotChar(ch, n)` to every character. The rotation is always 1, 2, or 3 (hardcoded in `pickRotN()`). Despite the component docstring mentioning "reverse + ROT at higher difficulty", the current implementation always uses plain ROT regardless of difficulty.

### Word Pools
Same logic as V1:
- d < 0.35: `TECH_WORDS.short` (4-5 characters)
- 0.35 <= d < 0.65: short + medium (4-7 characters)
- d >= 0.65: medium + long (6+ characters)

## Difficulty Scaling

| Difficulty Range | Cipher | ROT Amount | Word Pool |
|---|---|---|---|
| Any | ROT only | Random 1-3 | Scales with difficulty |
| d < 0.35 | ROT 1-3 | 1-3 | short (4-5 chars) |
| 0.35 <= d < 0.65 | ROT 1-3 | 1-3 | short + medium (4-7 chars) |
| d >= 0.65 | ROT 1-3 | 1-3 | medium + long (6+ chars) |

Note: The rotation amount does NOT scale with difficulty -- it is always `Math.floor(Math.random() * 3) + 1`. Only the word length pool scales. The docstring mentions reverse+ROT at d >= 0.5 but this is not implemented in the current code.

## Power-Up Support

| Name | ID | Effect Type | What It Does | Code Location |
|---|---|---|---|---|
| Shift Marker | `shift-marker` | `minigame-specific` | Highlights the ROT shift offset in the alphabet chart with orange coloring and a descriptive label showing the shift direction. 1 tier, price: 175 ◆. | `CipherCrackV2.tsx` (hasShiftMarker memo, AlphabetChart showShiftMarker prop) |
| Auto-Decode | `auto-decode-v2` | `hint` | Pre-fills 25/50/75% of decoded letters at random positions. Pre-filled letters appear in green and are non-editable; the player only types the remaining positions. 3 tiers, prices: 200/400/650 ◆. | `CipherCrackV2.tsx` (autoDecodeFraction memo, preFilledPositions computation, nextTypableIndex helper, charDisplay rendering) |
| Time bonuses (run-shop) | various | `time-bonus` | Adds seconds to timer | `MinigameScreen.tsx` line 443 |
| Delay Injector (meta) | `delay-injector` | `global-time-bonus` | Multiplies time by `1.03^tier` | `MinigameScreen.tsx` line 444 |
| Difficulty Reducer (meta) | `difficulty-reducer` | `difficulty-reduction` | Reduces effective difficulty, potentially using shorter word pool | `MinigameScreen.tsx` line 438-439 |

## Controls
### Desktop
- `a-z` keys -- type the decoded letter. Each keystroke is final (no backspace).

### Mobile
- Tap "TAP HERE TO TYPE" to focus a hidden `<input>` with `inputMode="text"`.
- Characters are dispatched as synthetic `keydown` events.

## Base Time Limit
**15 seconds** (`BASE_TIME_LIMITS["cipher-crack-v2"] = 15`).

At d=0: full 15s. At d=1: `15 * 0.6 = 9s`. After floor 15, additional 2%-per-floor decay. The 3 extra seconds compared to V1 (12s) compensate for the alphabet chart lookup overhead.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference
- Component: `src/components/minigames/CipherCrackV2.tsx`
- `rotChar(ch, n)` -- line 15-17: core ROT cipher for a single character
- `rotWord(word, n)` -- lines 20-22: applies rotChar to every letter
- `encrypt(word, method, rotN)` -- lines 25-27: always calls `rotWord`
- `pickRotN()` -- lines 53-56: returns random 1-3
- `getWordPool(difficulty)` -- lines 43-47: same logic as V1
- `AlphabetChart({ rotN })` -- lines 68-101: renders the 13-column reference grid
- `handleKey(e)` -- lines 162-188: input validation, identical logic to V1
- State variables:
  - `puzzle` -- `{ word, encrypted, methodLabel, examples, method, rotN }`, generated on mount
  - `charIndex` / `charIndexRef` -- current typing position
  - `extraHintLetter` -- number; > 0 if a hint power-up targeting cipher-crack-v2 is active

## Tuning Guide
- **ROT range**: Change `pickRotN()` at lines 53-56. Currently `Math.floor(Math.random() * 3) + 1` (1-3). Increasing to 1-13 would make it much harder.
- **Implement reverse+ROT**: The docstring (line 115-116) describes this feature but it is not coded. To add it: reverse the word before applying ROT when `difficulty >= 0.5`.
- **Word pool thresholds**: Change `getWordPool()` at lines 43-47.
- **Alphabet chart layout**: Modify `AlphabetChart` at lines 68-101. Currently uses a 13-column grid split into two rows (A-M, N-Z).
- **Base time**: Change `"cipher-crack-v2": 15` in `BASE_TIME_LIMITS` at `src/components/screens/MinigameScreen.tsx` line 287.
- **Shift Marker tuning**: The marker highlights the first N columns in the alphabet chart where N = rotN. Modify the `isMarked` condition in `AlphabetChart` to change which cells are highlighted.
- **Auto-Decode tuning**: Adjust tier values (0.25/0.50/0.75) in `meta-upgrades.ts` (auto-decode-v2 entry). At 75% pre-fill, most letters are given away — this is intentional as the highest tier.
