# Cipher Crack V1 (`cipher-crack`)

## Player Guide
An encrypted word is displayed alongside a hint about the cipher method used (letter-swap, vowel-removal, or scramble). Your job is to figure out the original tech word and type it letter by letter. Each correct letter advances the cursor; any wrong letter causes immediate failure. The cipher method and a brief explanation are shown on screen. At higher difficulty, the words get longer and the cipher method becomes harder to reverse.

## Mechanic
On mount, the component picks a random word from a difficulty-appropriate word pool (`TECH_WORDS.short`, `medium`, `long`), selects a cipher method based on difficulty, and encrypts the word. The encrypted version is displayed in uppercase along with a method label and help text.

The player types letters one at a time. Each keypress is compared against `puzzle.word[charIndex]`. If the key matches, `charIndex` advances. When `charIndex` reaches the word length, `complete(true)` fires. If the key does not match, `fail()` fires immediately. Only lowercase a-z keys are accepted; all others are ignored.

### Cipher Methods

1. **letter-swap** (d < 0.2): Two adjacent characters at a random position `rotN` are swapped. Player must identify and mentally swap them back.
2. **remove-vowels** (0.2 <= d < 0.5): All vowels (a, e, i, o, u) are replaced with underscores. Player must reconstruct the word from consonant skeleton.
3. **scramble** (d >= 0.5): All letters are shuffled using Fisher-Yates. If the shuffle produces the same word, the first two characters are swapped as a fallback.

### Word Pools
- d < 0.35: `TECH_WORDS.short` (4-5 character words like "port", "bash", "ping")
- 0.35 <= d < 0.65: `TECH_WORDS.short` + `TECH_WORDS.medium` (4-7 characters)
- d >= 0.65: `TECH_WORDS.medium` + `TECH_WORDS.long` (6+ characters)

## Difficulty Scaling

| Difficulty Range | Cipher Method | Word Pool | Effect |
|---|---|---|---|
| d < 0.2 | letter-swap | short (4-5 chars) | Two adjacent letters swapped; easy to spot |
| 0.2 <= d < 0.5 | remove-vowels | short + medium (4-7 chars) | Vowels replaced with `_`; requires word recognition |
| d >= 0.5 | scramble | medium + long (6+ chars) | All letters randomized; hardest to decode |

Word pool thresholds (0.35, 0.65) are independent of cipher method thresholds (0.2, 0.5), creating nuanced combinations at mid-range difficulty.

## Power-Up Support

| Name | ID | Effect Type | What It Does | Code Location |
|---|---|---|---|---|
| Cipher Hint | `cipher-hint` | `hint` | Shows the first letter of the answer word below the cipher box: `Hint: starts with "X"` | `CipherCrack.tsx` lines 149-153 (detection), lines 263-267 (render) |
| Decode Assist | `decode-assist` | `minigame-specific` | Pre-fills 25/50/75% of decoded letters at random positions. Pre-filled letters appear in green and are non-editable; the player only types the remaining positions. 3 tiers, prices: 150/300/500 ◆. | `CipherCrack.tsx` (decodeAssistFraction memo, preFilledPositions computation, nextTypableIndex helper, charDisplay rendering) |
| Hint Module (run-shop) | `hint-module` | `hint` | Generic hint; the cipher-crack component checks for `effect.minigame === "cipher-crack"` specifically, so only the meta upgrade `cipher-hint` provides the first-letter hint | `CipherCrack.tsx` line 151 |
| Time bonuses (run-shop) | various | `time-bonus` | Adds seconds to timer (applied in MinigameRouter) | `MinigameScreen.tsx` (MinigameRouter) |
| Delay Injector (meta) | `delay-injector` | `global-time-bonus` | Multiplies time by `1.03^tier` | `MinigameScreen.tsx` (MinigameRouter) |
| Difficulty Reducer (meta) | `difficulty-reducer` | `difficulty-reduction` | Reduces effective difficulty, potentially shifting to an easier cipher method and shorter words | `MinigameScreen.tsx` (MinigameRouter) |

## Controls
### Desktop
- `a-z` keys — type the decoded letter at the current position. Only single lowercase letters are accepted.
- No backspace, no undo. Each keystroke is final.

### Mobile
- Tap "TAP HERE TO TYPE" button to focus a hidden `<input>` element with `inputMode="text"`, triggering the system keyboard.
- Each character typed into the hidden input is dispatched as a synthetic `keydown` event and then the input is cleared.

## Base Time Limit
**12 seconds** (`baseTimeLimit: 12` in `src/data/minigames/cipher-crack.ts`).

At d=0: full 12s. At d=1: `12 * 0.6 = 7.2s` (rounds to 7s). After floor 15, additional 2%-per-floor decay applies. Run-shop time bonuses and meta Delay Injector stack on top.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).

## Code Reference
- Component: `src/components/minigames/CipherCrack.tsx`
- `encrypt(word, method, rotN)` — line 48-57: dispatches to the appropriate encryption function
- `letterSwapEncrypt(word, pos)` — lines 19-24: swaps two adjacent characters
- `removeVowelsEncrypt(word)` — lines 27-29: replaces vowels with underscores
- `scrambleEncrypt(word)` — lines 32-45: Fisher-Yates shuffle with same-word fallback
- `getWordPool(difficulty)` — lines 96-100: selects word list by difficulty
- `pickMethod(difficulty)` — lines 102-106: selects cipher method by difficulty
- `handleKey(e)` — lines 177-203: core input handler; compares key against expected character
- State variables:
  - `puzzle` — `{ word, encrypted, methodLabel, examples, method, rotN }`, generated on mount
  - `charIndex` / `charIndexRef` — current position in the word being typed
  - `extraHintLetter` — number; > 0 if cipher-hint upgrade is owned

## Tuning Guide
- **Cipher method thresholds**: Change `pickMethod()` at lines 102-106. Currently: letter-swap < 0.2, remove-vowels < 0.5, scramble >= 0.5.
- **Word pool thresholds**: Change `getWordPool()` at lines 96-100. Currently: short < 0.35, short+medium < 0.65, medium+long >= 0.65.
- **Word lists**: Add/remove words in `src/data/words.ts` under `TECH_WORDS.short`, `.medium`, `.long`.
- **Swap position logic**: `pickRotN()` at lines 108-117 determines where the letter-swap occurs. Currently random within word length.
- **Base time**: Change `baseTimeLimit: 12` in `src/data/minigames/cipher-crack.ts`.
- **Hint content**: The cipher hint currently shows only the first character (line 265). To show more, index deeper into `puzzle.word`.
