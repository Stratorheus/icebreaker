# Adding a New Minigame to Icebreaker

The new architecture requires **2 files** (component + config) and **2 small edits** (type union + registry entry). Everything else — display name, time limit, briefing text, meta upgrades, unlock license — lives in the config file and is wired automatically.

---

## Overview

| Step | What | File(s) |
|------|------|---------|
| 1 | Create the component | `src/components/minigames/YourMinigame.tsx` |
| 2 | Create the config file (SSOT) | `src/data/minigames/your-minigame-id.ts` |
| 3 | Add to MinigameType union | `src/types/game.ts` |
| 4 | Import + register | `src/data/minigames/registry.ts` |

TypeScript will catch any missing registration: `MINIGAME_REGISTRY` is typed as `Record<MinigameType, MinigameConfig>`, so adding a type to the union without a registry entry is a compile error.

---

## Step 1: Create the Component

Add `src/components/minigames/YourMinigame.tsx`. Every minigame component implements the same `MinigameProps` interface from `src/types/minigame.ts`.

**Key rules:**

- Always use `useMinigame("your-minigame-id", props)` — it starts the timer, applies `time-bonus` power-ups, and provides `complete`/`fail` callbacks. Never call `onComplete` directly.
- Always render `<TimerBar progress={timer.progress} />` — the only visible timer.
- Always guard actions with `if (!isActive || resolvedRef.current) return;`.
- Use `useMemo` with empty deps (`[]`) for puzzle generation — difficulty is stable per game instance.
- Use `cursorIndexRef` (not state) inside keyboard callbacks to avoid stale closures.

```tsx
import { useCallback, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";
import { useTouchDevice } from "@/hooks/use-touch-device";

function getParams(difficulty: number) {
  if (difficulty < 0.3) return { itemCount: 3 };
  if (difficulty <= 0.6) return { itemCount: 5 };
  return { itemCount: 7 };
}

export function YourMinigame(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("your-minigame-id", props);
  const isTouch = useTouchDevice();
  const resolvedRef = useRef(false);

  // Read game-specific meta upgrade value (0 if not purchased)
  const upgradeValue = useMemo(
    () =>
      activePowerUps
        .filter(
          (p) =>
            p.effect.type === "minigame-specific" &&
            p.effect.minigame === "your-minigame-id",
        )
        .reduce((sum, p) => sum + p.effect.value, 0),
    [activePowerUps],
  );

  // Puzzle generated once on mount — difficulty is stable per game instance
  const params = useMemo(
    () => getParams(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorIndexRef = useRef(0);

  const handleSelect = useCallback(
    (index: number) => {
      if (!isActive || resolvedRef.current) return;
      const correct = index === 0; // replace with real logic
      if (!correct) {
        resolvedRef.current = true;
        setTimeout(() => fail(), 400);
        return;
      }
      resolvedRef.current = true;
      setTimeout(() => complete(true), 300);
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
    () => ({ ArrowUp: handleUp, ArrowDown: handleDown, " ": handleSpace }),
    [handleUp, handleDown, handleSpace],
  );
  useKeyboard(keyMap);

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-4" />

      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-lg">
        <p className="text-cyber-cyan text-xs uppercase tracking-widest font-mono">
          YOUR MINIGAME
        </p>

        {Array.from({ length: params.itemCount }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSelect(i)}
            disabled={!isActive || resolvedRef.current}
            className={`
              w-full px-4 py-2 font-mono text-sm border rounded-md
              bg-white/[0.03] border-white/10 text-white/60
              hover:bg-white/[0.06] transition-all duration-150
              ${!isTouch && cursorIndex === i ? "ring-2 ring-cyber-cyan" : ""}
            `}
          >
            Item {i}
          </button>
        ))}
      </div>

      <div className="mt-4 text-center">
        <p className="desktop-only text-white/30 text-xs uppercase tracking-widest">
          Arrow keys to navigate, Space to select
        </p>
        <p className="touch-only text-white/30 text-xs uppercase tracking-widest">
          TAP to select
        </p>
      </div>
    </div>
  );
}
```

For more component patterns (phased games with timer pause/resume, sequential timeout chains, window-extend reading), see the **Common Patterns Reference** section at the bottom of this file.

---

## Step 2: Create the Config File

Create `src/data/minigames/your-minigame-id.ts`. This is the **single source of truth** for the minigame — everything about it lives here.

### Full config template

```ts
import { YourMinigame } from "@/components/minigames/YourMinigame";
import type { MinigameConfig } from "./types";

export const yourMinigameConfig: MinigameConfig = {
  // ---- Identity ----
  id: "your-minigame-id",
  displayName: "Your Protocol",       // shown during countdown, Training, Codex

  // ---- Component + timing ----
  component: YourMinigame,
  baseTimeLimit: 15,                  // seconds at difficulty 0; getTimeLimit() scales down to 60% at d=1

  // ---- Unlock ----
  starting: false,                    // true = available from first run, no license needed
  unlockPrice: "dynamic",             // "dynamic" = 200 + unlocksOwned*100; or a fixed number
  // licenseId: "your-minigame-license",  // only if save-compat requires a non-default ID
  // requires: "some-other-license",      // optional prerequisite

  // ---- Briefing (Codex + Training + countdown hint) ----
  briefing: {
    rules: [
      "What is shown and what the player must do",
      "What constitutes a correct action",
      "What causes immediate failure (if any)",
      "What constitutes a win (all done? one action?)",
    ],
    controls: {
      desktop: "Arrow keys + SPACE, or click",
      touch: "TAP the correct item",
    },
    tips: [
      "A strategy tip for easier difficulty",
      "A tip for handling higher difficulty",
    ],
    hint: {
      // Shown during 3-2-1-GO countdown when a Hint power-up is active.
      // Keep under 60 characters.
      desktop: "Brief desktop hint — the one most critical fact.",
      touch: "Brief touch hint — the one most critical fact.",
    },
  },

  // ---- Game-specific meta upgrades (empty array if none) ----
  metaUpgrades: [
    // Example: a tiered assist upgrade
    // {
    //   id: "your-upgrade-id",
    //   name: "Upgrade Name",
    //   description: "Describes exactly what it does.",
    //   category: "game-specific",
    //   maxTier: 3,
    //   prices: [150, 300, 500],
    //   effects: [
    //     { type: "minigame-specific", value: 0.25, minigame: "your-minigame-id" },
    //     { type: "minigame-specific", value: 0.50, minigame: "your-minigame-id" },
    //     { type: "minigame-specific", value: 0.75, minigame: "your-minigame-id" },
    //   ],
    // },
  ],
};
```

### Config field reference

**`baseTimeLimit`** — seconds before difficulty and floor scaling. `getTimeLimit()` reduces it by up to 40% at max difficulty and an additional 2% per floor past 15. Reference values:

| Minigame | Base Time | Why |
|---|---|---|
| slash-timing | 8 s | Pure reflex, one action |
| match-arrows | 8 s | Short sequence |
| checksum-verify | 15 s | Math, multiple problems |
| subnet-scan | 20 s | Reading + selection |
| network-trace | 20 s | Navigation |
| defrag | 40 s | Full minesweeper board |

**`starting: true`** — minigame is available from the very first run, no license needed. There are currently 5 starting minigames. Almost all additions should use `starting: false`.

**`unlockPrice: "dynamic"`** — uses the formula `200 + unlocksOwned * 100` computed at shop display time. Set a fixed number (e.g. `300`) only if you need a specific price.

**`metaUpgrades`** — each entry is a full `MetaUpgrade` object (same type as `src/types/shop.ts`). The registry assembles them automatically into `META_UPGRADE_POOL`. Your component reads the effect via `activePowerUps` — `buildMetaPowerUps` handles the conversion generically with no switch statement.

Choosing the effect type for a game-specific upgrade:

| Scenario | `effect.type` |
|---|---|
| Generic flag or numeric value your component reads | `"minigame-specific"` |
| Widens a timing window (SlashTiming pattern) | `"window-extend"` |
| Shows a hint or highlight | `"hint"` |
| Reveals N items ahead in a sequence | `"peek-ahead"` |

---

## Step 3: Add to MinigameType Union

Open `src/types/game.ts`. Add your identifier to the `MinigameType` union:

```ts
export type MinigameType =
  | "slash-timing"
  // ... existing types ...
  | "cipher-crack-v2"
  | "your-minigame-id";   // add here
```

Use a kebab-case string that is unique and descriptive. This string is the canonical identifier used everywhere — in the registry key, in `onComplete` results, in achievement conditions, in power-up `minigame` fields.

---

## Step 4: Import + Register

Open `src/data/minigames/registry.ts`. Add the import and the registry entry:

```ts
// Add import alongside the other 15:
import { yourMinigameConfig } from "./your-minigame-id";

// Add entry to MINIGAME_REGISTRY:
export const MINIGAME_REGISTRY: Record<MinigameType, MinigameConfig> = {
  // ... existing 15 entries ...
  "your-minigame-id": yourMinigameConfig,
};
```

That's it. The registry automatically derives:

- `MINIGAME_COMPONENTS` — used by the `MinigameRouter` in `MinigameScreen.tsx`
- `BASE_TIME_LIMITS` — used by `MinigameRouter` to compute `timeLimit`
- `STARTING_MINIGAMES` / `UNLOCKABLE_MINIGAMES` — used by run generation and MetaShop
- Unlock license entry in `META_UPGRADE_POOL` (if `starting: false` and `unlockPrice` is set)
- Game-specific upgrade entries in `META_UPGRADE_POOL` (from `metaUpgrades`)
- `buildMetaPowerUps` handles the new minigame's upgrades generically

---

## Step 5 (Optional): Add Achievements

Open `src/data/achievements.ts` and add entries to `ACHIEVEMENT_POOL`.

```ts
// Speed achievement: win in under 5 seconds
{
  id: "your-minigame-speed",
  name: "Speed Demon",
  description: "Win Your Protocol in under 5 seconds.",
  condition: { type: "minigame-speed", minigame: "your-minigame-id", maxTimeMs: 5_000 },
  reward: 50,
  icon: "zap",
},

// Streak achievement: 5 consecutive wins
{
  id: "your-minigame-streak",
  name: "Protocol Ace",
  description: "Win Your Protocol 5 times in a row.",
  condition: { type: "minigame-streak", minigame: "your-minigame-id", count: 5 },
  reward: 30,
  icon: "target",
},

// Cumulative achievement: 25 total wins (count >= 15 uses lifetime total, not streak)
{
  id: "your-minigame-veteran",
  name: "Your Protocol Veteran",
  description: "Win Your Protocol 25 times total.",
  condition: { type: "minigame-streak", minigame: "your-minigame-id", count: 25 },
  reward: 50,
  icon: "award",
},
```

Achievement checking is automatic — `awardNewAchievements()` runs after every minigame result. Icon names are Lucide kebab-case (browse at https://lucide.dev/icons).

---

## Verify

```bash
npx tsc --noEmit
```

TypeScript will report errors if `MinigameType` has a value with no corresponding `MINIGAME_REGISTRY` entry. Fix and re-run until clean.

```bash
npm run build
```

Then manually test in Training mode:

1. `npm run dev` → Training → select your minigame
2. Check briefing text (rules, controls, tips)
3. Play at TRIVIAL, NORMAL, and INSANE difficulty
4. Verify win and loss both resolve cleanly (no stuck state, no double-resolve errors)
5. On touch simulation: verify tap controls work

---

## How the Unlock System Works

For reference:

1. `UNLOCKABLE_MINIGAMES` (derived from registry) lists types that must be purchased.
2. `META_UPGRADE_POOL` (assembled in `src/data/upgrades/registry.ts`) includes an auto-generated license entry for each unlockable minigame where `unlockPrice != null`.
3. When the player purchases the license, the store adds `"your-minigame-id"` to `unlockedMinigames`.
4. Floor generation draws from `STARTING_MINIGAMES + unlockedMinigames` only.
5. Training mode shows all minigames regardless of unlock status — intentional.

If `starting: true`, no license is generated and the minigame is available immediately.

---

## Common Patterns Reference

### Phased game (display then interactive)

```ts
type Phase = "display" | "interactive";
const [phase, setPhase] = useState<Phase>("display");

useEffect(() => {
  timer.pause();
  const t = setTimeout(() => {
    setPhase("interactive");
    timer.start();
  }, DISPLAY_DURATION_MS);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // runs once on mount
```

### Stable puzzle generation

```ts
const puzzle = useMemo(
  () => generatePuzzle(getParams(difficulty)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [], // intentionally empty — difficulty is stable per game instance
);
```

### Keyboard cursor management

```ts
const [cursorIndex, setCursorIndex] = useState(0);
const cursorIndexRef = useRef(0);

useEffect(() => {
  cursorIndexRef.current = cursorIndex;
}, [cursorIndex]);

const handleUp = useCallback(() => {
  setCursorIndex((prev) => {
    const val = Math.max(0, prev - 1);
    cursorIndexRef.current = val; // keep ref in sync immediately
    return val;
  });
}, []);
```

Always read `cursorIndexRef.current` (not state) inside event handlers to avoid stale closures.

### Delayed fail with visual feedback

```ts
resolvedRef.current = true;
setSelectedItem(wrongItem);      // show wrong selection highlighted
setTimeout(() => fail(), 400);  // then resolve
```

### Reading window-extend from both run-shop and meta upgrades

```ts
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

### Sequential timeouts with resolvedRef guard

```ts
const startCycle = useCallback(() => {
  if (resolvedRef.current) return;
  setPhase("phase-a");

  timeoutRef.current = setTimeout(() => {
    if (resolvedRef.current) return;
    setPhase("phase-b");

    timeoutRef.current = setTimeout(() => {
      if (resolvedRef.current) return;
      startCycle(); // restart
    }, PHASE_B_DURATION);
  }, PHASE_A_DURATION);
}, []);
```

Store the handle in a ref and clear it on unmount:

```ts
const clearPhaseTimeout = useCallback(() => {
  if (timeoutRef.current !== null) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}, []);

useEffect(() => {
  startCycle();
  return () => clearPhaseTimeout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
