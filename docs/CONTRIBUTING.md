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
│   │   ├── meta-upgrades.ts # META_UPGRADE_POOL — persistent upgrades
│   │   ├── minigame-descriptions.ts  # Rules, controls, hints for every minigame
│   │   ├── minigame-names.ts         # Display name map
│   │   ├── power-ups.ts     # RUN_SHOP_POOL — in-run shop items
│   │   └── achievements.ts  # ACHIEVEMENT_POOL
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

Follow these steps in order. Every step is required; skipping any will cause a TypeScript error.

### 1. Create the component

Add `src/components/minigames/YourMinigame.tsx`. The component must implement `MinigameProps` from `src/types/minigame.ts`:

```typescript
import type { MinigameProps } from "@/types/minigame";

export function YourMinigame({ difficulty, timeLimit, activePowerUps, onComplete }: MinigameProps) {
  // ...
  // Call onComplete({ success: true/false, timeMs: elapsed, minigame: "your-minigame-id" })
}
```

`timeLimit` is in seconds (already scaled by `getTimeLimit`). `difficulty` is 0–1. `activePowerUps` merges run-shop items and synthetic meta-upgrade effects.

### 2. Add the type to the MinigameType union

In `src/types/game.ts`, add your new identifier to the `MinigameType` union:

```typescript
export type MinigameType =
  | "slash-timing"
  | ...
  | "your-minigame-id";   // add here
```

Decide whether it is a starting minigame or unlockable. Starting minigames are in `STARTING_MINIGAMES`. Unlockable minigames go in `UNLOCKABLE_MINIGAMES`. Most new minigames should be unlockable.

### 3. Register the component in the router

In `src/components/screens/MinigameScreen.tsx`, import your component and add it to `MINIGAME_COMPONENTS`:

```typescript
import { YourMinigame } from "@/components/minigames/YourMinigame";

const MINIGAME_COMPONENTS: Record<MinigameType, ...> = {
  ...
  "your-minigame-id": YourMinigame,
};
```

### 4. Set the base time limit

In the same file, add an entry to `BASE_TIME_LIMITS`:

```typescript
const BASE_TIME_LIMITS: Record<MinigameType, number> = {
  ...
  "your-minigame-id": 15,  // seconds; choose based on task complexity
};
```

This is the time given at difficulty 0. `getTimeLimit` compresses it down to 60% at max difficulty, and further after floor 15.

### 5. Add a display name

In `src/data/minigame-names.ts`, add to `MINIGAME_DISPLAY_NAMES`:

```typescript
"your-minigame-id": "Protocol Name",
```

### 6. Add briefing and hint text

In `src/data/minigame-descriptions.ts`, add a `MinigameBriefing` entry to `MINIGAME_BRIEFINGS`:

```typescript
"your-minigame-id": {
  rules: ["Rule 1", "Rule 2"],
  controls: {
    desktop: "Keyboard controls description",
    touch: "Touch controls description",
  },
  tips: ["Tip 1", "Tip 2"],
  hint: {
    desktop: "Short hint for countdown phase (desktop).",
    touch: "Short hint for countdown phase (touch).",
  },
},
```

The `hint` text is shown during the countdown when the player has a Hint Module power-up active.

### 7. Add a protocol license (if unlockable)

If the minigame is unlockable (not in `STARTING_MINIGAMES`), add a license entry to `META_UPGRADE_POOL` in `src/data/meta-upgrades.ts`:

```typescript
{
  id: "your-minigame-license",
  name: "Your Protocol License",
  description: "Unlocks the Your Protocol for future runs.",
  category: "minigame-unlock",
  maxTier: 1,
  prices: [0],  // 0 = use dynamic pricing (200 + unlocksOwned * 100)
  effects: [{ type: "unlock-minigame", value: 1, minigame: "your-minigame-id" }],
},
```

Use `prices: [300]` instead of `[0]` only if you want a fixed price (as the first three unlocks have).

### 8. (Optional) Add game-specific meta upgrades

If you want meta upgrades that assist this minigame specifically, add them to `META_UPGRADE_POOL` with `category: "game-specific"` and handle the synthetic power-up construction in the `buildMetaPowerUps` switch in `MinigameScreen.tsx`.

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
