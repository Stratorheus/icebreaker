# New Minigames Expansion — Design Spec

## Overview

Add 7 new minigames + cipher split + rename existing games for better cyberpunk theme. Total: 16 minigames (5 starting, 11 unlockable in meta shop).

## Display Name Renames (internal IDs unchanged)

| Internal ID | Old Display Name | New Display Name |
|-------------|-----------------|-----------------|
| mine-sweep | Mine Sweep | Memory Scan |
| match-arrows | Match Arrows | Packet Route |
| find-symbol | Find Symbol | Address Lookup |
| type-backward | Type Backward | Decrypt Signal |
| close-brackets | Close Brackets | Code Inject |
| slash-timing | Slash Timing | Slash Timing (unchanged) |
| wire-cutting | Wire Cutting | Wire Cutting (unchanged) |
| cipher-crack | Cipher Crack | Cipher Crack V1 |

## New Minigames

### 1. Defrag (classic minesweeper)

**Internal ID:** `defrag`

**Mechanic:** Grid with hidden mines. Click/select a cell — reveals a number (count of adjacent mines) or a mine (fail). Goal: uncover ALL safe cells. Cascade reveal on 0-cells (recursively reveals all neighbors).

**Controls:**
- Keyboard: Arrow keys navigate, Space = uncover, Enter = flag/unflag
- Mouse: Left click = uncover, Right click = flag/unflag

**Difficulty scaling:**
- d=0: 5x5 grid, 3 mines
- d=0.5: 7x7 grid, 8 mines
- d=1.0: 9x9 grid, 14 mines

**Win:** All safe cells uncovered.
**Fail:** Uncover a mine. Timeout.

**Cyberpunk flavor:** Corrupted memory sectors. Numbers = warning level. Mines = corrupted data. "DEFRAGMENTING MEMORY BLOCK..."

### 2. Network Trace (maze)

**Internal ID:** `network-trace`

**Mechanic:** Grid maze with walls and paths. Cursor starts at START (green), must reach END (magenta). Cannot pass through walls.

**Controls:** Arrow keys only. Wall blocks movement (no penalty, just can't go).

**Difficulty scaling:**
- d=0: 7x7 grid, simple path, few dead ends
- d=0.5: 11x11 grid, more dead ends
- d=1.0: 15x15 grid, complex maze

**Generation:** Recursive backtracking algorithm (guarantees solvability). Higher difficulty adds extra dead ends.

**Win:** Reach END cell.
**Fail:** Timeout only.

**Cyberpunk flavor:** Trace route through network topology. Walls = firewalls. START = entry point, END = target server.

### 3. Data Stream (snake/ZIP puzzle)

**Internal ID:** `data-stream`

**Mechanic:** Grid with numbered nodes (1, 2, 3...). Player drags a "snake" (data stream) that must visit all nodes IN ORDER and fill the entire grid. Snake grows with each step (like classic snake but every step extends).

**Rules:**
- Snake cannot cross itself
- Must visit numbered nodes in order (1→2→3→...)
- Must fill entire grid
- Undo: press opposite direction to retract (snake shrinks from tail)
- Reset: Space = restart puzzle from beginning

**Difficulty scaling:**
- d=0: 4x4 grid, 2 nodes
- d=0.5: 5x5 grid, 3 nodes
- d=1.0: 6x6 grid, 4-5 nodes

**Generation:** Start with a Hamiltonian path (guarantees solvability), place nodes along the path.

**Win:** All cells filled, all nodes visited in order.
**Fail:** Timeout only (undo is free).

**Cyberpunk flavor:** Route data stream through network segments. Nodes = relay points.

### 4. Signal Echo (Simon Says)

**Internal ID:** `signal-echo`

**Mechanic:** 4 colored panels (cyan, magenta, green, orange). A sequence lights up, player repeats it. Each successful round adds one element to the sequence.

**Controls:** Arrow keys (↑=cyan, →=magenta, ↓=green, ←=orange) or click on panel.

**Timer behavior:** Timer pauses during sequence display, runs only during player input phase.

**Difficulty scaling:**
- d=0: starting sequence length 3, panels light 800ms, win after 3 rounds
- d=0.5: length 4, light 500ms, win after 4 rounds
- d=1.0: length 5, light 300ms, win after 5 rounds

**Win:** Complete all required rounds.
**Fail:** Wrong input in sequence = immediate fail. Timeout during input phase.

**Cyberpunk flavor:** Intercept and replicate signal patterns. Panels = frequency channels.

### 5. Checksum Verify (quick math)

**Internal ID:** `checksum-verify`

**Mechanic:** Display a simple math expression, player types the answer. Multiple expressions in series.

**Controls:** Number keys to type, Enter or Space to confirm, Backspace to correct.

**Difficulty scaling (kept gentle):**
- d=0: single-digit add/subtract (3+5, 8-2). 2 expressions.
- d=0.3: two-digit ± single-digit (12+7, 25-9). 3 expressions.
- d=0.6: two-digit ± two-digit (23+34, 51-18). 4 expressions.
- d=1.0: single-digit multiplication max 9×9 OR two-digit addition (5×7, 64+28). 5 expressions.
- NO division. NO three-digit numbers.

**Win:** All expressions answered correctly.
**Fail:** Wrong answer on confirm = immediate fail. Timeout.

**Cyberpunk flavor:** Verify packet checksums. "CHECKSUM MISMATCH = BREACH DETECTED"

### 6. Port Scan (reaction memory)

**Internal ID:** `port-scan`

**Mechanic:** Grid of port numbers (22, 80, 443, 8080...). "Open" ports flash green briefly, one by one. Player must select all ports that flashed.

**Phases:**
1. Display: ports flash sequentially (green highlight)
2. Select: player picks which ones flashed

**Controls:** Arrow keys + Space to toggle select, or mouse click.

**Difficulty scaling:**
- d=0: 3x3 grid, 2 open ports, flash 700ms each
- d=0.5: 4x4 grid, 4 open ports, flash 400ms each
- d=1.0: 5x5 grid, 6 open ports, flash 250ms each

**Win/fail:** Select wrong port = immediate fail. All correct selected = win. Timer runs only during select phase.

**Cyberpunk flavor:** Network reconnaissance scan. Identify vulnerable entry points.

### 7. Subnet Scan (IP range matching)

**Internal ID:** `subnet-scan`

**Mechanic:** Display an IP range (e.g., `192.168.1.0/24`). Below it, a list of IP addresses. Player selects addresses that belong to the range. Auto-check: wrong selection = immediate fail. All correct selected = win. Shows "x/y selected" counter.

**Controls:** Arrow keys to navigate list, Space to toggle select, or mouse click. No submit button needed.

**Difficulty scaling (kept gentle):**
- d<0.3: 4 addresses, select 1 correct. Simple masks (/8, /16, /24).
- d 0.3-0.6: 6 addresses, select 2-3 correct. Masks /16, /24.
- d>0.6: 6 addresses, select 3-4 correct. Masks /20, /22, /24. Similar-looking addresses.
- Max difficulty: /20 mask, max 6 addresses.

**Briefing/tutorial explains:** "/24 = first 3 numbers must match. /16 = first 2 must match. /8 = first 1 must match. /20-/22 = partial match in the third number."

**Cyberpunk flavor:** Identify target nodes in a network segment.

## Cipher Crack Split

**Cipher Crack V1 (internal ID: `cipher-crack`):**
- Unlockable in meta shop (existing behavior)
- Methods: letter-swap, remove-vowels, scramble
- No change to component

**Cipher Crack V2 (internal ID: `cipher-crack-v2`):**
- New unlockable, requires V1 as prerequisite
- Methods: ROT-1 to ROT-3 with alphabet chart, reverse+ROT
- Separate component, shares helpers with V1

## Unlock Model

**Starting pool (5):** slash-timing, close-brackets, type-backward, match-arrows, mine-sweep

**Unlockable (11):** All others. Player chooses order freely.

**Pricing:** Escalating per unlock count (not per specific game):
- 1st unlock: 200◆
- 2nd unlock: 300◆
- 3rd unlock: 400◆
- Nth unlock: `200 + (N-1) * 100`◆
- Exception: Cipher V2 requires Cipher V1 as prerequisite

**Per-unlock bonuses (existing):** +5 max HP, +5% credit multiplier per unlock.

## Shared Interface

All minigames receive `MinigameProps` (difficulty, timeLimit, activePowerUps, onComplete) and return `MinigameResult` (success, timeMs, minigame). No changes to the interface.

## Base Time Limits

| Minigame | Base Time (s) |
|----------|--------------|
| defrag | 30 |
| network-trace | 20 |
| data-stream | 25 |
| signal-echo | 20 |
| checksum-verify | 15 |
| port-scan | 15 |
| subnet-scan | 20 |
| cipher-crack-v2 | 15 |
