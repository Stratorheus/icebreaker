# Minigame Reference

Complete technical documentation for all 15 minigames in Icebreaker, ordered alphabetically by internal ID.

---

## 1. checksum-verify

**Display name:** Checksum Verify
**Internal ID:** `checksum-verify`

### Player perspective

A math expression appears on screen (e.g. `23 + 14`). The player types the numeric answer and presses Enter or Space to confirm. Multiple expressions must be solved in series. Wrong answer on confirm ends the game immediately.

### Mechanic

On mount, `getExpressionCount(difficulty)` determines how many expressions to generate (2--5). Each expression is built by `generateExpression(difficulty)` which selects an operator and operand range based on difficulty thresholds. The player types digits (0--9) and optionally a leading minus sign. Pressing Enter/Space triggers `handleConfirm` which parses the input and compares against the pre-computed `answer`. A wrong answer calls `fail()` after a 400 ms flash; a correct answer advances to the next expression (or calls `complete(true)` if all are done).

**Win condition:** All expressions answered correctly.
**Fail conditions:** Wrong answer on confirm, or timer expires.

### Difficulty scaling

| Difficulty range | Operations             | Operand range        | Expression count |
|------------------|------------------------|----------------------|------------------|
| d <= 0.15        | single-digit +/-       | 1--9                 | 2                |
| d <= 0.45        | two-digit +/- one-digit| 10--99 +/- 1--9      | 3                |
| d <= 0.75        | two-digit +/- two-digit| 10--99 +/- 10--99    | 4                |
| d > 0.75         | single-digit multiply OR two-digit add | 2--9 x 2--9 or 10--99 + 10--99 | 5 |

Thresholds are hard-coded in `getExpressionCount` (lines 60--65) and `generateExpression` (lines 15--58).

### Power-up support

- **Calculator module** (`minigame-specific`, minigame `checksum-verify`): When active, shows a partial answer hint next to the expression -- the first digit of the answer followed by "..." (line 300--303).

### Base time limit

**15 seconds**

### Key code locations

| Logic              | File                                                            | Lines   |
|--------------------|-----------------------------------------------------------------|---------|
| Expression generation | `src/components/minigames/ChecksumVerify.tsx`                | 15--65  |
| Confirm handler    | `src/components/minigames/ChecksumVerify.tsx`                   | 131--171|
| Power-up check     | `src/components/minigames/ChecksumVerify.tsx`                   | 97--101 |

### Touch controls

Hidden `<input>` with `inputMode="numeric"` is auto-focused on mount to bring up the system number keyboard. A "TAP HERE TO TYPE" button re-focuses if needed. A dedicated "CONFIRM" button dispatches a synthetic Enter keydown event.

### Tuning guide

- **Expression count:** Adjust thresholds in `getExpressionCount` (lines 60--65).
- **Operation complexity:** Modify operand ranges and operator selection in `generateExpression` (lines 15--58).
- **Confirm flash duration:** Change the 400 ms delay in `handleConfirm` (line 149 for fail, line 160 for success advance).

---

## 2. cipher-crack

**Display name:** Cipher Crack V1
**Internal ID:** `cipher-crack`

### Player perspective

An encrypted word is displayed with a method label (e.g. "SWAP positions 2 and 3" or "VOWELS REMOVED" or "LETTERS SCRAMBLED"). The player mentally decodes the word and types the original plaintext letter by letter. Any wrong letter is an immediate failure.

### Mechanic

On mount, a word is picked from a difficulty-scaled pool. A cipher method is selected by `pickMethod(difficulty)`: letter-swap (d < 0.2), remove-vowels (0.2 <= d < 0.5), or scramble (d >= 0.5). The word is encrypted via `encrypt()`. The player types letters via keydown listener; each key is compared against the expected plaintext character at `charIndex`. Correct key advances; wrong key calls `fail()`.

**Win condition:** All characters typed correctly.
**Fail conditions:** Wrong character typed, or timer expires.

### Difficulty scaling

| Difficulty range | Cipher method  | Word pool                          |
|------------------|----------------|------------------------------------|
| d < 0.2          | letter-swap    | `TECH_WORDS.short`                 |
| 0.2 <= d < 0.5   | remove-vowels  | `short + medium`                   |
| d >= 0.5          | scramble       | `medium + long`                    |

Word pool boundaries are at d < 0.35 (short only), d < 0.65 (short + medium), d >= 0.65 (medium + long).

### Power-up support

- **Cipher Hint** (`hint`, minigame `cipher-crack`): Shows the first letter of the answer as a hint (lines 149--154, rendered at line 263--267).

### Base time limit

**12 seconds**

### Key code locations

| Logic            | File                                                     | Lines   |
|------------------|----------------------------------------------------------|---------|
| Cipher methods   | `src/components/minigames/CipherCrack.tsx`               | 18--57  |
| Method selection  | `src/components/minigames/CipherCrack.tsx`               | 102--106|
| Key handler      | `src/components/minigames/CipherCrack.tsx`               | 177--203|

### Touch controls

Hidden `<input>` with `inputMode="text"` is auto-focused on mount. "TAP HERE TO TYPE" button for re-focus. Each character typed into the hidden input is re-dispatched as a synthetic keydown event.

### Tuning guide

- **Cipher method thresholds:** Adjust `pickMethod` (lines 102--106).
- **Word pool boundaries:** Adjust `getWordPool` (lines 96--100).
- **To add new cipher methods:** Add a case to the `CipherMethod` type, `encrypt()`, `buildMethodLabel()`, and `buildExamples()`.

---

## 3. cipher-crack-v2

**Display name:** Cipher Crack V2
**Internal ID:** `cipher-crack-v2`

### Player perspective

An encrypted word is shown alongside an always-visible alphabet reference chart that maps original letters to their ROT-shifted equivalents. The player finds each encrypted letter on the bottom row of the chart, reads the original above, and types the decoded word letter by letter. Any wrong letter is an immediate failure.

### Mechanic

Same typing mechanic as Cipher Crack V1 but uses **only** ROT ciphers (ROT-1 to ROT-3). The `AlphabetChart` component renders a 2-row grid (original on top, shifted on bottom) split into A--M and N--Z halves. The player looks up each encrypted letter on the bottom row to find the plaintext above. `rotChar` applies the shift; `rotWord` applies it to the whole word.

**Win condition:** All characters typed correctly.
**Fail conditions:** Wrong character typed, or timer expires.

### Difficulty scaling

| Difficulty range | Behavior                        | Word pool            |
|------------------|---------------------------------|----------------------|
| d < 0.35         | Plain ROT-1 to ROT-3           | `TECH_WORDS.short`   |
| 0.35 <= d < 0.65 | Plain ROT-1 to ROT-3           | `short + medium`     |
| d >= 0.65         | Plain ROT-1 to ROT-3           | `medium + long`      |

The doc comment (lines 114--117) mentions reverse+ROT at d >= 0.5, but the current implementation always uses plain ROT (pickMethod returns "rot" regardless of difficulty). ROT shift is always 1--3 (`pickRotN`, line 53--56).

### Power-up support

- **Cipher Hint** (`hint`, minigame `cipher-crack-v2`): Shows the first letter of the answer (lines 134--139, rendered at line 247--251).

### Base time limit

**15 seconds**

### Key code locations

| Logic              | File                                                        | Lines   |
|--------------------|-------------------------------------------------------------|---------|
| ROT encryption     | `src/components/minigames/CipherCrackV2.tsx`                | 15--27  |
| Alphabet chart     | `src/components/minigames/CipherCrackV2.tsx`                | 68--101 |
| Key handler        | `src/components/minigames/CipherCrackV2.tsx`                | 162--188|

### Touch controls

Same as Cipher Crack V1: hidden `<input>` with `inputMode="text"`, auto-focused on mount, with a "TAP HERE TO TYPE" re-focus button.

### Tuning guide

- **ROT shift range:** Change `pickRotN` (lines 53--56) to allow larger shifts.
- **Word length at difficulty:** Adjust `getWordPool` thresholds (lines 43--47).
- **Enable reverse+ROT:** Implement the reverse pre-processing hinted in the doc comment at the `encrypt` function level.

---

## 4. close-brackets

**Display name:** Code Inject
**Internal ID:** `close-brackets`

### Player perspective

A sequence of opening brackets is displayed (e.g. `( [ { \`). The player must type the matching closing brackets in reverse order (stack-style: `/ } ] )`). Each correct closer appears inline; a wrong key fails immediately.

### Mechanic

On mount, `bracketCount` random openers are chosen from the pool `( [ { < | \`. The expected closers are the mapped counterparts in reverse sequence order. The player presses closer keys (`) ] } > | /`); each press is compared against `expectedClosers[currentIndex]`. Correct increments index; when all matched, `complete(true)` is called. Wrong key calls `fail()`.

**Win condition:** All closing brackets typed in correct reverse order.
**Fail conditions:** Wrong closer key pressed, or timer expires.

### Difficulty scaling

Bracket count uses range-based scaling:

| Difficulty | Min brackets | Max brackets |
|------------|-------------|-------------|
| d = 0      | 2           | 4           |
| d = 1      | 6           | 8           |

Formula: `bracketMin = round(2 + d * 4)`, `bracketMax = round(4 + d * 4)`, actual count is random within range.

### Power-up support

- **Next Char Hint** (`hint` or `minigame-specific`, minigame `close-brackets`): Shows the next expected closer character in a large box below the sequence (lines 45--51, rendered at lines 216--235).
- **Bracket Reducer** (`minigame-specific`, minigame `close-brackets`): Removes `\` and `|` from the opener pool, making the game use only `( [ { <` (lines 54--65).
- **Bracket Auto-Close** (`auto-close`, minigame `close-brackets`): Pre-fills N closers from the start, skipping that many inputs (lines 89--101).

### Base time limit

**8 seconds**

### Key code locations

| Logic            | File                                                      | Lines   |
|------------------|-----------------------------------------------------------|---------|
| Bracket pairs    | `src/components/minigames/CloseBrackets.tsx`              | 9--16   |
| Count scaling    | `src/components/minigames/CloseBrackets.tsx`              | 68--70  |
| Key handler      | `src/components/minigames/CloseBrackets.tsx`              | 108--132|
| Auto-close calc  | `src/components/minigames/CloseBrackets.tsx`              | 89--97  |

### Touch controls

`<TouchControls type="brackets" />` renders on-screen bracket closer buttons that dispatch the corresponding key events.

### Tuning guide

- **Bracket count range:** Modify formulas at lines 68--70.
- **Available bracket types:** Edit `BRACKET_PAIRS` (lines 9--16) and `OPENERS`/`CLOSER_KEYS`.
- **Auto-close amount:** Controlled by the power-up's `effect.value`.

---

## 5. defrag

**Display name:** Defrag
**Internal ID:** `defrag`

### Player perspective

A classic minesweeper grid appears. The player clicks or navigates to cells to uncover them. Numbers indicate adjacent mines; zero-cells cascade open. Flagging suspected mines is optional. The goal is to uncover every non-mine cell. Hitting a mine ends the game.

### Mechanic

`generateBoard(difficulty)` creates a grid shell with no mines. On the first click, `placeMines()` places mines avoiding the clicked cell and its neighbors (guaranteeing a safe opening with flood-fill cascade). `floodFill()` uses BFS to reveal all connected 0-cells. A `revealedCount` state tracks progress; when it equals `safeCellCount` (`totalCells - mineCount`), the player wins.

**Win condition:** `revealedCount >= safeCellCount`.
**Fail conditions:** Uncovering a mine cell (brief 600 ms reveal of all mines, then `fail()`), or timer expires.

### Difficulty scaling

| Difficulty | Grid size | Mine count (raw)    | Mine cap         |
|------------|-----------|---------------------|------------------|
| d = 0      | 5x5       | 2                   | 25% of cells (5) |
| d = 1      | 9x9       | 10                  | 25% of cells (20)|

Formula: `size = round(5 + d * 4)`, `rawMines = round(2 + d * 8)`, capped at `floor(totalCells * 0.20)`.

### Power-up support

None. The component destructures `props` but does not check `activePowerUps`.

### Base time limit

**40 seconds**

### Key code locations

| Logic             | File                                                 | Lines    |
|-------------------|------------------------------------------------------|----------|
| Board generation  | `src/components/minigames/Defrag.tsx`                | 73--88   |
| Mine placement    | `src/components/minigames/Defrag.tsx`                | 94--128  |
| Flood fill (BFS)  | `src/components/minigames/Defrag.tsx`                | 199--230 |
| Uncover handler   | `src/components/minigames/Defrag.tsx`                | 233--273 |
| Win check         | `src/components/minigames/Defrag.tsx`                | 293--299 |

### Touch controls

Tap to uncover (default) or flag (toggle mode). A "MODE: UNCOVER / FLAG" toggle button switches between the two tap behaviors. `<TouchControls type="dpad" />` also renders a D-pad for cursor navigation.

### Tuning guide

- **Grid size:** Change `size = round(5 + d * 4)` at line 74.
- **Mine density:** Adjust the raw formula `round(2 + d * 8)` at line 79, or the 20% cap at line 80.
- **Mine-reveal delay on fail:** Change the 600 ms timeout at line 253.

---

## 6. find-symbol

**Display name:** Address Lookup
**Internal ID:** `find-symbol`

### Player perspective

A target sequence of 2-character hex codes (e.g. `A1`, `FE`) is shown at the top. Below is a grid of hex codes. The player must find and click/select the current target code in the grid, in order. Selecting a wrong cell fails immediately.

### Mechanic

`generatePuzzle(difficulty)` creates a square grid (`cols = round(3 + d * 3)`) and a target sequence (`seqLen = round(2 + d * 3)`). Each target appears at least once in the grid. At higher difficulty (d > 0.4), filler cells are generated using `similarHexCode()` which differs by only one character, creating visual confusion. Selection checks `cell.code === targets[targetIndex]`.

**Win condition:** All targets found in order.
**Fail conditions:** Selecting a cell whose code does not match the current target, or timer expires.

### Difficulty scaling

| Difficulty | Grid size (cols = rows) | Target sequence length | Similar-code fillers       |
|------------|------------------------|------------------------|---------------------------|
| d = 0      | 3x3                    | 2                      | None                      |
| d = 0.5    | ~5x5                   | ~4                     | ~30% chance per filler    |
| d = 1      | 6x6                    | 5                      | ~60% chance per filler    |

### Power-up support

- **Symbol Scanner / Proximity Hint** (`hint`, minigame `find-symbol`): Cells adjacent to the current target pulse with a subtle animation (lines 121--125, computed at lines 292--309).
- **Symbol Magnifier** (`minigame-specific`, minigame `find-symbol`): Scales up the font size of cells matching the current target by 1.3x (lines 128--133, applied at line 339).

### Base time limit

**12 seconds**

### Key code locations

| Logic               | File                                                    | Lines   |
|---------------------|---------------------------------------------------------|---------|
| Puzzle generation   | `src/components/minigames/FindSymbol.tsx`               | 63--99  |
| Similar hex codes   | `src/components/minigames/FindSymbol.tsx`               | 22--32  |
| Selection handler   | `src/components/minigames/FindSymbol.tsx`               | 169--196|
| Proximity hint logic| `src/components/minigames/FindSymbol.tsx`               | 292--309|

### Touch controls

Grid cells are `<button>` elements -- the player taps directly on the matching hex code. No special touch controls component; standard tap interaction.

### Tuning guide

- **Grid size:** Adjust `cols = round(3 + d * 3)` at line 64.
- **Sequence length:** Adjust `seqLen = round(2 + d * 3)` at line 67.
- **Similar-code probability:** Modify the `difficulty * 0.6` multiplier at line 81.

---

## 7. match-arrows

**Display name:** Packet Route
**Internal ID:** `match-arrows`

### Player perspective

A row of arrow slots is displayed. The current arrow is revealed and glows green; the player presses the matching arrow key. Correct input reveals the next arrow. A wrong key fails immediately.

### Mechanic

On mount, a random sequence of arrow directions is generated with a post-process pass ensuring no 3+ consecutive identical arrows. The player presses arrow keys; each press is compared against `sequence[currentIndex]`. Correct match advances; all matched calls `complete(true)`; wrong key calls `fail()`.

**Win condition:** All arrows matched.
**Fail conditions:** Wrong arrow key pressed, or timer expires.

### Difficulty scaling

Row length uses range-based scaling:

| Difficulty | Min arrows | Max arrows |
|------------|-----------|-----------|
| d = 0      | 3         | 5         |
| d = 1      | 7         | 10        |

Formula: `rowMin = round(3 + d * 4)`, `rowMax = round(5 + d * 5)`.

### Power-up support

- **Peek-Ahead** (`peek-ahead`): Reveals additional arrows ahead of the current position. If value < 1 it is treated as a fraction of row length; if >= 1 it is a fixed count (lines 41--56). Peeked arrows appear in yellow.
- **Direction Hint** (`hint`, minigame `match-arrows`): Shows a large "Press [arrow]" indicator below the row for the current arrow (lines 59--63, rendered at lines 183--202).

### Base time limit

**8 seconds**

### Key code locations

| Logic              | File                                                     | Lines  |
|--------------------|----------------------------------------------------------|--------|
| Sequence generation| `src/components/minigames/MatchArrows.tsx`               | 68--82 |
| Row length scaling | `src/components/minigames/MatchArrows.tsx`               | 36--38 |
| Key handler        | `src/components/minigames/MatchArrows.tsx`               | 93--117|
| Peek-ahead calc    | `src/components/minigames/MatchArrows.tsx`               | 41--56 |

### Touch controls

`<TouchControls type="dpad" />` renders a 4-direction D-pad below the arrow row.

### Tuning guide

- **Row length range:** Modify formulas at lines 36--38.
- **Consecutive duplicate limit:** Adjust the post-processing loop at lines 74--79 (currently caps at 2).
- **Peek-ahead visibility:** Controlled by the power-up's `effect.value`.

---

## 8. mine-sweep

**Display name:** Memory Scan
**Internal ID:** `mine-sweep`

### Player perspective

Phase 1 (PREVIEW): A grid is shown with corrupted sectors highlighted in magenta. A sub-timer counts down. Phase 2 (MARK): Sectors hide. The player marks cells where they remember corrupted sectors. Marking a wrong cell fails immediately. When the correct number of cells is marked, the game auto-completes.

### Mechanic

`generateGrid(difficulty)` creates a grid with random mine positions and a preview duration. The component starts in `"preview"` phase with a requestAnimationFrame-based sub-timer. When the preview expires, it transitions to `"mark"` phase. `toggleMark()` checks if the marked cell is actually a mine; if not, `fail()`. When `markedCells.size === mineCount`, `complete(true)` is called.

**Win condition:** All mines marked correctly (auto-checked when mark count equals mine count).
**Fail conditions:** Marking a non-mine cell, or timer expires.

### Difficulty scaling

| Difficulty | Grid size | Mine count (raw) | Mine cap     | Preview duration |
|------------|-----------|------------------|--------------|------------------|
| d = 0      | 3x3       | 3                | 40% (3)      | 3000 ms          |
| d = 0.5    | ~5x5      | ~7               | 40% (10)     | 2000 ms          |
| d = 1      | 6x6       | 10               | 40% (14)     | 1000 ms          |

Formulas: `size = round(3 + d * 3)`, `rawMines = round(3 + d * 7)`, cap at `floor(totalCells * 0.4)`, `previewMs = (3 - d * 2) * 1000`.

### Power-up support

- **Sector Scanner** (`flag-mine`, minigame `mine-sweep`): Auto-flags N mines when the mark phase begins -- these start pre-marked and cannot be un-marked (lines 78--86, initialized at line 183).
- **Mines Visible** (`minigame-specific`, minigame `mine-sweep`): A percentage of mines remain faintly visible (dimmed magenta) during the mark phase (lines 89--97, rendered at line 329).

### Base time limit

**15 seconds**

### Key code locations

| Logic              | File                                                   | Lines   |
|--------------------|--------------------------------------------------------|---------|
| Grid generation    | `src/components/minigames/MineSweep.tsx`               | 32--56  |
| Preview timer      | `src/components/minigames/MineSweep.tsx`               | 143--167|
| Toggle mark handler| `src/components/minigames/MineSweep.tsx`               | 191--226|
| Auto-complete check| `src/components/minigames/MineSweep.tsx`               | 229--236|
| Auto-flag setup    | `src/components/minigames/MineSweep.tsx`               | 109--128|

### Touch controls

Grid cells are `<button>` elements for direct tap marking. Arrow keys + Enter/Space also work via `useKeyboard`. No special touch component beyond the buttons.

### Tuning guide

- **Grid size:** Adjust `size = round(3 + d * 3)` at line 33.
- **Mine count:** Adjust `round(3 + d * 7)` at line 39, or the 40% cap at line 40.
- **Preview duration:** Adjust `(3 - d * 2) * 1000` at line 42.

---

## 9. network-trace

**Display name:** Network Trace
**Internal ID:** `network-trace`

### Player perspective

A maze is rendered with neon-cyan CSS border walls. The player navigates a diamond cursor from the entry point (top-left) to the target server (bottom-right, pulsing magenta circle). Walls block movement. The only way to fail is by running out of time.

### Mechanic

On mount, `generateMaze(cellSize, cellSize)` produces a perfect maze via recursive backtracking (iterative stack). The maze uses edge-based walls per cell (north/south/east/west booleans). `tryMove(dr, dc)` checks the wall in the direction of movement before allowing position update. Win is triggered when `playerRow === end[0] && playerCol === end[1]`.

The maze generator (`src/lib/maze-generator.ts`) initializes all walls, then carves passages by removing walls between visited and unvisited neighbors. This guarantees exactly one path between any two cells (perfect maze).

**Win condition:** Reaching the end cell `[rows-1, cols-1]`.
**Fail conditions:** Timer expires (no other fail condition).

### Difficulty scaling

| Difficulty | Maze cell dimensions (rows = cols) | Cell pixel size |
|------------|------------------------------------|-----------------|
| d = 0      | 5x5                                | 40 px           |
| d = 0.5    | 8x8                                | 24 px           |
| d = 1      | 11x11                              | 18 px           |

Formula: `cellSize = round(5 + d * 6)`. Visual cell pixel size adapts: 40 px (cols <= 5), 32 px (cols <= 7), 24 px (cols <= 9), 18 px (cols > 9).

### Power-up support

- **Path Highlight** (`minigame-specific`, minigame `network-trace`): On mount, the BFS-computed shortest path is highlighted in green for 1 second, then fades. Uses `solveMaze()` (lines 13--55) and a 1-second timeout (lines 97--102).

### Base time limit

**20 seconds**

### Key code locations

| Logic              | File                                                      | Lines   |
|--------------------|-----------------------------------------------------------|---------|
| Maze generation    | `src/lib/maze-generator.ts`                               | 33--124 |
| BFS solver         | `src/components/minigames/NetworkTrace.tsx`                | 13--55  |
| Movement handler   | `src/components/minigames/NetworkTrace.tsx`                | 127--150|
| Win check          | `src/components/minigames/NetworkTrace.tsx`                | 118--124|
| Path highlight     | `src/components/minigames/NetworkTrace.tsx`                | 75--102 |

### Touch controls

`<TouchControls type="dpad" />` renders a 4-direction D-pad for maze navigation.

### Tuning guide

- **Maze size:** Adjust `cellSize = round(5 + d * 6)` at line 83.
- **Start/end positions:** Currently fixed at `[0,0]` and `[rows-1, cols-1]` in the generator (line 117--123 of maze-generator.ts).
- **Path highlight duration:** Change the 1000 ms timeout at line 100.

---

## 10. port-scan

**Display name:** Port Scan
**Internal ID:** `port-scan`

### Player perspective

Phase 1 (DISPLAY): A grid of real port numbers is shown. "Open" ports flash green one at a time while the timer is paused. Phase 2 (SELECT): The timer starts. The player must select all ports that flashed. Selecting a wrong port fails immediately. Selecting all correct ports wins.

### Mechanic

`getParams(difficulty)` determines grid size, open port count, and flash duration. `generatePuzzle(params)` picks random ports from `PORT_POOL` (49 well-known ports) and randomly designates `openCount` as open. During the display phase, ports flash sequentially via setTimeout chain with timer paused. After all flashes, the phase switches to `"select"` and `timer.start()` resumes. `handleToggle()` validates selections: wrong port = `fail()`, all correct found = `complete(true)`.

**Win condition:** All open ports selected correctly.
**Fail conditions:** Selecting a non-open port, or timer expires.

### Difficulty scaling

| Difficulty | Grid size | Open ports | Flash duration per port |
|------------|-----------|-----------|------------------------|
| d = 0      | 3x3 (9)  | 2         | 700 ms                 |
| d = 0.5    | 4x4 (16) | 4         | 400 ms                 |
| d = 1      | 5x5 (25) | 6         | 250 ms                 |

Formulas: `gridSize = round(3 + d * 2)`, `openCount = round(2 + d * 4)`, `flashMs = round(700 - d * 450)`.

### Power-up support

- **Deep Scan** (`minigame-specific`, minigame `port-scan`): Flashes the entire open-port sequence `effect.value` times (default: once; Deep Scan typically sets it to 2). See lines 91--96, applied at lines 167--186.

### Base time limit

**15 seconds**

### Key code locations

| Logic              | File                                                  | Lines   |
|--------------------|-------------------------------------------------------|---------|
| Params calculation | `src/components/minigames/PortScan.tsx`               | 28--36  |
| Puzzle generation  | `src/components/minigames/PortScan.tsx`               | 56--67  |
| Display phase      | `src/components/minigames/PortScan.tsx`               | 154--203|
| Toggle handler     | `src/components/minigames/PortScan.tsx`               | 206--262|

### Touch controls

Grid cells are `<button>` elements for direct tap. Arrow keys + Space also supported via `useKeyboard` for cursor-based navigation on desktop.

### Tuning guide

- **Grid size / open count / flash speed:** Adjust `getParams` (lines 28--36).
- **Port pool:** Edit `PORT_POOL` array (lines 10--16).
- **Gap between flashes:** Modify `gapMs = Math.max(150, ms * 0.4)` at line 161.
- **Flash repeat count:** Controlled by the Deep Scan power-up's `effect.value`.

---

## 11. signal-echo

**Display name:** Signal Echo
**Internal ID:** `signal-echo`

### Player perspective

Four colored panels are arranged in a diamond: cyan (up), magenta (right), green (down), orange (left). A sequence lights up panel by panel, then the player must repeat it using arrow keys or by tapping the panels. Each successful round adds one more step. Any wrong input fails immediately.

### Mechanic

Simon Says-style. Initial sequence length is `startLength = round(3 + d * 2)`. After each successful repetition, a random direction is appended and a new display phase begins. Timer is PAUSED during display phases and RUNNING during input phases (`timer.pause()` / `timer.start()`). The total number of rounds is `totalRounds = round(3 + d * 2)`.

**Win condition:** Completing all `totalRounds` rounds.
**Fail conditions:** Wrong panel pressed during input phase, or timer expires.

### Difficulty scaling

| Difficulty | Start sequence length | Display speed (ms/panel) | Total rounds |
|------------|-----------------------|--------------------------|--------------|
| d = 0      | 3                     | 800 ms                   | 3            |
| d = 0.5    | 4                     | 550 ms                   | 4            |
| d = 1      | 5                     | 300 ms                   | 5            |

Formulas: `startLength = round(3 + d * 2)`, `displayMs = round(800 - d * 500)`, `totalRounds = round(3 + d * 2)`.

Gap between panel lights: `gapMs = max(150, displayMs * 0.4)`.

### Power-up support

- **Slow Replay** (`minigame-specific`, minigame `signal-echo`): Increases display duration by 30% (`displayMs *= 1.3`), making sequences easier to memorize (lines 82--86, applied at lines 92--93).

### Base time limit

**20 seconds**

### Key code locations

| Logic              | File                                                     | Lines   |
|--------------------|----------------------------------------------------------|---------|
| Panel definitions  | `src/components/minigames/SignalEcho.tsx`                | 20--53  |
| Difficulty params  | `src/components/minigames/SignalEcho.tsx`                | 89--98  |
| Display sequence   | `src/components/minigames/SignalEcho.tsx`                | 159--204|
| Input handler      | `src/components/minigames/SignalEcho.tsx`                | 226--274|

### Touch controls

The four panels are large `<button>` elements that the player taps directly. No separate touch controls component needed; the diamond layout is inherently touch-friendly.

### Tuning guide

- **Starting sequence length / total rounds:** Adjust `startLength` and `totalRounds` at lines 90 and 95.
- **Display speed:** Adjust `displayMs` formula at line 91.
- **Slow Replay multiplier:** Change the 1.3 factor at line 93.
- **Initial delay before sequence plays:** Change `initialDelay = 400` at line 171.

---

## 12. slash-timing

**Display name:** Slash Timing
**Internal ID:** `slash-timing`

### Player perspective

A large central indicator cycles through three phases: GUARD (cyan shield), PREPARE (orange warning), and STRIKE (green sword). The player must press Space (or tap) only during the green STRIKE window. Pressing during GUARD or PREPARE fails immediately. Missing the STRIKE window restarts the cycle.

### Mechanic

Three-phase cycle driven by `setTimeout` chains: `startGuard()` sets the guard phase for a random duration, transitions to prepare, then to attack. If the player presses Space during attack, `complete(true)`. If during guard/prepare, `fail()`. If the attack window expires without input, the cycle restarts from guard.

**Win condition:** Pressing Space during the attack phase.
**Fail conditions:** Pressing Space during guard or prepare phase, or timer expires.

### Difficulty scaling

| Parameter         | d = 0     | d = 1     | Formula                              |
|-------------------|-----------|-----------|--------------------------------------|
| Attack window     | 800 ms    | 300 ms    | `800 - d * 500`                      |
| Prepare duration  | 500 ms    | 200 ms    | `500 - d * 300`                      |
| Guard min duration| 1000 ms   | 600 ms    | `1000 - d * 400`                     |
| Guard max duration| 2000 ms   | 1200 ms   | `2000 - d * 800`                     |

Actual guard duration is randomized between min and max each cycle.

### Power-up support

- **Window Extend** (`window-extend`, optionally scoped to minigame `slash-timing`): Widens the attack window by a percentage. `bonus` accumulates from all matching power-ups; final window = `baseAttackWindow * (1 + bonus)` (lines 26--39).

### Base time limit

**8 seconds**

### Key code locations

| Logic             | File                                                      | Lines  |
|-------------------|-----------------------------------------------------------|--------|
| Duration formulas | `src/components/minigames/SlashTiming.tsx`                | 37--42 |
| Phase cycle       | `src/components/minigames/SlashTiming.tsx`                | 69--97 |
| Space handler     | `src/components/minigames/SlashTiming.tsx`                | 109--125|
| Window extend calc| `src/components/minigames/SlashTiming.tsx`                | 26--34 |

### Touch controls

The entire central indicator `<div>` has an `onClick={handleSpace}` handler, so the player can tap anywhere on the indicator to strike. No separate touch controls component.

### Tuning guide

- **Attack window:** Adjust `800 - d * 500` at line 37.
- **Prepare duration:** Adjust `500 - d * 300` at line 40.
- **Guard duration range:** Adjust the min/max formulas at lines 41--42.
- **Window extend multiplier:** Controlled by the power-up's `effect.value` (a fraction like 0.2 = 20% wider).

---

## 13. subnet-scan

**Display name:** Subnet Scan
**Internal ID:** `subnet-scan`

### Player perspective

A CIDR range (e.g. `192.168.1.0/24`) is displayed at the top. Below is a list of IP addresses. The player must select all addresses that belong to the displayed subnet. A help box at the bottom explains the subnet mask. Selecting a wrong address fails immediately.

### Mechanic

`getParams(difficulty)` determines total addresses, correct count, and available prefix lengths. `generatePuzzle(params)` picks a random private subnet, generates correct (in-subnet) addresses, and incorrect (near-miss) addresses using `generateNearbyOutOfSubnet()` which tweaks network-significant octets. `isInSubnet()` does bitwise AND comparison. `handleToggle()` validates each selection.

**Win condition:** All correct addresses selected.
**Fail conditions:** Selecting an out-of-subnet address, or timer expires.

### Difficulty scaling

| Difficulty range | Total addresses | Correct count | Prefix options     |
|------------------|----------------|---------------|--------------------|
| d < 0.3          | 4              | 1             | /8, /16, /24       |
| 0.3 <= d <= 0.6  | 6              | 2--3          | /16, /24           |
| d > 0.6          | 6              | 3--4          | /20, /22, /24      |

At higher difficulty, non-aligned prefixes (/20, /22) require understanding partial-octet matching.

### Power-up support

- **CIDR Helper** (`minigame-specific`, minigame `subnet-scan`): Shows the expanded IP range (first address -- last address) below the CIDR notation (lines 284--288, rendered at lines 440--444).

### Base time limit

**20 seconds**

### Key code locations

| Logic              | File                                                     | Lines   |
|--------------------|----------------------------------------------------------|---------|
| IP/subnet helpers  | `src/components/minigames/SubnetScan.tsx`                | 13--32  |
| Params by difficulty| `src/components/minigames/SubnetScan.tsx`               | 44--54  |
| Puzzle generation  | `src/components/minigames/SubnetScan.tsx`                | 73--142 |
| Near-miss IP gen   | `src/components/minigames/SubnetScan.tsx`                | 145--194|
| Toggle handler     | `src/components/minigames/SubnetScan.tsx`                | 330--385|
| Mask help text     | `src/components/minigames/SubnetScan.tsx`                | 225--259|

### Touch controls

Address list items are `<button>` elements for direct tap. Arrow keys Up/Down + Space also supported for keyboard cursor navigation.

### Tuning guide

- **Address counts and prefix options:** Adjust `getParams` (lines 44--54).
- **Near-miss generation strategy:** Modify `generateNearbyOutOfSubnet` (lines 145--194) to control how similar wrong answers look.
- **Mask help text:** Edit `getMaskHelp` and `getMaskDetail` (lines 225--259).

---

## 14. type-backward

**Display name:** Decrypt Signal
**Internal ID:** `type-backward`

### Player perspective

A row of mirrored (reversed) words is displayed in scrambled order. The player reads each mirrored word, figures out the original, and types it letter by letter. Any wrong key fails immediately. All words must be decoded to succeed.

### Mechanic

On mount, `wordCount` words are picked from a difficulty-scaled pool (`TECH_WORDS.short/medium/long`). Each word is reversed. The reversed words are displayed in reverse list order. The player types the un-mirrored answer for each displayed word. Each keydown is compared against `expectedAnswers[wordIndex][charIndex]`. Correct advances; wrong calls `fail()`.

**Win condition:** All words typed correctly.
**Fail conditions:** Wrong letter typed, or timer expires.

### Difficulty scaling

Word count uses range-based scaling:

| Difficulty | Min words | Max words | Word pool                                |
|------------|----------|----------|------------------------------------------|
| d = 0      | 2        | 4        | mostly `short`, some `medium` (d < 0.3)  |
| d = 0.5    | ~4       | ~6       | `short + medium` (0.3 <= d < 0.6)        |
| d = 1      | 5        | 8        | all pools including `long` (d >= 0.6)    |

Formulas: `wordCountMin = round(2 + d * 3)`, `wordCountMax = round(4 + d * 4)`.

### Power-up support

- **Type Assist / First Letter Hint** (`hint`, minigame `type-backward`): Shows the first letter of the current expected answer (lines 60--64, rendered at lines 238--242).
- **Reverse Trainer** (`minigame-specific`, minigame `type-backward`): Displays words in normal (un-mirrored) order instead of reversed -- the player just types what they see (lines 67--71, applied at lines 93--99 and 106--109).

### Base time limit

**18 seconds**

### Key code locations

| Logic             | File                                                       | Lines   |
|-------------------|------------------------------------------------------------|---------|
| Word pool by diff | `src/components/minigames/TypeBackward.tsx`                | 15--26  |
| Word count scaling| `src/components/minigames/TypeBackward.tsx`                | 73--76  |
| Mirror + display  | `src/components/minigames/TypeBackward.tsx`                | 86--109 |
| Key handler       | `src/components/minigames/TypeBackward.tsx`                | 129--170|

### Touch controls

Hidden `<input>` with `inputMode="text"` is auto-focused on mount for system keyboard. "TAP HERE TO TYPE" button for re-focus. Characters typed into the hidden input are re-dispatched as synthetic keydown events.

### Tuning guide

- **Word count range:** Modify formulas at lines 73--76.
- **Word pool boundaries:** Adjust `getWordPool` (lines 15--26).
- **To change word lists:** Edit `TECH_WORDS` in `src/data/words.ts`.

---

## 15. wire-cutting

**Display name:** Wire Cutting
**Internal ID:** `wire-cutting`

### Player perspective

A set of colored wires is displayed alongside a rule panel. Rules describe the correct cutting order (e.g. "Cut RED first", "DO NOT CUT GREEN", "Cut BLUE before YELLOW"). The player reads the rules, deduces the order, and presses number keys or taps wires to cut them. Wrong cut order fails immediately.

### Mechanic

`generatePuzzle(wireCount, difficulty)` picks N random wire colors (from 8 available), optionally marks some as "DO NOT CUT" (skipped), generates a random cutting order for the remaining wires, and builds human-readable rules via `buildRules()`. Rules may use positional labels ("first", "second"), relative ordering ("before"), or "alphabetical order". `handleNumberPress()` compares the cut wire index against `correctOrder[cutIndex]`.

**Win condition:** All cuttable wires cut in the correct order.
**Fail conditions:** Cutting a wire out of order, or timer expires.

### Difficulty scaling

| Difficulty | Wire count | Max skipped wires | Rule complexity          |
|------------|-----------|-------------------|--------------------------|
| d = 0      | 3         | 0                 | 2 rules max              |
| d = 0.3    | ~4        | 0                 | 2 rules                  |
| d = 0.5    | ~5        | 0--1              | 3 rules + alphabetical possible |
| d = 0.7    | ~6        | 1                 | 3 rules                  |
| d = 1      | 7         | 0--2              | 4 rules                  |

Formula: `wireCount = round(3 + d * 4)`. Skip count: `maxSkips = 0 (d<0.3), 1 (d<0.7), min(2, wireCount-2) (d>=0.7)`.

### Power-up support

- **Wire Order Hint** (`hint`, minigame `wire-cutting`): Highlights the next wire to cut with a pulsing border glow (lines 204--208, rendered at lines 310 and 358--363).

### Base time limit

**12 seconds**

### Key code locations

| Logic             | File                                                      | Lines   |
|-------------------|-----------------------------------------------------------|---------|
| Puzzle generation | `src/components/minigames/WireCutting.tsx`                | 66--83  |
| Rule building     | `src/components/minigames/WireCutting.tsx`                | 85--181 |
| Cut handler       | `src/components/minigames/WireCutting.tsx`                | 231--258|
| Wire count formula| `src/components/minigames/WireCutting.tsx`                | 211     |

### Touch controls

Each wire `<div>` has an `onClick` handler. The player taps the wire directly to cut it. Number keys 1--9 are also bound via `useKeyboard` for desktop.

### Tuning guide

- **Wire count:** Adjust `round(3 + d * 4)` at line 211.
- **Skip/DO-NOT-CUT logic:** Modify `maxSkips` calculation at line 70.
- **Rule generation style:** Edit `buildRules` (lines 85--181) to add new rule types or change how many rules are generated per difficulty tier.
- **Available wire colors:** Edit `ALL_COLORS` (lines 9--18).

---

## Summary Table

| Internal ID       | Display Name      | Base Time | Primary Input      | Fail Mode         |
|--------------------|-------------------|-----------|--------------------|-------------------|
| `checksum-verify`  | Checksum Verify   | 15s       | Number keys + Enter| Wrong answer      |
| `cipher-crack`     | Cipher Crack V1   | 12s       | Letter keys        | Wrong letter      |
| `cipher-crack-v2`  | Cipher Crack V2   | 15s       | Letter keys        | Wrong letter      |
| `close-brackets`   | Code Inject       | 8s        | Bracket keys       | Wrong closer      |
| `defrag`           | Defrag            | 40s       | Click/keys + Space | Hit mine          |
| `find-symbol`      | Address Lookup    | 12s       | Click/keys + Enter | Wrong cell        |
| `match-arrows`     | Packet Route      | 8s        | Arrow keys         | Wrong arrow       |
| `mine-sweep`       | Memory Scan       | 15s       | Click/keys + Space | Wrong mark        |
| `network-trace`    | Network Trace     | 20s       | Arrow keys         | Timeout only      |
| `port-scan`        | Port Scan         | 15s       | Click/keys + Space | Wrong port        |
| `signal-echo`      | Signal Echo       | 20s       | Arrow keys / tap   | Wrong panel       |
| `slash-timing`     | Slash Timing      | 8s        | Space / tap        | Wrong phase press |
| `subnet-scan`      | Subnet Scan       | 20s       | Click/keys + Space | Wrong address     |
| `type-backward`    | Decrypt Signal    | 18s       | Letter keys        | Wrong letter      |
| `wire-cutting`     | Wire Cutting      | 12s       | Number keys / tap  | Wrong wire order  |
