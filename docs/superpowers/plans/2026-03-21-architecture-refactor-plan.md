# Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish single-source-of-truth per-minigame config files, eliminate all data duplication (buildMetaPowerUps, MINIGAME_COMPONENTS, display names, briefings, time limits), and decompose global upgrades into categorical files.

**Architecture:** Each minigame gets one config file containing display name, component, base time, briefing, and meta upgrade definitions. A central registry builds derived data (component map, time limits, starting/unlockable lists) automatically. Global upgrades split into economy/survivability/starting files. buildMetaPowerUps becomes a generic function reading from the registry — no switch, no duplication.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-21-architecture-refactor-design.md`

---

## File Structure

```
CREATE:
  src/data/minigames/types.ts              ← MinigameConfig + MinigameBriefing interfaces
  src/data/minigames/registry.ts           ← MINIGAME_REGISTRY + derived data + buildMetaPowerUps
  src/data/minigames/slash-timing.ts       ← config for each minigame (15 files)
  src/data/minigames/close-brackets.ts
  src/data/minigames/type-backward.ts
  src/data/minigames/match-arrows.ts
  src/data/minigames/find-symbol.ts
  src/data/minigames/mine-sweep.ts
  src/data/minigames/wire-cutting.ts
  src/data/minigames/cipher-crack.ts
  src/data/minigames/cipher-crack-v2.ts
  src/data/minigames/defrag.ts
  src/data/minigames/network-trace.ts
  src/data/minigames/signal-echo.ts
  src/data/minigames/checksum-verify.ts
  src/data/minigames/port-scan.ts
  src/data/minigames/subnet-scan.ts
  src/data/upgrades/stat.ts                ← economy upgrades
  src/data/upgrades/defense.ts             ← survivability upgrades
  src/data/upgrades/starting.ts            ← starting bonus upgrades
  src/data/upgrades/registry.ts            ← META_UPGRADE_POOL builder

MODIFY:
  src/types/game.ts                        ← remove STARTING_MINIGAMES, UNLOCKABLE_MINIGAMES
  src/components/screens/MinigameScreen.tsx ← remove local maps, import from registry
  src/components/screens/Training.tsx       ← remove local maps, import from registry
  src/components/screens/Codex.tsx          ← remove ALL_MINIGAMES, import from registry
  src/components/screens/MetaShop.tsx       ← import META_UPGRADE_POOL from new location
  src/store/meta-slice.ts                  ← update STARTING_MINIGAMES import
  src/store/run-slice.ts                   ← update STARTING_MINIGAMES import

DELETE:
  src/data/minigame-names.ts
  src/data/minigame-descriptions.ts
  src/data/meta-upgrades.ts
```

---

## Task 1: Create MinigameConfig types

**Files:**
- Create: `src/data/minigames/types.ts`

- [ ] **Step 1:** Create `src/data/minigames/types.ts` with:

```ts
import type { MinigameType, PowerUpEffect } from "@/types/game";
import type { MinigameProps } from "@/types/minigame";
import type { MetaUpgrade } from "@/types/shop";

export interface MinigameBriefing {
  rules: string[];
  controls: {
    desktop: string;
    touch: string;
  };
  tips: string[];
  hint: {
    desktop: string;
    touch: string;
  };
}

export interface MinigameConfig {
  id: MinigameType;
  displayName: string;
  component: React.ComponentType<MinigameProps>;
  baseTimeLimit: number;
  starting: boolean;
  unlockPrice?: number | "dynamic";
  licenseId?: string;
  requires?: string;
  briefing: MinigameBriefing;
  metaUpgrades: MetaUpgrade[];
}
```

- [ ] **Step 2:** Verify tsc: `npx tsc --noEmit`

- [ ] **Step 3:** Commit: `feat: MinigameConfig types`

---

## Task 2: Create per-minigame config files (15 files)

**Files:**
- Create: `src/data/minigames/{id}.ts` — one per minigame

For each of the 15 minigames, create a config file that pulls together data currently scattered across:
- `minigame-names.ts` → `displayName`
- `minigame-descriptions.ts` → `briefing`
- `MinigameScreen.tsx` BASE_TIME_LIMITS → `baseTimeLimit`
- `MinigameScreen.tsx` MINIGAME_COMPONENTS → `component` (import)
- `game.ts` STARTING/UNLOCKABLE → `starting`
- `meta-upgrades.ts` → game-specific upgrades → `metaUpgrades`
- `meta-upgrades.ts` → unlock license → `unlockPrice`, `requires`

Each file follows this pattern:
```ts
// src/data/minigames/{id}.ts
import { ComponentName } from "@/components/minigames/ComponentName";
import type { MinigameConfig } from "./types";

export const {id}Config: MinigameConfig = {
  id: "{id}",
  displayName: "...",
  component: ComponentName,
  baseTimeLimit: N,
  starting: true/false,
  unlockPrice: N | "dynamic" | undefined,
  requires: "..." | undefined,
  briefing: { /* from minigame-descriptions.ts */ },
  metaUpgrades: [ /* from meta-upgrades.ts game-specific entries */ ],
};
```

- [ ] **Step 1:** Create all 15 config files by extracting data from existing sources. Copy data exactly — no logic changes.

The 15 minigames and their data sources:
1. `slash-timing` — starting, baseTime 8, metaUpgrades: [slash-window]
2. `close-brackets` — starting, baseTime 8, metaUpgrades: [bracket-reducer, bracket-mirror]
3. `type-backward` — starting, baseTime 18, metaUpgrades: [reverse-trainer]
4. `match-arrows` — starting, baseTime 8, metaUpgrades: [arrow-preview]
5. `mine-sweep` — starting, baseTime 15, metaUpgrades: [mine-echo]
6. `find-symbol` — unlockable 300, baseTime 12, metaUpgrades: [symbol-scanner]
7. `wire-cutting` — unlockable 300, baseTime 12, metaUpgrades: [wire-labels]
8. `cipher-crack` — unlockable 300, baseTime 12, metaUpgrades: [cipher-hint, decode-assist]
9. `defrag` — unlockable dynamic, baseTime 40, metaUpgrades: [mine-radar] *(note: spec example showing `unlockPrice: 300` for defrag is incorrect — actual value is `"dynamic"`)*
10. `network-trace` — unlockable dynamic, baseTime 20, metaUpgrades: [network-trace-highlight]
11. `signal-echo` — unlockable dynamic, baseTime 20, metaUpgrades: [signal-echo-slow]
12. `checksum-verify` — unlockable dynamic, baseTime 15, metaUpgrades: [error-margin, range-hint]
13. `port-scan` — unlockable dynamic, baseTime 15, metaUpgrades: [port-scan-deep, port-logger]
14. `subnet-scan` — unlockable dynamic, baseTime 20, metaUpgrades: [subnet-cidr-helper]
15. `cipher-crack-v2` — unlockable dynamic, requires cipher-crack-license, baseTime 15, metaUpgrades: [shift-marker, auto-decode-v2]

- [ ] **Step 2:** Verify tsc: `npx tsc --noEmit`

- [ ] **Step 3:** Commit: `feat: 15 per-minigame config files`

---

## Task 3: Create minigame registry

**Files:**
- Create: `src/data/minigames/registry.ts`

- [ ] **Step 1:** Create registry that imports all 15 configs, builds MINIGAME_REGISTRY, and exports derived data:

```ts
import type { MinigameType, PowerUpInstance, PowerUpEffect } from "@/types/game";
import type { MinigameConfig, MinigameBriefing } from "./types";
import type { MinigameProps } from "@/types/minigame";

// Import all 15 configs
import { slashTimingConfig } from "./slash-timing";
// ... all 15

export const MINIGAME_REGISTRY: Record<MinigameType, MinigameConfig> = {
  "slash-timing": slashTimingConfig,
  // ... all 15
};

// Derived data
export const MINIGAME_COMPONENTS = Object.fromEntries(
  Object.entries(MINIGAME_REGISTRY).map(([id, cfg]) => [id, cfg.component])
) as Record<MinigameType, React.ComponentType<MinigameProps>>;

export const BASE_TIME_LIMITS = Object.fromEntries(
  Object.entries(MINIGAME_REGISTRY).map(([id, cfg]) => [id, cfg.baseTimeLimit])
) as Record<MinigameType, number>;

export const STARTING_MINIGAMES: MinigameType[] = Object.values(MINIGAME_REGISTRY)
  .filter(cfg => cfg.starting).map(cfg => cfg.id);

export const UNLOCKABLE_MINIGAMES: MinigameType[] = Object.values(MINIGAME_REGISTRY)
  .filter(cfg => !cfg.starting).map(cfg => cfg.id);

export const ALL_MINIGAMES: MinigameType[] = Object.keys(MINIGAME_REGISTRY) as MinigameType[];

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

- [ ] **Step 2:** Verify tsc: `npx tsc --noEmit`

- [ ] **Step 3:** Commit: `feat: minigame registry with derived data + generic buildMetaPowerUps`

---

## Task 4: Create upgrade registries

**Files:**
- Create: `src/data/upgrades/stat.ts`
- Create: `src/data/upgrades/defense.ts`
- Create: `src/data/upgrades/starting.ts`
- Create: `src/data/upgrades/registry.ts`

- [ ] **Step 1:** Extract global upgrades from `meta-upgrades.ts` into 3 files:

**IMPORTANT: Do NOT change the `category` field on any upgrade. File grouping is by logical purpose, not by the `category` field value. All upgrades in these files have `category: "stat"` regardless of which file they're in.**

`stat.ts` — economy upgrades: hp-boost, credit-multiplier, data-siphon, difficulty-reducer, speed-tax, cascade-clock, delay-injector

`defense.ts` — survivability: thicker-armor, data-recovery, emergency-patch

`starting.ts` — starting bonuses: head-start, overclocked

Each file exports a `MetaUpgrade[]` array.

- [ ] **Step 2:** Create `registry.ts` that builds META_UPGRADE_POOL:

**WARNING: Some existing license IDs don't follow the `{id}-license` template (e.g. `wire-cutting-toolkit` instead of `wire-cutting-license`). For these, use the EXISTING ID from meta-upgrades.ts to preserve save compatibility. Override the auto-generated template with hardcoded IDs where needed. Set `licenseId` on the affected MinigameConfig entries (in Task 2) to the correct existing ID — the registry snippet below uses `cfg.licenseId ?? \`${cfg.id}-license\`` to honour the override.**

```ts
import { STAT_UPGRADES } from "./stat";
import { DEFENSE_UPGRADES } from "./defense";
import { STARTING_UPGRADES } from "./starting";
import { MINIGAME_REGISTRY } from "../minigames/registry";

export const META_UPGRADE_POOL = [
  ...STAT_UPGRADES,
  ...DEFENSE_UPGRADES,
  ...STARTING_UPGRADES,
  // Auto-generated minigame unlock licenses
  // licenseId on the config overrides the default "{id}-license" pattern
  // to preserve save compatibility for IDs that don't follow the template.
  ...Object.values(MINIGAME_REGISTRY)
    .filter(cfg => !cfg.starting && cfg.unlockPrice != null)
    .map(cfg => ({
      id: cfg.licenseId ?? `${cfg.id}-license`,
      name: `${cfg.displayName} License`,
      description: `Unlocks the ${cfg.displayName} protocol.`,
      category: "minigame-unlock" as const,
      maxTier: 1,
      prices: [cfg.unlockPrice === "dynamic" ? 0 : cfg.unlockPrice as number],
      effects: [{ type: "unlock-minigame", value: 1, minigame: cfg.id }],
      ...(cfg.unlockPrice === "dynamic" ? { dynamicPrice: true } : {}),
      ...(cfg.requires ? { requires: cfg.requires } : {}),
    })),
  // Game-specific upgrades from minigame configs
  ...Object.values(MINIGAME_REGISTRY).flatMap(cfg => cfg.metaUpgrades),
];
```

- [ ] **Step 3:** Verify tsc: `npx tsc --noEmit`

- [ ] **Step 4:** Commit: `feat: decomposed upgrade registries`

---

## Task 5: Wire consumers to new registry — MinigameScreen.tsx

**Files:**
- Modify: `src/components/screens/MinigameScreen.tsx`

- [ ] **Step 1:** Replace all local maps and buildMetaPowerUps with registry imports:

- Remove `MINIGAME_COMPONENTS` map (lines ~303-320)
- Remove `BASE_TIME_LIMITS` map (lines ~285-300)
- Remove `buildMetaPowerUps` function (lines ~328-430)
- Remove all 15 minigame component imports at top of file
- Add: `import { MINIGAME_COMPONENTS, BASE_TIME_LIMITS, buildMetaPowerUps } from "@/data/minigames/registry";`
- Update `STARTING_MINIGAMES` import from `@/types/game` to `@/data/minigames/registry`

- [ ] **Step 2:** Verify tsc + build: `npm run build`

- [ ] **Step 3:** Commit: `refactor: MinigameScreen uses minigame registry`

---

## Task 6: Wire consumers — Training.tsx

**Files:**
- Modify: `src/components/screens/Training.tsx`

- [ ] **Step 1:** Replace all local maps and buildMetaPowerUps:

- Remove `MINIGAME_COMPONENTS` map (lines ~49-68)
- Remove `buildMetaPowerUps` function (lines ~74-154)
- Remove all 15 minigame component imports
- Add: `import { MINIGAME_COMPONENTS, buildMetaPowerUps } from "@/data/minigames/registry";`
- Remove `import { MINIGAME_BRIEFINGS } from "@/data/minigame-descriptions"` → `import { getMinigameBriefing } from "@/data/minigames/registry"`
- Update all `MINIGAME_BRIEFINGS[type]` → `getMinigameBriefing(type)`
- Remove `import type { MinigameBriefing } from "@/data/minigame-descriptions"` → `import type { MinigameBriefing } from "@/data/minigames/types"`
- Remove `import { META_UPGRADE_POOL } from "@/data/meta-upgrades"` → `import { META_UPGRADE_POOL } from "@/data/upgrades/registry"`

- [ ] **Step 2:** Verify tsc + build: `npm run build`

- [ ] **Step 3:** Commit: `refactor: Training uses minigame registry`

---

## Task 7: Wire consumers — Codex.tsx, MetaShop.tsx, stores

**Files:**
- Modify: `src/components/screens/Codex.tsx`
- Modify: `src/components/screens/MetaShop.tsx`
- Modify: `src/store/meta-slice.ts`
- Modify: `src/store/run-slice.ts`
- Modify: `src/types/game.ts`

- [ ] **Step 1:** Codex.tsx:
- Remove `ALL_MINIGAMES` local array
- Remove `import { MINIGAME_BRIEFINGS }` and `import type { MinigameBriefing }`
- Add: `import { ALL_MINIGAMES, getMinigameBriefing } from "@/data/minigames/registry"`
- Add: `import type { MinigameBriefing } from "@/data/minigames/types"`
- Update `MINIGAME_BRIEFINGS[type]` → `getMinigameBriefing(type)`
- Also update `UNLOCKABLE_MINIGAMES` import in Codex.tsx from `@/types/game` to `@/data/minigames/registry`

- [ ] **Step 2:** MetaShop.tsx:
- Replace `import { META_UPGRADE_POOL } from "@/data/meta-upgrades"` with `import { META_UPGRADE_POOL } from "@/data/upgrades/registry"`
- Also update `STARTING_MINIGAMES` import from `@/types/game` to `@/data/minigames/registry`

- [ ] **Step 3:** meta-slice.ts and run-slice.ts:
- Replace `import { STARTING_MINIGAMES } from "@/types/game"` with `import { STARTING_MINIGAMES } from "@/data/minigames/registry"`

- [ ] **Step 4:** game.ts:
- Remove `STARTING_MINIGAMES` and `UNLOCKABLE_MINIGAMES` exports (keep `MinigameType` union)

- [ ] **Step 5:** Update any other files that import from the deleted modules. Grep for:
- `from "@/data/minigame-names"`
- `from "@/data/minigame-descriptions"`
- `from "@/data/meta-upgrades"`

Update all to new paths.

- [ ] **Step 6:** Verify tsc + build: `npm run build`

- [ ] **Step 7:** Commit: `refactor: all consumers wired to registries`

---

## Task 8: Delete old files + final cleanup

**Files:**
- Delete: `src/data/minigame-names.ts`
- Delete: `src/data/minigame-descriptions.ts`
- Delete: `src/data/meta-upgrades.ts`

- [ ] **Step 1:** Delete the 3 old files

- [ ] **Step 2:** Verify no remaining imports reference deleted files: grep for `minigame-names`, `minigame-descriptions`, `meta-upgrades` across entire `src/`

- [ ] **Step 3:** Full build: `npm run build`

- [ ] **Step 4:** Verify the app works: `npm run dev` and test menu → start run → play minigame → shop → codex → training → meta shop

- [ ] **Step 5:** Commit: `refactor: delete old scattered data files`

---

## Task 9: Update documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/CONTRIBUTING.md`
- Modify: `docs/ADDING-A-MINIGAME.md`

- [ ] **Step 1:** Update ARCHITECTURE.md: describe new registry pattern, updated file structure, buildMetaPowerUps as generic function

- [ ] **Step 2:** Update CONTRIBUTING.md: update project structure tree, point to new file locations

- [ ] **Step 3:** Update ADDING-A-MINIGAME.md: rewrite to reflect the new 2-file + 2-edit process. Old 7+ file checklist replaced with new streamlined steps.

- [ ] **Step 4:** Commit: `docs: update architecture/contributing for registry pattern`

---

## Task Dependency Graph

```
Task 1 (types)
  → Task 2 (15 config files)
    → Task 3 (registry)
      → Task 4 (upgrade registries)
        → Task 5 (MinigameScreen)
        → Task 6 (Training)
        → [Tasks 5 and 6 both complete]
          → Task 7 (Codex, MetaShop, stores, game.ts)
            → Task 8 (delete old files)
              → Task 9 (docs)
```

> **Note:** Tasks 5 and 6 can run in parallel after Task 4, but Task 7 must not start until **both** are complete — Task 7 deletes exports that Tasks 5 and 6 still depend on during their own wiring.
