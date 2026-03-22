# Decrypt Signal (`type-backward`)

## Player Guide

A series of mirrored (reversed) words are displayed on screen. For each word, you must mentally un-reverse it and type the original word letter by letter. Words are processed left to right as displayed. Any wrong keypress causes immediate failure. Complete all words to succeed. On mobile, tap the "TAP HERE TO TYPE" button to bring up the system keyboard.

## Mechanic

**Puzzle generation:**

1. A difficulty-scaled word pool is assembled from `TECH_WORDS` (cyberpunk/tech vocabulary):
   - d < 0.3: short words doubled + medium words (biased toward 4-5 letter words).
   - d 0.3-0.6: short + medium words.
   - d > 0.6: all words (short + medium + long).
2. `wordCount` random words are picked without repeats. Word count range: `[2+d*3, 4+d*4]` (e.g., d=0: 2-4 words, d=1: 5-8 words).
3. Each word is reversed character-by-character (e.g., "kernel" becomes "lenrek").
4. The reversed words are displayed in **reverse list order** -- the last mirrored word appears first.
5. The expected answer for each displayed word is its un-mirrored form.

**Input handling:**

- Global `keydown` listener captures single letter keys (a-z only).
- Each keypress is compared against the expected character at the current position.
- Correct key: advance character position. If word complete, advance to next word. If all words done, success.
- Wrong key: immediate failure via `fail()`.

**Mobile input:** A hidden `<input>` element is auto-focused to trigger the system keyboard. Characters from the input are dispatched as synthetic `KeyboardEvent`s.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1.0 | Formula |
|-----------|-----|-------|-------|---------|
| Word count (min) | 2 | 4 | 5 | `round(2 + d * 3)` |
| Word count (max) | 4 | 6 | 8 | `round(4 + d * 4)` |
| Word pool | short (x2) + medium | short + medium | short + medium + long | Stepped by difficulty |

The actual word count is randomized within the min-max range each game.

Word length categories in `TECH_WORDS`:
- **short**: 4-5 characters (e.g., port, bash, ping, node)
- **medium**: 6-7 characters (e.g., kernel, cipher, socket)
- **long**: 8+ characters (e.g., firewall, protocol, bandwidth)

## Power-Up Support

| Power-Up | Source | Effect Type | Behaviour |
|----------|--------|-------------|-----------|
| **Autocorrect** (`reverse-trainer`, 4 tiers) | Meta upgrade | `minigame-specific` | Shows 25/50/75/100% of words in normal order (not mirrored) in Decrypt Signal. Corrected words are marked with a green checkmark. The remaining words are still mirrored. |
| **Delay Injector** (`delay-injector`) | Meta upgrade (global) | `global-time-bonus` | Time limit multiplied by `1.03^tier`. |
| **Difficulty Reducer** (`difficulty-reducer`) | Meta upgrade (global) | `difficulty-reduction` | Effective difficulty multiplied by `0.95^tier`. |

When Autocorrect is active, a fraction of words are randomly selected to display in normal order (marked with a green check). The `expectedAnswers` for corrected words are the display words themselves (no reversal needed). An "AUTOCORRECT ACTIVE" label shows the percentage.

## Controls

### Desktop

- **Letter keys (a-z)** -- type the un-mirrored word character by character. No modifier keys needed.

### Mobile

- **Tap "TAP HERE TO TYPE"** button to open the system keyboard.
- Type using the on-screen keyboard. Input is captured via a hidden input element and dispatched as key events.

## Base Time Limit

**18 seconds.**

Scaling formula: `round(18 * (1 - difficulty * 0.4) * floorScale * 1.03^timerExtTier)`

Where `floorScale = max(0.4, 1 - (floor - 15) * 0.02)` for floors > 15, otherwise 1.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

**Component path:** `src/components/minigames/TypeBackward.tsx`

**Key functions:**
- `getWordPool(difficulty)` -- returns the appropriate word array based on difficulty band.
- `pickRandom<T>(pool, count)` -- shuffles and slices `count` items from the pool.
- `handleKey(e: KeyboardEvent)` -- core input handler: validates each character, advances or fails.

**State variables:**
- `wordIndex: number` -- current word position in the display sequence (0-based).
- `charIndex: number` -- current character position within the current answer.
- `originalWords: string[]` -- the original (un-reversed) words picked for this game.
- `mirroredWords: string[]` -- each original word reversed.
- `displayWords: string[]` -- mirrored words in reversed list order (what the player sees).
- `expectedAnswers: string[]` -- the correct answer for each displayed word.
- `autocorrectFraction: number` -- 0 (no upgrade), or 0.25/0.50/0.75/1.0 from Autocorrect tiers.
- `correctedIndices: Set<number>` -- which original-word indices are shown in normal order.
- `correctedDisplayIndices: Set<number>` -- which display-order indices are corrected (for visual marker).

**Data dependency:** `src/data/words.ts` -- exports `TECH_WORDS` with `short`, `medium`, `long` arrays.

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Word count range | Lines 74-76: `2 + d*3` (min), `4 + d*4` (max) | Adjust multipliers for more/fewer words |
| Word pool composition | `getWordPool()` lines 16-26 | Change difficulty thresholds or pool mixing |
| Word list | `src/data/words.ts` | Add/remove tech words in each length category |
| Base time limit | `MinigameScreen.tsx` `BASE_TIME_LIMITS["type-backward"]: 18` | Increase for more time |
| Autocorrect fractions | `meta-upgrades.ts` `reverse-trainer` effects: 0.25/0.50/0.75/1.0 | Change tier values for more/less correction |
