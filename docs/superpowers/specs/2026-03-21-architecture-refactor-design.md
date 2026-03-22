# Architecture Refactor — Design Spec

## Goal

Eliminate data duplication and establish single-source-of-truth for all minigame-related data. Achieve SoD (Segregation of Duties), DRY, KISS, and SSOT across the codebase. Adding a new minigame should require creating 2 files + 2 small edits (add to type union + add import/entry to registry).

## Current Problems

1. **buildMetaPowerUps** — duplicated switch statement in MinigameScreen.tsx AND Training.tsx (must be kept in sync manually)
2. **MINIGAME_COMPONENTS** — duplicated map in MinigameScreen.tsx AND Training.tsx
3. **ALL_MINIGAMES** in Codex.tsx — manually maintained array, no compile guard if entry missing
4. **7+ files** must be edited to add a new minigame
5. **Effect type mismatches** — meta-upgrades.ts defines one type, buildMetaPowerUps emits another (discovered during audit)
6. **Game-specific upgrades** split between meta-upgrades.ts (definition) and buildMetaPowerUps (mapping) — two places that must agree

## New Structure

```
src/data/
├── minigames/
│   ├── types.ts             ← MinigameConfig interface
│   ├── registry.ts          ← builds complete registry from imports + generic buildMetaPowerUps
│   ├── slash-timing.ts      ← everything for Slash Timing
│   ├── close-brackets.ts
│   ├── type-backward.ts
│   ├── match-arrows.ts
│   ├── find-symbol.ts
│   ├── mine-sweep.ts
│   ├── wire-cutting.ts
│   ├── cipher-crack.ts
│   ├── cipher-crack-v2.ts
│   ├── defrag.ts
│   ├── network-trace.ts
│   ├── signal-echo.ts
│   ├── checksum-verify.ts
│   ├── port-scan.ts
│   └── subnet-scan.ts       (15 config files)
├── upgrades/
│   ├── stat.ts              ← economy upgrades (credit-multiplier, data-siphon, difficulty-reducer, speed-tax, cascade-clock, delay-injector)
│   ├── defense.ts           ← survivability upgrades (thicker-armor, data-recovery, emergency-patch, hp-boost)
│   ├── starting.ts          ← head-start, overclocked
│   └── registry.ts          ← builds META_UPGRADE_POOL from all sources
                               Note: file grouping is by logical purpose, not by the `category` field value on each upgrade.
├── balancing.ts             ← unchanged (pure functions)
├── power-ups.ts             ← unchanged (run-shop items)
├── achievements.ts          ← unchanged (opt-in per minigame)
└── words.ts                 ← unchanged
```

## MinigameConfig Interface

```ts
// src/data/minigames/types.ts

interface MinigameConfig {
  /** Internal ID — must match MinigameType union */
  id: MinigameType;
  /** Human-readable display name */
  displayName: string;
  /** React component that renders the minigame */
  component: React.ComponentType<MinigameProps>;
  /** Base time limit in seconds (before difficulty/meta scaling) */
  baseTimeLimit: number;
  /** true = available from run 1; false = must be unlocked in meta shop */
  starting: boolean;
  /**
   * Price for the unlock license (only for unlockable minigames).
   * Use 'dynamic' for minigames that use the formula 200 + unlocksOwned * 100.
   * Fixed prices are used for the first 3 unlockable minigames (300 each).
   */
  unlockPrice?: number | "dynamic";
  /** Unlock prerequisite: this minigame requires another to be unlocked first */
  requires?: string;
  /** Player-facing briefing (rules, controls, tips, hints) */
  briefing: MinigameBriefing;
  /** Game-specific meta upgrades — DEFINED here, not in meta-upgrades.ts */
  metaUpgrades: MetaUpgrade[];
}

/** MinigameBriefing interface moves from src/data/minigame-descriptions.ts to src/data/minigames/types.ts */
```

## Per-Minigame Config Example

```ts
// src/data/minigames/defrag.ts

import { Defrag } from "@/components/minigames/Defrag";
import type { MinigameConfig } from "./types";

export const defragConfig: MinigameConfig = {
  id: "defrag",
  displayName: "Defrag",
  component: Defrag,
  baseTimeLimit: 40,
  starting: false,
  unlockPrice: 300,
  briefing: {
    rules: [
      "Grid of hidden cells — some contain mines",
      "Uncover cells to reveal numbers (count of adjacent mines)",
      "Cells with 0 adjacent mines auto-expand in a flood fill",
      "Uncover all safe cells to win — hitting a mine = fail",
    ],
    controls: {
      desktop: "Arrow keys to move, SPACE to uncover, ENTER to flag. Mouse: L-click uncover, R-click flag",
      touch: "TAP to uncover (toggle FLAG mode for flagging)",
    },
    tips: [
      "Use numbers to deduce mine positions — flag suspected mines",
      "Start near the center for better odds of hitting a 0-cell cascade",
    ],
    hint: {
      desktop: "Tap cells to uncover, avoid mines. Numbers = adjacent mine count.",
      touch: "Tap cells to uncover, avoid mines. Numbers = adjacent mine count.",
    },
  },
  metaUpgrades: [
    {
      id: "mine-radar",
      name: "Mine Radar",
      description: "Shows mine count per row and column for 25/50/75/100% of the timer in Defrag.",
      category: "game-specific",
      maxTier: 4,
      prices: [150, 300, 500, 750],
      effects: [
        { type: "minigame-specific", value: 0.25, minigame: "defrag" },
        { type: "minigame-specific", value: 0.50, minigame: "defrag" },
        { type: "minigame-specific", value: 0.75, minigame: "defrag" },
        { type: "minigame-specific", value: 1.0, minigame: "defrag" },
      ],
    },
  ],
};
```

## Minigame Registry

```ts
// src/data/minigames/registry.ts

import { slashTimingConfig } from "./slash-timing";
import { closeBracketsConfig } from "./close-brackets";
// ... all 15

export const MINIGAME_REGISTRY: Record<MinigameType, MinigameConfig> = {
  "slash-timing": slashTimingConfig,
  "close-brackets": closeBracketsConfig,
  // ... all 15
};

// Derived data — NO duplication, computed from registry
export const MINIGAME_COMPONENTS = Object.fromEntries(
  Object.entries(MINIGAME_REGISTRY).map(([id, cfg]) => [id, cfg.component])
) as Record<MinigameType, React.ComponentType<MinigameProps>>;

export const BASE_TIME_LIMITS = Object.fromEntries(
  Object.entries(MINIGAME_REGISTRY).map(([id, cfg]) => [id, cfg.baseTimeLimit])
) as Record<MinigameType, number>;

export const STARTING_MINIGAMES = Object.values(MINIGAME_REGISTRY)
  .filter(cfg => cfg.starting)
  .map(cfg => cfg.id);

export const UNLOCKABLE_MINIGAMES = Object.values(MINIGAME_REGISTRY)
  .filter(cfg => !cfg.starting)
  .map(cfg => cfg.id);

export const ALL_MINIGAMES = Object.keys(MINIGAME_REGISTRY) as MinigameType[];

export function getMinigameDisplayName(type: MinigameType): string {
  return MINIGAME_REGISTRY[type].displayName;
}

export function getMinigameBriefing(type: MinigameType): MinigameBriefing {
  return MINIGAME_REGISTRY[type].briefing;
}

export function getMinigameHint(type: MinigameType, isTouch: boolean): string {
  const b = MINIGAME_REGISTRY[type].briefing;
  return isTouch ? b.hint.touch : b.hint.desktop;
}
```

## Generic buildMetaPowerUps

```ts
// src/data/minigames/registry.ts

export function buildMetaPowerUps(
  purchasedUpgrades: Record<string, number>,
  type: MinigameType,
): PowerUpInstance[] {
  const config = MINIGAME_REGISTRY[type];
  const synth: PowerUpInstance[] = [];

  for (const upgrade of config.metaUpgrades) {
    const tier = purchasedUpgrades[upgrade.id] ?? 0;
    if (tier <= 0) continue;
    const effect = upgrade.effects[tier - 1] ?? upgrade.effects[upgrade.effects.length - 1];
    synth.push({
      id: `meta-${upgrade.id}`,
      type: `meta-${upgrade.id}`,
      name: upgrade.name,
      description: upgrade.description,
      effect: {
        type: effect.type as PowerUpEffect["type"],
        value: effect.value,
        minigame: effect.minigame,
      },
    });
  }

  return synth;
}
```

No switch, no duplication. Both MinigameScreen and Training call this single function.

> **Important:** each minigame with multiple upgrades must use DISTINCT effect types to avoid collision when the component reads `activePowerUps`. Example: `checksum-verify` uses `'hint'` for Error Margin and `'preview'` for Range Hint.

## Upgrade Registry

```ts
// src/data/upgrades/registry.ts

import { STAT_UPGRADES } from "./stat";
import { DEFENSE_UPGRADES } from "./defense";
import { STARTING_UPGRADES } from "./starting";
import { MINIGAME_REGISTRY } from "../minigames/registry";

// Build complete META_UPGRADE_POOL from all sources
export const META_UPGRADE_POOL: MetaUpgrade[] = [
  ...STAT_UPGRADES,
  ...DEFENSE_UPGRADES,
  ...STARTING_UPGRADES,
  // Minigame unlock licenses (auto-generated from registry)
  ...Object.values(MINIGAME_REGISTRY)
    .filter(cfg => !cfg.starting && cfg.unlockPrice)
    .map(cfg => ({
      id: `${cfg.id}-license`,
      name: `${cfg.displayName} License`,
      description: `Unlocks the ${cfg.displayName} protocol.`,
      category: "minigame-unlock" as const,
      maxTier: 1,
      prices: [cfg.unlockPrice === "dynamic" ? 0 : cfg.unlockPrice!],
      effects: [{ type: "unlock-minigame", value: 1, minigame: cfg.id }],
      ...(cfg.unlockPrice === "dynamic" ? { dynamicPrice: true } : {}),
      ...(cfg.requires ? { requires: cfg.requires } : {}),
    })),
  // Game-specific upgrades (collected from all minigame configs)
  ...Object.values(MINIGAME_REGISTRY).flatMap(cfg => cfg.metaUpgrades),
];
```

## What Gets Deleted

| Old File/Location | Replaced By |
|---|---|
| `src/data/minigame-names.ts` | `registry.getMinigameDisplayName()` |
| `src/data/minigame-descriptions.ts` | Replaced by: per-config briefings + registry helper functions |
| `MINIGAME_COMPONENTS` in MinigameScreen.tsx | `registry.MINIGAME_COMPONENTS` |
| `MINIGAME_COMPONENTS` in Training.tsx | `registry.MINIGAME_COMPONENTS` |
| `BASE_TIME_LIMITS` in MinigameScreen.tsx | `registry.BASE_TIME_LIMITS` |
| `buildMetaPowerUps` in MinigameScreen.tsx | `registry.buildMetaPowerUps` |
| `buildMetaPowerUps` in Training.tsx | `registry.buildMetaPowerUps` |
| `ALL_MINIGAMES` in Codex.tsx | `registry.ALL_MINIGAMES` |
| `STARTING_MINIGAMES` in game.ts | `registry.STARTING_MINIGAMES` |
| `UNLOCKABLE_MINIGAMES` in game.ts | `registry.UNLOCKABLE_MINIGAMES` |
| Game-specific entries in meta-upgrades.ts | Per-minigame config files |
| Minigame unlock entries in meta-upgrades.ts | Auto-generated in upgrade registry |

## What Stays Unchanged

- `MinigameType` union in `game.ts` — type safety backbone
- `balancing.ts` — pure functions
- `power-ups.ts` — run-shop items (not minigame-specific)
- `achievements.ts` — opt-in, not mandatory per minigame
- All 15 minigame components in `src/components/minigames/`
- `src/hooks/` — all hooks unchanged
- `src/store/` — store slices need updated imports (`STARTING_MINIGAMES` moves from `@/types/game` to registry) but logic is unchanged

## Import Path Changes

The following files import `STARTING_MINIGAMES` from `@/types/game` today. After the refactor they must import it from `@/data/minigames/registry` instead:

- `src/store/meta-slice.ts`
- `src/store/run-slice.ts`
- `src/components/screens/MinigameScreen.tsx`
- `src/components/screens/MetaShop.tsx`

No logic changes are needed — only the import path changes.

## Adding a New Minigame — After Refactor

1. Create `src/components/minigames/NewGame.tsx` (the component)
2. Create `src/data/minigames/new-game.ts` (the config — everything in one place)
3. Add `"new-game"` to `MinigameType` union in `src/types/game.ts` (one line)
4. Add import + entry in `src/data/minigames/registry.ts` (two lines)

4 edits total, 2 files created. Compile errors catch any omission in steps 3-4 because the registry is `Record<MinigameType, MinigameConfig>`.

## What NOT to Do

- Don't change minigame component internals — they still receive `MinigameProps` and read `activePowerUps` the same way
- Don't move run-shop items into minigame configs — they're cross-cutting, not minigame-specific
- Don't change the store slices — they just import from different paths
- Don't auto-generate `MinigameType` union — keep it explicit for TypeScript exhaustiveness checks
