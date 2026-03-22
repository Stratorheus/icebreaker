# Contributing to Icebreaker

---

## Prerequisites

- **Node.js 22** (the CI pipeline pins to 22; mismatches will cause build failures).
- **npm** (bundled with Node; no alternative package manager is configured).

---

## Setup

```bash
git clone <repo-url>
cd icebreaker
npm install
npm run dev
```

The dev server starts on `http://localhost:5173` (Vite default). Hot module replacement is enabled; no full reload is needed for most changes.

---

## Project Structure

```
icebreaker/
├── src/
│   ├── components/
│   │   ├── layout/          # HUD, TimerBar, ScanlineOverlay, TouchControls
│   │   ├── minigames/       # One file per minigame component
│   │   └── screens/         # Full-screen views (MainMenu, RunShop, DeathScreen, etc.)
│   ├── data/
│   │   ├── balancing.ts     # All game math (pure functions, no side effects)
│   │   ├── power-ups.ts     # RUN_SHOP_POOL — in-run shop items
│   │   ├── achievements.ts  # ACHIEVEMENT_POOL
│   │   ├── minigames/       # Per-minigame config files (SSOT)
│   │   │   ├── types.ts     # MinigameConfig and MinigameBriefing interfaces
│   │   │   ├── registry.ts  # MINIGAME_REGISTRY, derived data, buildMetaPowerUps
│   │   │   ├── slash-timing.ts
│   │   │   ├── close-brackets.ts
│   │   │   └── ... (one file per minigame)
│   │   └── upgrades/        # Meta upgrade data split by category
│   │       ├── stat.ts      # Stackable/tiered stat upgrades
│   │       ├── defense.ts   # Defense and healing upgrades
│   │       ├── starting.ts  # Starting bonus upgrades
│   │       └── registry.ts  # META_UPGRADE_POOL assembled from all sources
│   ├── hooks/               # React hooks (timer, keyboard, touch detection, achievements)
│   ├── lib/                 # Pure utilities (maze generator, power-up effects, etc.)
│   ├── store/
│   │   ├── game-store.ts    # Zustand store composition + persistence
│   │   ├── run-slice.ts     # All in-run state and actions
│   │   ├── meta-slice.ts    # Persistent state (data, upgrades, achievements, stats)
│   │   └── shop-slice.ts    # Shop generation and purchase logic
│   └── types/
│       ├── game.ts          # MinigameType union, PowerUpEffect, PlayerStats
│       ├── minigame.ts      # MinigameProps, MinigameResult
│       └── shop.ts          # MetaUpgrade, RunShopItem, Achievement
├── docs/                    # Project documentation
├── .github/workflows/       # CI/CD pipeline
├── Dockerfile
├── fly.toml
└── package.json
```

---

## Development Workflow

1. Branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. Make changes.

3. Typecheck before committing (same check the CI runs):
   ```bash
   npx tsc --noEmit
   ```

4. Verify the production build compiles cleanly:
   ```bash
   npm run build
   ```

5. Open a pull request against `main`. The CI pipeline must pass before merging.

The `npm run build` script runs `tsc -b && vite build`. Both must succeed; TypeScript errors block the build.

---

## Adding a New Minigame

The process is **2 files created + 2 small edits**. The minigame config file is the single source of truth — display name, time limit, briefing, and meta upgrades all live there.

See `docs/ADDING-A-MINIGAME.md` for the full guide with templates.

### 1. Create the component

Add `src/components/minigames/YourMinigame.tsx` implementing `MinigameProps` from `src/types/minigame.ts`.

### 2. Create the config file

Add `src/data/minigames/your-minigame-id.ts`. This is the SSOT for everything about the minigame:

```typescript
import { YourMinigame } from "@/components/minigames/YourMinigame";
import type { MinigameConfig } from "./types";

export const yourMinigameConfig: MinigameConfig = {
  id: "your-minigame-id",
  displayName: "Your Protocol",
  component: YourMinigame,
  baseTimeLimit: 15,
  starting: false,
  unlockPrice: "dynamic",
  briefing: {
    rules: ["Rule 1", "Rule 2"],
    controls: { desktop: "Keyboard description", touch: "Touch description" },
    tips: ["Tip 1", "Tip 2"],
    hint: { desktop: "Short desktop hint.", touch: "Short touch hint." },
  },
  metaUpgrades: [],  // add game-specific MetaUpgrade objects here if needed
};
```

### 3. Add the type to the MinigameType union

In `src/types/game.ts`, add your identifier to `MinigameType`:

```typescript
export type MinigameType =
  | "slash-timing"
  | ...
  | "your-minigame-id";   // add here
```

### 4. Add import + entry in the registry

In `src/data/minigames/registry.ts`, import the config and add it to `MINIGAME_REGISTRY`:

```typescript
import { yourMinigameConfig } from "./your-minigame-id";

export const MINIGAME_REGISTRY: Record<MinigameType, MinigameConfig> = {
  // ... existing entries ...
  "your-minigame-id": yourMinigameConfig,
};
```

Everything else — `MINIGAME_COMPONENTS`, `BASE_TIME_LIMITS`, `STARTING_MINIGAMES`, `UNLOCKABLE_MINIGAMES`, unlock licenses, and `buildMetaPowerUps` — is derived automatically from the registry. No further edits are needed.

---

## Modifying Game Balance

All pure balance formulas are in `src/data/balancing.ts`. Each function is documented inline.

| Function | Controls |
|---|---|
| `getDifficulty(floor)` | How fast difficulty ramps (affects time limits and credit payouts) |
| `getDamage(floor)` | HP lost per minigame failure |
| `getCredits(timeMs, difficulty)` | Credits awarded per win (base amount and speed bonus) |
| `getMinigamesPerFloor(floor)` | How many minigames appear per floor (caps at 8) |
| `getDataReward(floor)` | Base Data awarded when a floor is cleared |
| `getMilestoneBonus(floor)` | Bonus Data at every 5th floor |
| `getRunShopPrice(basePrice, floor)` | Run shop item price scaling |
| `getTimeLimit(baseTime, difficulty, floor)` | Effective timer duration |

The full breakdown of which constants to change for which outcome is in `docs/ECONOMY.md` under the Tuning Guide section.

---

## Deployment

Pushing to `main` triggers the CI/CD pipeline in `.github/workflows/fly-deploy.yml`:

1. **Build & Typecheck** — runs `npx tsc --noEmit` then `npm run build`.
2. **Deploy to Fly.io** — runs `flyctl deploy --remote-only` (requires `FLY_API_TOKEN` secret). Deploy only happens if the build job passes.

The app is hosted on Fly.io (`ams` region, `shared-cpu-1x`, machines stop when idle). The Dockerfile builds a static Vite bundle and serves it with nginx on port 80. HTTPS is enforced by the Fly.io proxy (`force_https = true`).

There is no staging environment. Test locally with `npm run build && npm run preview` before pushing to `main`.

---

## Code Style

- **Tailwind v4** — no CSS modules, no inline `style` props except for dynamic CSS custom properties (e.g. `style={{ color: "var(--color-currency-data)" }}`).
- **`font-mono` everywhere** — all UI text uses the monospace font stack. Do not use proportional fonts.
- **Cyberpunk color palette** — use the CSS custom properties defined in `src/index.css`:
  - `text-cyber-cyan` / `var(--color-cyber-cyan)` — primary accent, interactive elements.
  - `text-cyber-magenta` / `var(--color-cyber-magenta)` — danger, failure, death.
  - `text-cyber-green` / `var(--color-cyber-green)` — success, health, positive.
  - `text-cyber-orange` / `var(--color-cyber-orange)` — warnings, reroll, caution.
  - `var(--color-currency-credits)` — credits (CR) currency color.
  - `var(--color-currency-data)` — data (◆) currency color.
- **All text uppercase with wide tracking** — use `uppercase tracking-widest` or `tracking-wider` consistently. Avoid sentence-case UI labels.
- **No external UI component libraries for game screens** — the shadcn/ui components in `src/components/ui/` exist for structural primitives only. Minigame and HUD components are hand-built.
- **`cn()` for conditional classes** — import from `@/lib/utils`, use instead of string concatenation.
- **Zustand store slices** — state mutations go in the appropriate slice (`run-slice`, `meta-slice`, `shop-slice`). Do not call `set` from components directly.
- **Pure data files** — `src/data/` files export only static data and pure functions. No React imports, no store access.
