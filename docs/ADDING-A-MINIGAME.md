# Adding a New Minigame to Icebreaker

This guide walks through every file you need to touch to add a new minigame from scratch. Follow the steps in order. By the end you will have a fully wired, testable minigame that appears in Training mode, the Codex, the meta shop unlock system, and live runs.

---

## Overview — Files to Touch

| # | File | What you do |
|---|------|-------------|
| 1 | `src/types/game.ts` | Add the type literal to `MinigameType` union; add to `STARTING_MINIGAMES` or `UNLOCKABLE_MINIGAMES` |
| 2 | `src/components/minigames/YourGame.tsx` | Create the component |
| 3 | `src/components/screens/MinigameScreen.tsx` | Register import, `BASE_TIME_LIMITS` entry, `MINIGAME_COMPONENTS` entry, `buildMetaPowerUps` case |
| 4 | `src/components/screens/Training.tsx` | Register import, `MINIGAME_COMPONENTS` entry, `buildMetaPowerUps` case |
| 5 | `src/data/minigame-names.ts` | Add display name |
| 6 | `src/data/minigame-descriptions.ts` | Add `MinigameBriefing` entry |
| 7 | `src/data/meta-upgrades.ts` | (Optional) Add game-specific upgrade(s) and/or unlock license |
| 8 | `src/data/achievements.ts` | (Optional) Add per-minigame achievements |

---

## Step 1: Define the Type

Open `src/types/game.ts`.

### 1a — Add to the union

```ts
export type MinigameType =
  | "slash-timing"
  // ... existing types ...
  | "subnet-scan"
  | "cipher-crack-v2"
  | "your-minigame";   // <-- add here
```

Use a kebab-case string that is unique and descriptive. This string becomes the canonical identifier used everywhere.

### 1b — Decide: starting or unlockable?

**Starting minigames** appear from the very first run without any purchase. There are currently five:

```ts
export const STARTING_MINIGAMES: MinigameType[] = [
  "slash-timing",
  "close-brackets",
  "type-backward",
  "match-arrows",
  "mine-sweep",
];
```

**Unlockable minigames** are hidden until the player buys a license in the meta shop. Add your type to the appropriate array:

```ts
// For an unlockable minigame:
export const UNLOCKABLE_MINIGAMES: MinigameType[] = [
  // ... existing ...
  "your-minigame",   // <-- add here
];
```

Only add to `STARTING_MINIGAMES` if the game is intended to be available immediately. Almost all additions should go into `UNLOCKABLE_MINIGAMES` and require a meta-shop license (see Step 6).

---

## Step 2: Create the Component

Create `src/components/minigames/YourMinigame.tsx`.

### The required interface

Every minigame component receives exactly these props (from `src/types/minigame.ts`):

```ts
interface MinigameProps {
  difficulty: number;         // 0–1 scalar; 0.1 on floor 1, reaches ~1.0 around floor 13
  timeLimit: number;          // seconds (already computed by MinigameRouter)
  activePowerUps: PowerUpInstance[];  // run inventory + meta upgrade synthetics merged
  onComplete: (result: MinigameResult) => void;  // call via useMinigame, never directly
}
```

### Lifecycle hook

**Always** use `useMinigame` — it handles timer start, time-bonus power-up application, result dispatch, and the `isActive` flag. Never call `onComplete` directly.

```ts
const { timer, complete, fail, isActive } = useMinigame("your-minigame", props);
```

- `complete(true)` — player won
- `complete(false)` — player lost (same as `fail()`)
- `fail()` — convenience alias for `complete(false)`
- `timer.progress` — 0–1 float for the `<TimerBar>`; 1 = full, 0 = empty
- `isActive` — becomes `false` after `complete`/`fail` or timer expiry

### The `resolvedRef` guard

Use a `resolvedRef` to prevent calling `complete` or `fail` more than once. This matters when you have `setTimeout` callbacks that might fire after the timer has already expired:

```ts
const resolvedRef = useRef(false);

// Before resolving:
if (resolvedRef.current) return;
resolvedRef.current = true;
complete(true);
```

### Difficulty scaling

`difficulty` is a 0–1 float. Use it to scale durations, counts, and complexity:

```ts
// Range-based scaling pattern (from SlashTiming):
const attackWindow = 800 - difficulty * 500;  // 800ms at d=0, 300ms at d=1

// Threshold-based pattern (from SubnetScan):
function getParams(difficulty: number) {
  if (difficulty < 0.3) return { totalAddresses: 4, correctCount: 1 };
  if (difficulty <= 0.6) return { totalAddresses: 6, correctCount: 2 };
  return { totalAddresses: 6, correctCount: 4 };
}
```

### Reading activePowerUps

Power-ups from the run inventory and meta upgrade synthetics are both present in `activePowerUps`. Check by `effect.type` and optionally `effect.minigame`:

```ts
// Generic effect (applies to any minigame that checks it):
const hasWindowExtend = activePowerUps.some(p => p.effect.type === "window-extend");

// Game-specific meta upgrade (always filter by minigame too):
const hasMyUpgrade = activePowerUps.some(
  p => p.effect.type === "minigame-specific" && p.effect.minigame === "your-minigame"
);

// Get numeric value of an upgrade:
const slowFactor = activePowerUps
  .filter(p => p.effect.type === "minigame-specific" && p.effect.minigame === "your-minigame")
  .reduce((sum, p) => sum + p.effect.value, 0);
```

Use `useMemo` to compute derived values from `activePowerUps` so they don't recalculate on every render.

### Keyboard input

Two hooks available from `src/hooks/use-keyboard.ts`:

```ts
// Single key:
import { useKeyPress } from "@/hooks/use-keyboard";
useKeyPress(" ", handleSpace);   // event.key value

// Multiple keys simultaneously (cursor navigation pattern):
import { useKeyboard } from "@/hooks/use-keyboard";
const keyMap = useMemo(() => ({
  ArrowUp: handleUp,
  ArrowDown: handleDown,
  " ": handleSpace,
  Enter: handleEnter,
}), [handleUp, handleDown, handleSpace, handleEnter]);
useKeyboard(keyMap);
```

Both hooks use a latest-ref pattern internally — rebuilding `keyMap` with `useMemo` is correct and does not cause listener churn.

### Touch vs desktop

The `<TimerBar>` and instruction hints use CSS classes `desktop-only` and `touch-only` to conditionally show content. For programmatic branching:

```ts
import { useTouchDevice } from "@/hooks/use-touch-device";
const isTouch = useTouchDevice();
```

For cursor-based keyboard navigation, hide the cursor ring on touch:

```ts
const isCursor = !isTouch && cursorIndex === idx;
```

Always provide both a click/tap handler and a keyboard handler. Touch users tap items; desktop users navigate with arrow keys and confirm with Space.

### Timer pause/resume for phased games

Some minigames (like Port Scan) pause the timer during a display/preview phase and resume it for the interactive phase. Use the `timer` object from `useMinigame` directly — **do not** call `timer.start()` yourself (the hook does that). Instead call `timer.pause()` and then `timer.start()` again:

```ts
const { timer, complete, fail, isActive } = useMinigame("your-minigame", props);

// In your phase transition:
useEffect(() => {
  if (phase === "display") {
    timer.pause();
  } else if (phase === "interactive") {
    timer.start();   // safe to call; no-ops if already running
  }
}, [phase, timer]);
```

`timer.pause()` snapshots the remaining time. `timer.start()` resumes from that snapshot. `timer.addTime(ms)` works whether paused or running.

### Full skeleton component

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";
import { useTouchDevice } from "@/hooks/use-touch-device";

// ---------------------------------------------------------------------------
// Difficulty parameters — define a plain object or a function
// ---------------------------------------------------------------------------

interface Params {
  itemCount: number;
  // ... other difficulty-driven values
}

function getParams(difficulty: number): Params {
  if (difficulty < 0.3) return { itemCount: 3 };
  if (difficulty <= 0.6) return { itemCount: 5 };
  return { itemCount: 7 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * YourMinigame — short description of the mechanic.
 *
 * Difficulty scaling:
 *   d < 0.3: ...
 *   d 0.3–0.6: ...
 *   d > 0.6: ...
 */
export function YourMinigame(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("your-minigame", props);

  const isTouch = useTouchDevice();

  // Guard: prevents double-resolve (timer expiry + user action racing)
  const resolvedRef = useRef(false);

  // --- Read power-ups ---
  const hasMyUpgrade = useMemo(
    () =>
      activePowerUps.some(
        (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "your-minigame",
      ),
    [activePowerUps],
  );

  // --- Stable params (computed once on mount from difficulty) ---
  const params = useMemo(
    () => getParams(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],   // intentionally empty — difficulty won't change mid-game
  );

  // --- Component state ---
  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorIndexRef = useRef(0);   // stable ref for use inside callbacks

  // Keep ref in sync with state (needed when callbacks capture the ref)
  useEffect(() => {
    cursorIndexRef.current = cursorIndex;
  }, [cursorIndex]);

  // --- Game logic handlers ---
  const handleSelect = useCallback(
    (index: number) => {
      if (!isActive || resolvedRef.current) return;

      const isCorrect = /* your correctness check */ true;

      if (!isCorrect) {
        resolvedRef.current = true;
        // Optional: short delay so the player sees the wrong selection highlighted
        setTimeout(() => fail(), 400);
        return;
      }

      // Check win condition
      const allDone = /* check if puzzle complete */ true;
      if (allDone) {
        resolvedRef.current = true;
        setTimeout(() => complete(true), 300);
      }
    },
    [isActive, fail, complete],
  );

  const handleUp = useCallback(() => {
    setCursorIndex((prev) => {
      const val = Math.max(0, prev - 1);
      cursorIndexRef.current = val;
      return val;
    });
  }, []);

  const handleDown = useCallback(() => {
    setCursorIndex((prev) => {
      const val = Math.min(params.itemCount - 1, prev + 1);
      cursorIndexRef.current = val;
      return val;
    });
  }, [params.itemCount]);

  const handleSpace = useCallback(() => {
    handleSelect(cursorIndexRef.current);
  }, [handleSelect]);

  const keyMap = useMemo(
    () => ({
      ArrowUp: handleUp,
      ArrowDown: handleDown,
      " ": handleSpace,
    }),
    [handleUp, handleDown, handleSpace],
  );

  useKeyboard(keyMap);

  // --- Render ---
  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer bar — always at the top */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-4" />

      {/* Main game area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-lg">
        <p className="text-cyber-cyan text-xs uppercase tracking-widest font-mono glitch-subtle">
          YOUR MINIGAME HEADER
        </p>

        {/* Game content here */}
        {Array.from({ length: params.itemCount }, (_, i) => {
          const isCursor = !isTouch && cursorIndex === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i)}
              disabled={!isActive || resolvedRef.current}
              className={`
                w-full px-4 py-2 font-mono text-sm border rounded-md
                transition-all duration-150
                ${isCursor ? "ring-2 ring-cyber-cyan" : ""}
                bg-white/[0.03] border-white/10 text-white/60
                hover:bg-white/[0.06] cursor-pointer
              `}
            >
              Item {i}
            </button>
          );
        })}
      </div>

      {/* Control hints — shown conditionally for desktop/touch */}
      <div className="mt-4 text-center">
        <div className="desktop-only">
          <p className="text-white/30 text-xs uppercase tracking-widest">
            Arrow keys to navigate, Space to select
          </p>
          <div className="inline-flex items-center gap-1 mt-1">
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">↑</kbd>
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">↓</kbd>
            <kbd className="px-3 py-1 bg-cyan-950/50 border border-cyan-800/30 rounded text-[10px] text-cyan-500/70 font-mono ml-2">SPACE</kbd>
          </div>
        </div>
        <div className="touch-only">
          <p className="text-white/30 text-xs uppercase tracking-widest">
            TAP to select
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Key rules:**
- Always render `<TimerBar progress={timer.progress} />` — it's the only visible timer the player sees.
- Always guard actions with `if (!isActive || resolvedRef.current) return;`.
- Never call `onComplete` directly — always go through `complete()` or `fail()`.
- Stable useMemo with empty deps (`[]`) for puzzle generation — difficulty won't change mid-round.
- Use `cursorIndexRef` (not `cursorIndex` state) inside callbacks to avoid stale closure captures.

---

## Step 3: Register in MinigameScreen

Open `src/components/screens/MinigameScreen.tsx`.

### 3a — Import

Add your import alongside the other minigames (alphabetical by display name is the convention):

```ts
import { YourMinigame } from "@/components/minigames/YourMinigame";
```

### 3b — BASE_TIME_LIMITS

Add an entry to the `BASE_TIME_LIMITS` record. This is the base time in **seconds** before difficulty scaling is applied. `getTimeLimit()` will reduce it by up to 40% at max difficulty, and another 2% per floor past floor 15.

```ts
const BASE_TIME_LIMITS: Record<MinigameType, number> = {
  // ... existing ...
  "your-minigame": 15,   // choose based on complexity; typical range is 8–40
};
```

Reference times for comparison:
- `"slash-timing"`: 8s — pure reflex, one action
- `"match-arrows"`: 8s — short sequence
- `"close-brackets"`: 8s — typed sequence
- `"checksum-verify"`: 15s — math, multiple problems
- `"subnet-scan"`: 20s — reading/selection with multiple items
- `"network-trace"`: 20s — navigation
- `"defrag"`: 40s — full minesweeper

### 3c — MINIGAME_COMPONENTS

```ts
const MINIGAME_COMPONENTS: Record<MinigameType, React.ComponentType<import("@/types/minigame").MinigameProps>> = {
  // ... existing ...
  "your-minigame": YourMinigame,
};
```

### 3d — buildMetaPowerUps (if you have game-specific meta upgrades)

If you added a game-specific meta upgrade (Step 7), add a case here. This converts the persisted `purchasedUpgrades` tier count into a synthetic `PowerUpInstance` that gets merged into `activePowerUps` and passed to your component:

```ts
function buildMetaPowerUps(purchasedUpgrades, type) {
  // ... existing cases ...
  case "your-minigame":
    // upgrade-id, effect type, [value per tier], minigame
    addIfOwned("your-upgrade-id", "minigame-specific", [1], "your-minigame");
    break;
}
```

The `valueByTier` array maps tier index to the value: `valueByTier[0]` is the value at tier 1, `valueByTier[1]` at tier 2, etc. If the tier exceeds the array length, the last value is used.

---

## Step 4: Register in Training.tsx

Open `src/components/screens/Training.tsx`. This screen is a **complete mirror** of `MinigameScreen.tsx` for the three registrations — both files must stay in sync.

### 4a — Import

```ts
import { YourMinigame } from "@/components/minigames/YourMinigame";
```

### 4b — MINIGAME_COMPONENTS (Training)

```ts
const MINIGAME_COMPONENTS: Record<MinigameType, ...> = {
  // ... existing ...
  "your-minigame": YourMinigame,
};
```

### 4c — buildMetaPowerUps (Training mirror)

Add the same `case` as you added in `MinigameScreen.tsx`:

```ts
case "your-minigame":
  addIfOwned("your-upgrade-id", "minigame-specific", [1], "your-minigame");
  break;
```

If you do not have any game-specific meta upgrades, you can skip 4c and 3d.

---

## Step 5: Display Name

Open `src/data/minigame-names.ts`. Add your entry to `MINIGAME_DISPLAY_NAMES`:

```ts
export const MINIGAME_DISPLAY_NAMES: Record<MinigameType, string> = {
  // ... existing ...
  "your-minigame": "Your Minigame",   // player-facing name shown during countdown
};
```

The display name appears in:
- The countdown screen ("FLOOR 3 // PROTOCOL 2 OF 4 — **Your Minigame**")
- The Training mode picker
- The Codex
- Achievement descriptions

Choose something thematic and fitting the cyberpunk aesthetic. Compare with existing names: "Cipher Crack V2", "Subnet Scan", "Signal Echo".

---

## Step 6: Descriptions

Open `src/data/minigame-descriptions.ts`. Add a `MinigameBriefing` entry to `MINIGAME_BRIEFINGS`:

```ts
export const MINIGAME_BRIEFINGS: Record<MinigameType, MinigameBriefing> = {
  // ... existing ...
  "your-minigame": {
    rules: [
      "What is displayed and what the player needs to do",
      "What constitutes a correct action",
      "What causes failure (immediate? timeout only?)",
      "What constitutes success (all items? one action?)",
    ],
    controls: {
      desktop: "Arrow keys + SPACE, or click",
      touch: "TAP the correct item",
    },
    tips: [
      "A strategy tip for easier difficulty",
      "A tip for handling higher difficulty variants",
    ],
    hint: {
      // Short one-liner shown during the countdown when Hint Module power-up is active
      desktop: "Brief desktop hint (max ~60 chars).",
      touch: "Brief touch hint (max ~60 chars).",
    },
  },
};
```

**Rules** are shown in the Codex and Training briefing. Write them as instructions, not descriptions. Keep each bullet to one clear sentence.

**Tips** are shown below rules. Include at least 2: one for beginners and one for handling higher difficulty.

**Hint** is shown during the countdown (`3 → 2 → 1 → GO`) when the player has a "Hint Module" power-up. It must be a single short sentence that conveys the most critical piece of information. Keep it under 60 characters.

---

## Step 7: Meta Upgrades (Optional)

Open `src/data/meta-upgrades.ts`.

### 7a — Unlock license (required for unlockable minigames)

Every entry in `UNLOCKABLE_MINIGAMES` needs a corresponding license in `META_UPGRADE_POOL`. Without it, the player can never unlock the minigame through the meta shop.

```ts
{
  id: "your-minigame-license",
  name: "Your Minigame License",
  description: "Unlocks the Your Minigame protocol for future runs.",
  category: "minigame-unlock",
  maxTier: 1,
  prices: [0],    // 0 = dynamic pricing: 200 + (unlocksOwned * 100)
  effects: [{ type: "unlock-minigame", value: 1, minigame: "your-minigame" }],
  // requires: "some-other-license",  // optional: gate behind another unlock
},
```

Use `prices: [0]` for the dynamic pricing formula (same as all current unlockable minigames). The game engine reads `prices[0] === 0` as a signal to compute the price dynamically at display time.

### 7b — Game-specific upgrade (optional)

These are quality-of-life upgrades that apply only to one minigame. They go in the `"game-specific"` category and are wired through `buildMetaPowerUps`:

```ts
{
  id: "your-upgrade-id",
  name: "Upgrade Display Name",
  description: "Describes exactly what it does in the minigame.",
  category: "game-specific",
  maxTier: 1,         // or 2-3 for tiered upgrades
  prices: [200],      // fixed price in data (◆)
  effects: [
    { type: "minigame-specific", value: 1, minigame: "your-minigame" },
    // For tiered upgrades, one effect per tier:
    // { type: "minigame-specific", value: 0.5, minigame: "your-minigame" },
    // { type: "minigame-specific", value: 0.75, minigame: "your-minigame" },
  ],
},
```

**Choosing the effect type:**

| Scenario | `effect.type` to use |
|----------|---------------------|
| Generic behaviour your component reads as a flag | `"minigame-specific"` |
| Widens a timing window (already has component support) | `"window-extend"` |
| Shows a hint/highlight | `"hint"` |
| Reveals N items ahead in a sequence | `"peek-ahead"` |
| Reveals a percentage of items | `"minigame-specific"` (use `value` as fraction) |

Your component reads the effect via `activePowerUps`:

```ts
// In your component:
const hasMyUpgrade = useMemo(
  () => activePowerUps.some(
    p => p.effect.type === "minigame-specific" && p.effect.minigame === "your-minigame"
  ),
  [activePowerUps],
);

// For a tiered numeric value:
const upgradeValue = useMemo(
  () => activePowerUps
    .filter(p => p.effect.type === "minigame-specific" && p.effect.minigame === "your-minigame")
    .reduce((sum, p) => sum + p.effect.value, 0),
  [activePowerUps],
);
```

The `buildMetaPowerUps` function in both `MinigameScreen.tsx` and `Training.tsx` converts the player's purchased tier into a `PowerUpInstance` with the correct value. That instance appears in `activePowerUps` alongside run-shop power-ups — your component doesn't need to know the source.

**Real examples from existing minigames:**

- `signal-echo-slow` (Signal Echo): `value: 0.3` → component reads it and multiplies the sequence display speed by `(1 - 0.3)`
- `subnet-cidr-helper` (Subnet Scan): `value: 1` → component uses `hasCidrHelper` as a boolean flag to show expanded IP ranges
- `mine-echo` (Mine Sweep): `value: 0.20 / 0.35 / 0.50` (3 tiers) → fraction of mines that remain revealed after the preview phase ends

---

## Step 8: Achievements (Optional)

Open `src/data/achievements.ts`. Add entries to `ACHIEVEMENT_POOL`.

### Achievement condition types

| `type` | Triggers when... | Relevant fields |
|--------|-----------------|-----------------|
| `"minigame-speed"` | Player wins your minigame in under N ms | `minigame`, `maxTimeMs` |
| `"minigame-streak"` | Player has N **consecutive** wins (count < 15) OR N **total** wins (count ≥ 15) | `minigame`, `count` |

The `"minigame-streak"` threshold of 15 is the distinction between streak and cumulative: counts below 15 check `minigameWinStreaks[type]` (resets on failure); counts 15 and above check `minigameWinsTotal[type]` (never resets).

### Example entries

```ts
// Speed achievement: win in under 5 seconds
{
  id: "your-minigame-speed",
  name: "Speed Demon",
  description: "Win Your Minigame in under 5 seconds.",
  condition: { type: "minigame-speed", minigame: "your-minigame", maxTimeMs: 5_000 },
  reward: 50,       // data (◆) awarded on first earn
  icon: "zap",      // Lucide icon name
},

// Streak achievement: 5 consecutive wins
{
  id: "your-minigame-streak",
  name: "Protocol Ace",
  description: "Win Your Minigame 5 times in a row.",
  condition: { type: "minigame-streak", minigame: "your-minigame", count: 5 },
  reward: 30,
  icon: "target",
},

// Cumulative achievement: 25 total wins (count >= 15 → uses total)
{
  id: "your-minigame-veteran",
  name: "Your Minigame Veteran",
  description: "Win Your Minigame 25 times total.",
  condition: { type: "minigame-streak", minigame: "your-minigame", count: 25 },
  reward: 50,
  icon: "award",
},
```

Achievement checking is fully automatic — `awardNewAchievements()` is called by `MinigameScreen` after every minigame result. You do not need to add any hook calls.

**Icon names** are Lucide icon names (kebab-case). Browse at https://lucide.dev/icons to find one that fits the theme.

---

## Step 9: Protocol License — How the Unlock System Works

This explains the full chain so you understand what to verify:

1. **`UNLOCKABLE_MINIGAMES`** in `game.ts` lists minigame types that must be purchased.
2. **`META_UPGRADE_POOL`** in `meta-upgrades.ts` contains a license entry with `category: "minigame-unlock"` and `effect: { type: "unlock-minigame", minigame: "your-minigame" }`.
3. When the player purchases the license, the store adds the upgrade to `purchasedUpgrades` and calls the unlock handler, which adds `"your-minigame"` to `unlockedMinigames`.
4. Floor minigame selection draws only from `STARTING_MINIGAMES` + `unlockedMinigames`. Without the purchase, the minigame never appears in runs.
5. Training mode shows all minigames to all players regardless of unlock status — this is intentional (players can practice anything, but it only appears in runs after unlocking).

If your minigame is in `STARTING_MINIGAMES`, skip the license entirely — no entry in `meta-upgrades.ts` is needed for the unlock system.

---

## Step 10: Verify

### TypeScript check

```bash
npx tsc --noEmit
```

The two `Record<MinigameType, ...>` types in `MinigameScreen.tsx` (both `BASE_TIME_LIMITS` and `MINIGAME_COMPONENTS`) and the `MINIGAME_BRIEFINGS` and `MINIGAME_DISPLAY_NAMES` records are all typed as exhaustive records over `MinigameType`. TypeScript will error if you add a type to the union but forget any of these four entries. This is your primary safety net.

### Build check

```bash
npm run build
```

### Manual test in Training mode

1. Run `npm run dev`
2. Navigate to Training in the main menu
3. Select your minigame from the picker
4. Check that the briefing screen shows your rules and controls
5. Play through at multiple difficulty levels (TRIVIAL, NORMAL, INSANE)
6. Verify the timer bar fills correctly and the timer actually runs
7. Verify that winning and losing both resolve correctly (no stuck state)
8. On a touch device (or with browser DevTools touch simulation), verify touch controls work

### Checklist before shipping

- [ ] TypeScript compiles cleanly (`tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] Minigame appears in Training mode picker
- [ ] Briefing text is correct (rules, controls, tips)
- [ ] Countdown hint text is short enough to read quickly
- [ ] Difficulty TRIVIAL is learnable by a new player
- [ ] Difficulty INSANE is genuinely challenging but fair
- [ ] Win resolves to SUCCESS flash
- [ ] Loss resolves to FAILED flash (wrong input or timer expiry)
- [ ] No double-resolve (no console errors about calling `complete` twice)
- [ ] Touch controls tested
- [ ] For unlockable minigames: license appears in meta shop; purchasing it makes the minigame appear in runs

---

## Common Patterns Reference

### Pattern: phased game (display then interactive)

Used by Port Scan: timer pauses during display phase, resumes during interaction.

```ts
type Phase = "display" | "interactive";
const [phase, setPhase] = useState<Phase>("display");

// Pause timer for display
useEffect(() => {
  timer.pause();
  const t = setTimeout(() => {
    setPhase("interactive");
    timer.start();
  }, DISPLAY_DURATION_MS);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);  // runs once on mount
```

### Pattern: stable puzzle generation

Generate the puzzle once on mount using `useMemo` with intentionally empty deps. Difficulty is captured at mount time and won't change mid-game.

```ts
const puzzle = useMemo(
  () => generatePuzzle(getParams(difficulty)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [],  // intentionally empty — difficulty is stable per game instance
);
```

### Pattern: keyboard cursor management

```ts
const [cursorIndex, setCursorIndex] = useState(0);
const cursorIndexRef = useRef(0);

useEffect(() => {
  cursorIndexRef.current = cursorIndex;
}, [cursorIndex]);

const handleUp = useCallback(() => {
  setCursorIndex(prev => {
    const val = Math.max(0, prev - 1);
    cursorIndexRef.current = val;  // keep ref in sync immediately
    return val;
  });
}, []);
```

Always read `cursorIndexRef.current` (not the state variable) inside event handlers and callbacks to avoid stale closure problems.

### Pattern: delayed fail with visual feedback

Give the player 400ms to see the wrong selection highlighted before the fail resolves:

```ts
resolvedRef.current = true;
setSelectedItem(wrongItem);          // show visual feedback
setTimeout(() => fail(), 400);       // then fail
```

### Pattern: reading window-extend from both run shop and meta upgrades

```ts
// From SlashTiming.tsx — handles both sources transparently:
const windowExtendBonus = useMemo(() => {
  let bonus = 0;
  for (const pu of activePowerUps) {
    if (
      pu.effect.type === "window-extend" &&
      (!pu.effect.minigame || pu.effect.minigame === "slash-timing")
    ) {
      bonus += pu.effect.value;
    }
  }
  return bonus;
}, [activePowerUps]);

const attackWindow = baseAttackWindow * (1 + windowExtendBonus);
```

### Pattern: sequential timeouts with resolvedRef guard

When using nested `setTimeout` chains for phase cycling (like SlashTiming), always check `resolvedRef.current` at the start of every callback:

```ts
const startCycle = useCallback(() => {
  if (resolvedRef.current) return;          // <-- guard
  setPhase("phase-a");

  timeoutRef.current = setTimeout(() => {
    if (resolvedRef.current) return;        // <-- guard in nested callback
    setPhase("phase-b");

    timeoutRef.current = setTimeout(() => {
      if (resolvedRef.current) return;      // <-- guard in deepest callback
      startCycle();                         // restart
    }, PHASE_B_DURATION);
  }, PHASE_A_DURATION);
}, []);
```

Store the timeout handle in a ref (`timeoutRef`) and clear it on unmount and whenever you resolve:

```ts
const clearPhaseTimeout = useCallback(() => {
  if (timeoutRef.current !== null) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}, []);

// In your resolve handler:
resolvedRef.current = true;
clearPhaseTimeout();
complete(true);

// In useEffect cleanup:
useEffect(() => {
  startCycle();
  return () => clearPhaseTimeout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
