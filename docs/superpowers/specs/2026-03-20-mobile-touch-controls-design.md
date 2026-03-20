# Mobile Touch Controls — Design Spec

## Overview

Add touch controls for all 15 minigames so the game is playable on mobile devices. Controls are adaptive — each minigame gets exactly the input method it needs. Touch controls are hidden on desktop (detected via pointer media query or touch event support).

## Detection

Show touch controls only on touch devices:
```css
@media (pointer: coarse) { .touch-controls { display: flex; } }
@media (pointer: fine) { .touch-controls { display: none; } }
```

## Control Types

### 1. Tap Anywhere — Slash Timing

No extra controls needed. The game area itself is tappable. Add `onClick` / `onTouchStart` to the main game container that fires the same handler as Space key.

### 2. D-Pad — Packet Route, Network Trace

Fixed bottom bar with 4 directional buttons in cross layout:
```
    [↑]
[←] [↓] [→]
```
Each button dispatches the equivalent keyboard event (ArrowUp/Down/Left/Right). Buttons should be large (min 48px tap target per mobile guidelines) with haptic-style visual feedback on press.

### 3. Bracket Buttons — Code Inject

6 buttons in a row at the bottom:
```
[ ) ]  [ ] ]  [ } ]  [ > ]  [ | ]  [ / ]
```
Each dispatches the equivalent key event. Only show the 6 closer characters (player only types closers).

### 4. Hidden Input + System Keyboard — Decrypt Signal, Cipher V1, Cipher V2, Checksum Verify

Use a hidden `<input>` element that is auto-focused on mobile to trigger the system keyboard.

```tsx
<input
  ref={inputRef}
  type="text"                    // "number" for Checksum Verify
  inputMode="text"               // "numeric" for Checksum Verify
  autoComplete="off"
  autoCorrect="off"
  autoCapitalize="off"
  spellCheck={false}
  className="sr-only"            // visually hidden but focusable
  onInput={handleInput}
/>
```

For Checksum Verify: use `inputMode="numeric"` to get the number pad.

On mount (mobile only): auto-focus the input to open the keyboard. After each character processed, clear the input value to prevent accumulation.

### 5. Tap on Element — Wire Cutting, Memory Scan, Address Lookup, Defrag, Signal Echo, Port Scan, Subnet Scan

These already have click/tap handlers on their interactive elements (grid cells, wires, panels, addresses). No additional touch controls needed.

**Wire Cutting enhancement:** Add `onClick` handler to each wire element that dispatches the same action as pressing the wire's number key. Currently only keyboard-driven.

**Defrag enhancement:**
- Tap = uncover cell (Space equivalent)
- Long press (500ms) = toggle flag (Enter equivalent)
- Need to add touch event handlers alongside click

**Memory Scan enhancement:**
- Tap = toggle mark (already works via click)
- No change needed

## Shared Component: `TouchControls`

Create `src/components/layout/TouchControls.tsx` — a wrapper that detects touch devices and renders the appropriate control set based on the current minigame type.

```tsx
interface TouchControlsProps {
  minigameType: MinigameType;
  onKey: (key: string) => void;  // dispatches synthetic key events
}
```

The component reads `minigameType` and renders:
- `"slash-timing"` → nothing (tap on game area)
- `"close-brackets"` → bracket buttons
- `"match-arrows" | "network-trace"` → D-pad
- `"type-backward" | "cipher-crack" | "cipher-crack-v2"` → hidden text input
- `"checksum-verify"` → hidden numeric input
- Everything else → nothing (tap handlers on game elements)

## Layout

Touch controls appear in a fixed bottom bar on mobile:
- `position: fixed; bottom: 0; left: 0; right: 0;`
- Semi-transparent dark background: `bg-cyber-bg/90 backdrop-blur`
- Padding: `safe-area-inset-bottom` for notched phones
- Game area gets `padding-bottom` to avoid overlap

## Button Styling

- Minimum 48x48px tap targets (mobile accessibility standard)
- Cyberpunk style: dark background, cyan/magenta borders, glow on press
- Active state: brief color flash (no delay — immediate feedback)
- Prevent zoom on double-tap: `touch-action: manipulation` on buttons

## Minigame-Specific Notes

### Slash Timing
- Entire game area = tap target during ATTACK phase
- Visual: "TAP TO STRIKE" replaces "PRESS SPACE" on mobile

### Code Inject
- 6 bracket buttons fixed at bottom
- Instruction text changes: "TAP the matching closers" on mobile

### Decrypt Signal / Cipher V1 / V2
- Hidden input auto-focused on mobile
- Game area slightly smaller to accommodate keyboard
- "TAP HERE TO TYPE" label if keyboard not open

### Checksum Verify
- Hidden input with `inputMode="numeric"`
- Enter/Space confirm via a visible "CONFIRM" button at bottom (alongside numpad)

### Packet Route / Network Trace
- D-pad at bottom
- Buttons large enough for comfortable thumb use
- No diagonal movement (only 4 directions)

### Defrag
- Tap = uncover, long-press = flag
- Small "FLAG MODE" toggle button in corner as alternative to long-press
- Touch instruction: "TAP = uncover, HOLD = flag"

## Instruction Text Adaptation

Each minigame's instruction text at the bottom should detect mobile and show touch-specific instructions instead of keyboard instructions. E.g.:
- Desktop: "PRESS SPACE TO STRIKE DURING THE GREEN PHASE"
- Mobile: "TAP TO STRIKE DURING THE GREEN PHASE"

## What NOT to Build

- No virtual joystick/analog stick — D-pad is sufficient
- No gesture recognition (swipe) — too unreliable, conflicts with scroll
- No custom QWERTY keyboard — system keyboard is better
- No haptic feedback API — not worth the complexity
