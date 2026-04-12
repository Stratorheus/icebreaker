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
│   │   ├── layout/          # HUD, TimerBar, ScanlineOverlay, TouchControls,
│   │   │                    # MinigameShell, ArrowKeyHints, GameCell,
│   │   │                    # CipherDisplay, HiddenMobileInput, ProgressDots
│   │   ├── minigames/       # One file per minigame component (15 total)
│   │   ├── screens/         # Full-screen views (MainMenu, RunShop, DeathScreen,
│   │   │                    # MetaShop, Training, Codex, Stats, MinigameScreen,
│   │   │                    # MilestoneOverlay, About, Support, Onboarding)
│   │   └── ui/              # CyberButton, ScreenHeader, ResultFlash,
│   │                        # CountdownDisplay, ConfirmDialog
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
│   ├── hooks/               # React hooks (timer, keyboard, touch detection,
│   │                        # achievements, cipher minigame)
│   ├── lib/                 # Pure utilities (maze generator, power-up effects,
│   │                        # achievement checker, constants, utils)
│   ├── store/
│   │   ├── game-store.ts    # Zustand store composition + persistence
│   │   ├── run-slice.ts     # All in-run state and actions
│   │   ├── meta-slice.ts    # Persistent state (data, upgrades, achievements, stats)
│   │   └── shop-slice.ts    # Shop generation and purchase logic
│   ├── __tests__/           # Unit tests (Vitest)
│   │   ├── helpers/         # Test utilities (createTestStore)
│   │   ├── balancing.test.ts
│   │   ├── run-slice.test.ts
│   │   ├── meta-slice.test.ts
│   │   └── ...
│   └── types/
│       ├── game.ts          # MinigameType union, PowerUpEffect, PlayerStats
│       ├── minigame.ts      # MinigameProps, MinigameResult
│       └── shop.ts          # MetaUpgrade, RunShopItem, Achievement
├── e2e/                     # E2E tests (Playwright)
│   ├── helpers/             # E2E test utilities
│   ├── minigames/           # Per-minigame E2E specs
│   ├── achievements.spec.ts
│   ├── floor-select.spec.ts
│   ├── run-economy.spec.ts
│   ├── run-shop.spec.ts
│   └── ...
├── docs/                    # Project documentation
│   ├── ARCHITECTURE.md
│   ├── ECONOMY.md
│   ├── ADDING-A-MINIGAME.md
│   ├── CONTRIBUTING.md
│   └── minigames/           # Per-minigame reference docs
├── .github/workflows/       # CI/CD pipelines (ci.yml, pr.yml, cd.yml)
├── Dockerfile
├── fly.toml
├── CLAUDE.md                # AI contributor guide
└── package.json
```

---

## Development Workflow

1. Branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. Make changes.

3. Run tests:
   ```bash
   npm test                    # Unit tests (Vitest)
   npm run test:watch          # Unit tests in watch mode
   ```

4. Typecheck before committing (same check the CI runs):
   ```bash
   npx tsc --noEmit
   ```

5. Verify the production build compiles cleanly:
   ```bash
   npm run build
   ```

6. For changes that affect gameplay, run E2E tests:
   ```bash
   npx playwright install --with-deps chromium   # First time only
   npm run test:e2e
   ```

7. Bump the version before opening a PR:
   ```bash
   npm version patch   # or minor/major as appropriate
   ```

8. Open a pull request against `main`. All CI checks must pass before merging.

The `npm run build` script runs `tsc -b && vite build`. Both must succeed; TypeScript errors block the build.

---

## Testing

### Unit Tests

Unit tests use **Vitest** and are located in `src/__tests__/`. They test:
- Pure functions in `balancing.ts`, `achievement-checker.ts`, `power-up-effects.ts`
- Store slice logic via `createTestStore()` (from `src/__tests__/helpers/test-store.ts`)
- Minigame registry integrity

```bash
npm test              # Run all unit tests once
npm run test:watch    # Run in watch mode (re-runs on file change)
```

### E2E Tests

E2E tests use **Playwright** and are located in `e2e/`. They test full gameplay flows, shop interactions, achievements, and minigame mechanics.

```bash
npx playwright install --with-deps chromium   # Install browsers (first time)
npm run test:e2e                               # Run all E2E tests
```

E2E tests manipulate game state directly via `window.__GAME_STORE__` (exposed in `game-store.ts`). Use `data-testid` attributes for element selection.

---

## Adding a New Minigame

The process is **2 files created + 2 small edits**. The minigame config file is the single source of truth -- display name, time limit, briefing, and meta upgrades all live there.

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
  metaUpgrades: [],
};
```

### 3. Add the type to the MinigameType union

In `src/types/game.ts`, add your identifier to `MinigameType`.

### 4. Add import + entry in the registry

In `src/data/minigames/registry.ts`, import the config and add it to `MINIGAME_REGISTRY`.

Everything else -- `MINIGAME_COMPONENTS`, `BASE_TIME_LIMITS`, `STARTING_MINIGAMES`, `UNLOCKABLE_MINIGAMES`, unlock licenses, and `buildMetaPowerUps` -- is derived automatically from the registry. No further edits are needed.

---

## Modifying Game Balance

All pure balance formulas are in `src/data/balancing.ts`. Each function is documented inline.

| Function | Controls |
|---|---|
| `getEffectiveDifficulty(floor, diffReducerTier)` | How fast difficulty ramps (affects time limits and credit payouts) |
| `getEffectiveDamage(floor, armorTier)` | HP lost per minigame failure |
| `getEffectiveCredits(timeMs, diff, ...)` | Credits awarded per win (base, speed bonus, meta stacking) |
| `getMinigamesPerFloor(floor, diffReducerTier)` | How many minigames appear per floor (power curve) |
| `getEffectiveDataReward(floor, dataSiphonTier)` | Base Data awarded when a floor is cleared |
| `getMilestoneBonus(floor)` | Bonus Data at every 5th floor |
| `getRunShopPrice(basePrice, floor)` | Run shop item price scaling |
| `getEffectiveTimeLimit(base, diff, floor, ...)` | Effective timer duration with all meta stacking |

The full breakdown of which constants to change for which outcome is in `docs/ECONOMY.md` under the Tuning Guide section.

---

## CI/CD

Three GitHub Actions workflows in `.github/workflows/`:

### `ci.yml` -- Feature Branch CI
Triggers on push to any non-main branch. Runs:
1. `npm ci`
2. `npx tsc --noEmit` (typecheck)
3. `npm test` (unit tests)
4. `npm run build` (production build)

### `pr.yml` -- Pull Request Checks
Triggers on PRs targeting main. Runs:
1. **Test job**: typecheck + unit tests + Playwright E2E tests
2. **Version check job**: verifies `package.json` version was bumped vs. main

### `cd.yml` -- Continuous Deployment
Triggers on push to main. Deploys to Fly.io via `flyctl deploy --remote-only` (requires `FLY_API_TOKEN` secret). Tests already passed via PR workflow.

The app is hosted on Fly.io (`ams` region, `shared-cpu-1x`, machines stop when idle). The Dockerfile builds a static Vite bundle and serves it with nginx on port 80. HTTPS is enforced by the Fly.io proxy (`force_https = true`).

There is no staging environment. Test locally with `npm run build && npm run preview` before pushing to `main`.

---

## Code Style

- **Tailwind v4** -- no CSS modules, no inline `style` props except for dynamic CSS custom properties (e.g. `style={{ color: "var(--color-currency-data)" }}`).
- **`font-mono` everywhere** -- all UI text uses the monospace font stack. Do not use proportional fonts.
- **Cyberpunk color palette** -- use the CSS custom properties defined in `src/index.css`:
  - `text-cyber-cyan` / `var(--color-cyber-cyan)` -- primary accent, interactive elements.
  - `text-cyber-magenta` / `var(--color-cyber-magenta)` -- danger, failure, death.
  - `text-cyber-green` / `var(--color-cyber-green)` -- success, health, positive.
  - `text-cyber-orange` / `var(--color-cyber-orange)` -- warnings, reroll, caution.
  - `var(--color-currency-credits)` -- credits (CR) currency color.
  - `var(--color-currency-data)` -- data currency color.
- **All text uppercase with wide tracking** -- use `uppercase tracking-widest` or `tracking-wider` consistently. Avoid sentence-case UI labels.
- **No external UI component libraries for game screens** -- the shadcn/ui components in `src/components/ui/` exist for structural primitives only. Minigame and HUD components are hand-built.
- **`cn()` for conditional classes** -- import from `@/lib/utils`, use instead of string concatenation.
- **Zustand store slices** -- state mutations go in the appropriate slice (`run-slice`, `meta-slice`, `shop-slice`). Do not call `set` from components directly.
- **Pure data files** -- `src/data/` files export only static data and pure functions. No React imports, no store access.
