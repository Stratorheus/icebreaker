# Mobile Touch Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 15 minigames playable on mobile with adaptive touch controls.

**Architecture:** Shared `useTouchDevice()` hook detects touch. A `TouchControls` wrapper renders per-minigame controls (D-pad, bracket buttons, or nothing). Typing games use hidden `<input>` for system keyboard. Tap-based games already work. Each minigame gets mobile instruction text.

**Tech Stack:** React 19, existing hooks, CSS `@media (pointer: coarse)`

**Spec:** `docs/superpowers/specs/2026-03-20-mobile-touch-controls-design.md`

---

## File Structure

```
src/
├── hooks/
│   └── use-touch-device.ts              # NEW: detect touch device
├── components/
│   ├── layout/
│   │   └── TouchControls.tsx            # NEW: adaptive touch control wrapper
│   └── minigames/
│       ├── SlashTiming.tsx              # MODIFY: tap-to-strike
│       ├── CloseBrackets.tsx            # MODIFY: bracket buttons on mobile
│       ├── TypeBackward.tsx             # MODIFY: hidden input for system keyboard
│       ├── MatchArrows.tsx              # MODIFY: D-pad on mobile
│       ├── NetworkTrace.tsx             # MODIFY: D-pad on mobile
│       ├── CipherCrack.tsx             # MODIFY: hidden input
│       ├── CipherCrackV2.tsx           # MODIFY: hidden input
│       ├── ChecksumVerify.tsx          # MODIFY: hidden numeric input
│       ├── WireCutting.tsx             # MODIFY: tap on wires
│       ├── Defrag.tsx                  # MODIFY: long-press to flag
│       ├── MineSweep.tsx               # (already tap-based, instruction text only)
│       ├── FindSymbol.tsx              # (already tap-based, instruction text only)
│       ├── SignalEcho.tsx              # (already tap-based, instruction text only)
│       ├── PortScan.tsx                # (already tap-based, instruction text only)
│       └── SubnetScan.tsx              # (already tap-based, instruction text only)
```

---

## Task 1: Touch Detection Hook + CSS

**Files:**
- Create: `src/hooks/use-touch-device.ts`
- Modify: `src/index.css`

- [ ] **Step 1:** Create `src/hooks/use-touch-device.ts`:
```ts
import { useState, useEffect } from "react";

export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(
      "ontouchstart" in window || navigator.maxTouchPoints > 0
    );
  }, []);
  return isTouch;
}
```

- [ ] **Step 2:** Add CSS utility to `src/index.css`:
```css
/* Hide on touch devices */
@media (pointer: coarse) {
  .desktop-only { display: none !important; }
}
/* Hide on desktop */
@media (pointer: fine) {
  .touch-only { display: none !important; }
}
```

- [ ] **Step 3:** Verify tsc, commit: `feat: touch detection hook + CSS utilities`

---

## Task 2: TouchControls Component (D-pad + Bracket Buttons)

**Files:**
- Create: `src/components/layout/TouchControls.tsx`

- [ ] **Step 1:** Create `TouchControls.tsx` with two sub-components:

**DPad:** 4 directional buttons in cross layout. Each dispatches a `KeyboardEvent` on `window`:
```ts
function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}
```
Buttons: ↑ (ArrowUp), ← (ArrowLeft), ↓ (ArrowDown), → (ArrowRight).

**BracketButtons:** 6 buttons in a row: `)`, `]`, `}`, `>`, `|`, `/`. Each fires the corresponding key event.

**TouchControls wrapper:**
```tsx
interface TouchControlsProps {
  type: "dpad" | "brackets" | "none";
}
```
Renders DPad or BracketButtons based on type. Wrapped in `touch-only` class. Fixed at bottom, `safe-area-inset-bottom` padding.

Styling: dark bg with blur, min 48px buttons, cyan borders, active state glow. `touch-action: manipulation` on all buttons to prevent zoom.

- [ ] **Step 2:** Verify tsc, commit: `feat: TouchControls component — D-pad and bracket buttons`

---

## Task 3: Wire Cutting — Tap on Wires

**Files:**
- Modify: `src/components/minigames/WireCutting.tsx`

- [ ] **Step 1:** Add `onClick` handler to each wire element that fires the same action as pressing the wire's number key. The wire rendering already exists — find the wire elements and add click handlers.

- [ ] **Step 2:** Update instruction text: show "TAP a wire to cut" on touch devices, "Press number key to cut" on desktop. Use `useTouchDevice()` hook or CSS `touch-only`/`desktop-only` classes.

- [ ] **Step 3:** Verify tsc, commit: `feat: Wire Cutting tap-to-cut on mobile`

---

## Task 4: Slash Timing — Tap to Strike

**Files:**
- Modify: `src/components/minigames/SlashTiming.tsx`

- [ ] **Step 1:** Add `onClick`/`onTouchStart` to the main game area container that fires the same handler as Space key press. Only active when the game is in a phase where Space input is accepted.

- [ ] **Step 2:** Update instruction text: "TAP TO STRIKE" on touch, "PRESS SPACE" on desktop.

- [ ] **Step 3:** Verify tsc, commit: `feat: Slash Timing tap-to-strike on mobile`

---

## Task 5: D-pad Games — Packet Route + Network Trace

**Files:**
- Modify: `src/components/minigames/MatchArrows.tsx`
- Modify: `src/components/minigames/NetworkTrace.tsx`

- [ ] **Step 1:** In both components, import `TouchControls` and render `<TouchControls type="dpad" />` below the game area. The D-pad fires keyboard events which the existing `useKeyboard` hooks already handle — no game logic changes needed.

- [ ] **Step 2:** Update instruction text in both: hide keyboard hints on mobile (add `desktop-only` class), show "USE D-PAD BELOW" on touch.

- [ ] **Step 3:** Verify tsc, commit: `feat: D-pad controls for Packet Route and Network Trace`

---

## Task 6: Code Inject — Bracket Buttons

**Files:**
- Modify: `src/components/minigames/CloseBrackets.tsx`

- [ ] **Step 1:** Import `TouchControls`, render `<TouchControls type="brackets" />` below the game area. Bracket buttons fire key events which existing `useKeyboard` handles.

- [ ] **Step 2:** Update instruction text: hide keyboard key hints on mobile, show "TAP the matching closers" on touch.

- [ ] **Step 3:** Verify tsc, commit: `feat: bracket touch buttons for Code Inject`

---

## Task 7: Typing Games — Hidden Input for System Keyboard

**Files:**
- Modify: `src/components/minigames/TypeBackward.tsx`
- Modify: `src/components/minigames/CipherCrack.tsx`
- Modify: `src/components/minigames/CipherCrackV2.tsx`
- Modify: `src/components/minigames/ChecksumVerify.tsx`

- [ ] **Step 1:** Create a shared approach — in each typing game, add a hidden `<input>` that:
- Is visually hidden (`sr-only` or `opacity-0 absolute`) but focusable
- Auto-focuses on mount (on touch devices only) to open system keyboard
- Has `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}`
- `onInput` handler reads the typed character, dispatches it to the existing key handler, then clears the input value
- For ChecksumVerify: use `inputMode="numeric"` to get number pad
- For text games: use `inputMode="text"`

- [ ] **Step 2:** Add a "TAP HERE TO TYPE" prompt visible on touch devices that focuses the input when tapped.

- [ ] **Step 3:** Update instruction text in all 4 components: mobile-specific instructions.

- [ ] **Step 4:** Verify tsc, commit: `feat: system keyboard input for typing games on mobile`

---

## Task 8: Defrag — Long-press to Flag

**Files:**
- Modify: `src/components/minigames/Defrag.tsx`

- [ ] **Step 1:** Add touch event handling to grid cells:
- `onTouchStart` starts a 500ms timer
- `onTouchEnd` / `onTouchCancel` — if <500ms: uncover (Space equivalent). If >=500ms: flag (Enter equivalent).
- Prevent default on touch events to avoid scroll/zoom interference.
- Add a small "FLAG MODE" toggle button at the bottom as an alternative to long-press.

- [ ] **Step 2:** Update instruction text: "TAP = uncover, HOLD = flag" on mobile.

- [ ] **Step 3:** Verify tsc, commit: `feat: Defrag touch controls — tap to uncover, hold to flag`

---

## Task 9: Already-Working Games — Instruction Text Updates

**Files:**
- Modify: `src/components/minigames/MineSweep.tsx`
- Modify: `src/components/minigames/FindSymbol.tsx`
- Modify: `src/components/minigames/SignalEcho.tsx`
- Modify: `src/components/minigames/PortScan.tsx`
- Modify: `src/components/minigames/SubnetScan.tsx`

- [ ] **Step 1:** In each component, find the instruction text (usually at the bottom) and wrap keyboard-specific instructions in `desktop-only` class. Add touch-specific text in `touch-only` class.

Examples:
- MineSweep: desktop "Arrow keys + Enter/Space", touch "TAP to mark"
- FindSymbol: desktop "Arrow keys + Enter", touch "TAP to select"
- SignalEcho: already tap-based, just hide keyboard hint on mobile
- PortScan: already tap-based, hide keyboard hint
- SubnetScan: already tap-based, hide keyboard hint

- [ ] **Step 2:** Verify tsc, commit: `feat: mobile instruction text for tap-based games`

---

## Task 10: Integration + Version Bump

- [ ] **Step 1:** Run `npm run build` — fix any issues.
- [ ] **Step 2:** Test on mobile (via `--host 0.0.0.0`): verify each minigame type is playable.
- [ ] **Step 3:** Run `npm version patch --no-git-tag-version` → v1.2.3
- [ ] **Step 4:** Commit: `chore: bump to v1.2.3`

---

## Task Dependency Graph

```
Task 1 (hook + CSS)
  → Task 2 (TouchControls component)
    → Tasks 3-9 (per-minigame, sequential)
      → Task 10 (integration + version)
```
