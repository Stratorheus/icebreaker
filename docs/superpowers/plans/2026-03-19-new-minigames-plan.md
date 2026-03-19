# New Minigames Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 new minigames, split cipher into V1/V2, rename existing games for cyberpunk theme, and implement escalating unlock pricing.

**Architecture:** Each minigame is an isolated React component receiving `MinigameProps` and returning via `onComplete`. New types added to `MinigameType` union. MinigameScreen wiring (component map, time limits, meta power-ups) extended. Unlock model changed from fixed prices to escalating per-unlock pricing.

**Tech Stack:** React 19, TypeScript, Zustand, existing hooks (useMinigame, useKeyboard, useGameTimer)

**Spec:** `docs/superpowers/specs/2026-03-19-new-minigames-design.md`

---

## File Structure

```
src/
├── types/game.ts                              # Add 8 new MinigameType values
├── data/
│   ├── meta-upgrades.ts                       # Add 8 new unlock entries, change pricing model
│   ├── achievements.ts                        # Add achievements for new minigames
│   └── minigame-names.ts                      # NEW: display name map (cyberpunk names)
├── components/
│   ├── screens/
│   │   ├── MinigameScreen.tsx                 # Add to component map, time limits, meta power-ups
│   │   ├── Training.tsx                       # Add briefings for new minigames
│   │   └── Codex.tsx                          # Will auto-pick up new minigames via store
│   └── minigames/
│       ├── Defrag.tsx                         # NEW: classic minesweeper
│       ├── NetworkTrace.tsx                   # NEW: maze navigation
│       ├── DataStream.tsx                     # NEW: snake/ZIP puzzle
│       ├── SignalEcho.tsx                     # NEW: Simon Says
│       ├── ChecksumVerify.tsx                 # NEW: quick math
│       ├── PortScan.tsx                       # NEW: reaction memory
│       ├── SubnetScan.tsx                     # NEW: IP range matching
│       └── CipherCrackV2.tsx                  # NEW: ROT ciphers with alphabet chart
├── store/
│   ├── meta-slice.ts                          # Update unlock pricing logic
│   └── run-slice.ts                           # No changes needed (generic minigame handling)
└── lib/
    └── maze-generator.ts                      # NEW: recursive backtracking for NetworkTrace
```

---

## Task 1: Types, Names & Wiring Foundation

**Files:**
- Modify: `src/types/game.ts`
- Create: `src/data/minigame-names.ts`
- Modify: `src/components/screens/MinigameScreen.tsx`
- Modify: `src/data/meta-upgrades.ts`
- Modify: `src/store/meta-slice.ts`

- [ ] **Step 1:** Add new types to `MinigameType` union in `src/types/game.ts`:
```ts
export type MinigameType =
  | "slash-timing" | "close-brackets" | "type-backward" | "match-arrows"
  | "find-symbol" | "mine-sweep" | "wire-cutting" | "cipher-crack"
  | "defrag" | "network-trace" | "data-stream" | "signal-echo"
  | "checksum-verify" | "port-scan" | "subnet-scan" | "cipher-crack-v2";
```
Update `UNLOCKABLE_MINIGAMES` to include all 11 unlockable games.

- [ ] **Step 2:** Create `src/data/minigame-names.ts` — display name map:
```ts
export const MINIGAME_DISPLAY_NAMES: Record<MinigameType, string> = {
  "slash-timing": "Slash Timing",
  "close-brackets": "Code Inject",
  "type-backward": "Decrypt Signal",
  "match-arrows": "Packet Route",
  "mine-sweep": "Memory Scan",
  "find-symbol": "Address Lookup",
  "wire-cutting": "Wire Cutting",
  "cipher-crack": "Cipher Crack V1",
  "defrag": "Defrag",
  "network-trace": "Network Trace",
  "data-stream": "Data Stream",
  "signal-echo": "Signal Echo",
  "checksum-verify": "Checksum Verify",
  "port-scan": "Port Scan",
  "subnet-scan": "Subnet Scan",
  "cipher-crack-v2": "Cipher Crack V2",
};
```

- [ ] **Step 3:** Replace `formatMinigameName()` in `MinigameScreen.tsx` to use the display name map. Also update any other files that call `formatMinigameName` (Training.tsx, Codex.tsx, etc.) — search codebase for all usages.

- [ ] **Step 4:** Add `BASE_TIME_LIMITS` entries for all 8 new minigames in `MinigameScreen.tsx`:
```ts
"defrag": 30,
"network-trace": 20,
"data-stream": 25,
"signal-echo": 20,
"checksum-verify": 15,
"port-scan": 15,
"subnet-scan": 20,
"cipher-crack-v2": 15,
```

- [ ] **Step 5:** Add placeholder entries in `MINIGAME_COMPONENTS` map (import a `PlaceholderMinigame` that auto-completes — will be replaced per-task). This allows the game to run with new types without crashing.

- [ ] **Step 6:** Add 8 new unlock entries to `meta-upgrades.ts`. Change the unlock pricing model: instead of fixed 300◆ each, use escalating pricing. The price is computed dynamically based on how many minigames the player has already unlocked:
```ts
// Nth unlock costs: 200 + (N-1) * 100
// This is computed in MetaShop.tsx, not stored in prices array
```
Set `prices: [0]` as placeholder (MetaShop computes actual price). Add `cipher-crack-v2` with `requires: "cipher-crack"`.

- [ ] **Step 7:** Update `MetaShop.tsx` unlock pricing logic to compute `200 + (unlocksOwned) * 100` dynamically instead of reading from `prices` array. Update the unlock section UI.

- [ ] **Step 8:** Add briefings for all new minigames in `Training.tsx` BRIEFINGS map.

- [ ] **Step 9:** Verify `npx tsc --noEmit` passes. Commit:
```bash
git commit -m "feat: types, names, wiring foundation for 8 new minigames"
```

---

## Task 2: Defrag (classic minesweeper)

**Files:**
- Create: `src/components/minigames/Defrag.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx` (replace placeholder)

- [ ] **Step 1:** Implement `Defrag.tsx`:
- Generate grid (5x5 to 9x9 based on difficulty) with mines placed randomly
- Each cell state: hidden, revealed (number), revealed (mine), flagged
- Space = uncover cell. If mine → fail. If 0 adjacent mines → cascade reveal (BFS/DFS flood fill)
- Enter = toggle flag
- Arrow keys = navigate cursor
- Mouse: left click = uncover, right click = flag
- Win: all non-mine cells revealed
- Fail: uncover a mine, or timeout
- Display: numbers colored by value (1=cyan, 2=green, 3=orange, 4+=magenta), flags as ⚑, hidden as dark cells, cursor highlighted

- [ ] **Step 2:** Wire into MinigameScreen (replace placeholder import).

- [ ] **Step 3:** Verify tsc, commit: `feat: implement Defrag minigame (classic minesweeper)`

---

## Task 3: Network Trace (maze)

**Files:**
- Create: `src/lib/maze-generator.ts`
- Create: `src/components/minigames/NetworkTrace.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Implement `src/lib/maze-generator.ts`:
```ts
export function generateMaze(rows: number, cols: number): { walls: boolean[][]; start: [number, number]; end: [number, number] }
```
Use recursive backtracking. Grid is `(2*rows+1) x (2*cols+1)` with walls between cells. Start = top-left cell, End = bottom-right cell.

- [ ] **Step 2:** Implement `NetworkTrace.tsx`:
- Render maze as grid — walls dark, paths lighter
- Cursor at START (green), END (magenta)
- Arrow keys move cursor (blocked by walls)
- Win: reach END cell
- Fail: timeout only
- Difficulty: d=0 → 5x5 cells (11x11 render), d=0.5 → 8x8 (17x17), d=1 → 11x11 (23x23)

- [ ] **Step 3:** Wire, verify, commit: `feat: implement Network Trace minigame (maze)`

---

## Task 4: Data Stream (snake/ZIP puzzle)

**Files:**
- Create: `src/components/minigames/DataStream.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Implement `DataStream.tsx`:
- Generate solvable puzzle: create Hamiltonian path through grid, place numbered nodes along it
- Snake starts at first cell of path. Arrow keys extend snake in that direction
- Moving opposite to last direction = undo (retract snake)
- Space = reset puzzle (snake back to start)
- Must visit nodes in order (1, 2, 3...) and fill entire grid
- Win: all cells filled + all nodes visited
- Fail: timeout
- Difficulty: d=0 → 4x4 with 2 nodes, d=0.5 → 5x5 with 3, d=1 → 6x6 with 4-5

- [ ] **Step 2:** Wire, verify, commit: `feat: implement Data Stream minigame (snake/ZIP puzzle)`

---

## Task 5: Signal Echo (Simon Says)

**Files:**
- Create: `src/components/minigames/SignalEcho.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Implement `SignalEcho.tsx`:
- 4 colored panels: cyan (↑), magenta (→), green (↓), orange (←)
- Phase cycle: display sequence → player input → add element → repeat
- Timer PAUSES during display phase, runs during input only
- Use `timer.pause()` and `timer.start()` from useMinigame
- Win: complete all required rounds (3 rounds at d=0, 5 at d=1)
- Fail: wrong input in sequence, timeout during input phase
- Difficulty: starting length 3-5, display time 800-300ms per element

- [ ] **Step 2:** Wire, verify, commit: `feat: implement Signal Echo minigame (Simon Says)`

---

## Task 6: Checksum Verify (quick math)

**Files:**
- Create: `src/components/minigames/ChecksumVerify.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Implement `ChecksumVerify.tsx`:
- Generate math expression based on difficulty (see spec for exact scaling)
- Display expression, player types numeric answer
- Number keys + Backspace for input, Enter or Space to confirm
- Wrong answer on confirm = immediate fail
- Multiple expressions in series (2-5 based on difficulty)
- No division, no three-digit numbers, multiplication only single-digit at high difficulty
- Win: all expressions correct
- Fail: wrong answer, timeout

- [ ] **Step 2:** Wire, verify, commit: `feat: implement Checksum Verify minigame (quick math)`

---

## Task 7: Port Scan (reaction memory)

**Files:**
- Create: `src/components/minigames/PortScan.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Implement `PortScan.tsx`:
- Grid of realistic port numbers (22, 80, 443, 3306, 5432, 8080, 8443, etc.)
- Phase 1 (display): ports flash green sequentially. Timer paused.
- Phase 2 (select): player selects which ports flashed. Timer runs.
- Arrow keys + Space to toggle, or mouse click
- Select wrong port = immediate fail. All correct selected = win.
- Shows "x/y selected" counter
- Difficulty: 3x3/2 ports/700ms → 5x5/6 ports/250ms

- [ ] **Step 2:** Wire, verify, commit: `feat: implement Port Scan minigame (reaction memory)`

---

## Task 8: Subnet Scan (IP range matching)

**Files:**
- Create: `src/components/minigames/SubnetScan.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Implement `SubnetScan.tsx`:
- Generate IP range + list of addresses (some in range, some not)
- Display range at top, addresses as selectable list below
- Arrow keys + Space to toggle select, or mouse click
- "x/y selected" counter. Auto-check: wrong select = fail, all correct = win
- Difficulty: d<0.3 → 4 addrs/1 correct/simple masks. d>0.6 → 6 addrs/3-4 correct/tricky masks
- Include brief inline explanation of subnet masks for non-technical players
- IP generation: generate valid range, then create addresses both inside and outside

- [ ] **Step 2:** Wire, verify, commit: `feat: implement Subnet Scan minigame (IP range matching)`

---

## Task 9: Cipher Crack V2 (ROT with alphabet chart)

**Files:**
- Create: `src/components/minigames/CipherCrackV2.tsx`
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Implement `CipherCrackV2.tsx`:
- Copy structure from existing CipherCrack.tsx
- Methods: ROT-1 to ROT-3 (d<0.5), reverse+ROT-1 to ROT-3 (d>=0.5)
- Always show the AlphabetChart component (original→encrypted mapping)
- Same input mechanic as V1: type decrypted word, wrong char = fail

- [ ] **Step 2:** Wire, verify, commit: `feat: implement Cipher Crack V2 minigame (ROT with alphabet)`

---

## Task 10: Integration — achievements, meta power-ups, final wiring

**Files:**
- Modify: `src/data/achievements.ts`
- Modify: `src/components/screens/MinigameScreen.tsx` (buildMetaPowerUps for new games)
- Modify: `src/components/screens/Codex.tsx` (verify new games show up)

- [ ] **Step 1:** Add achievements for new minigames (cumulative win counts, speed achievements).

- [ ] **Step 2:** Verify all 16 minigames show correctly in Codex, Training, and MinigameScreen.

- [ ] **Step 3:** Remove all placeholder minigame entries (ensure no placeholders remain).

- [ ] **Step 4:** Run `npm run build`, fix any issues.

- [ ] **Step 5:** Commit: `feat: integration — achievements, final wiring for all 16 minigames`

---

## Task 11: Version bump & cleanup

- [ ] **Step 1:** Run `npm version minor --no-git-tag-version` → v1.2.0
- [ ] **Step 2:** Final `npm run build` verification
- [ ] **Step 3:** Commit: `chore: bump version to v1.2.0`

---

## Task Dependency Graph

```
Task 1 (foundation — types, names, wiring, placeholders)
  → Tasks 2-9 (individual minigames, can be done sequentially)
    → Task 10 (integration, achievements, cleanup)
      → Task 11 (version bump)
```
