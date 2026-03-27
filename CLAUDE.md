# Icebreaker -- AI Contributor Guide

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | ~5.7 |
| Bundler | Vite | 6 |
| Styling | Tailwind CSS | v4 |
| State | Zustand | 5 |
| Animation | Motion (framer-motion) | 12 |
| Icons | Lucide React | 0.469 |
| Toasts | Sonner | 2 |
| Unit Tests | Vitest | 4 |
| E2E Tests | Playwright | 1.58 |
| Node | 22 (pinned in CI) | |

## Naming Conventions

| What | Convention | Example |
|---|---|---|
| Component files | PascalCase `.tsx` | `SlashTiming.tsx`, `CyberButton.tsx` |
| Data/config files | kebab-case `.ts` | `slash-timing.ts`, `power-ups.ts` |
| Hook files | kebab-case with `use-` prefix | `use-minigame.ts`, `use-keyboard.ts` |
| Minigame IDs | kebab-case string literal | `"slash-timing"`, `"cipher-crack-v2"` |
| CSS classes | Tailwind utilities, `cn()` for conditional | `cn("text-cyber-cyan", active && "ring-2")` |
| Exports | Named exports only, no default exports | `export function SlashTiming(...)` |

## Design System Tokens

### CSS Variables (`src/index.css`)

```
--color-cyber-cyan: #00ffff       Primary accent, interactive elements
--color-cyber-magenta: #ff0066    Danger, failure, death
--color-cyber-green: #00ff41      Success, health, positive
--color-cyber-orange: #ff6600     Warnings, caution
--color-currency-credits: #FFD700  Credits (CR) — gold
--color-currency-data: #A855F7     Data — purple
--color-cyber-bg: #06060e         Base background
```

### Typography

- All UI text: `font-mono uppercase tracking-widest` (or `tracking-wider`)
- Headings: `font-heading` (Audiowide)
- Never use proportional fonts or sentence-case labels

### Glitch Classes

| Class | Use |
|---|---|
| `glitch-text` | Subtle chromatic aberration — minigame names, headings |
| `glitch-text-strong` | Heavy effect — death/milestone titles |
| `glitch-flicker` | Opacity flicker — countdown numbers |
| `glitch-subtle` | Light ambient — secondary text |

### Device-Specific Classes

```
.desktop-only   Hidden on touch devices (pointer: coarse)
.touch-only     Hidden on desktop (pointer: fine)
```

## Shared Component Reference

### Layout Components (`src/components/layout/`)

| Component | Purpose |
|---|---|
| `MinigameShell` | Consistent minigame wrapper (timer + content + controls) |
| `TimerBar` | Visual timer bar, takes `progress` (0-1) |
| `ArrowKeyHints` | Desktop-only arrow key hint icons |
| `GameCell` | Grid cell with cursor/hover states. Use `CURSOR_CLASSES`, `HOVER_CLASSES`, `cellStyles()` |
| `CipherDisplay` | Letter-by-letter cipher display (CipherCrack, CipherCrackV2) |
| `HiddenMobileInput` | Hidden input for system keyboard on mobile |
| `ProgressDots` | Dot progress indicator (e.g., expression 3/5) |
| `TouchControls` | DPad or BracketButtons for touch input |
| `HUD` | In-game HP, floor, credits display |
| `ScanlineOverlay` | CRT scanline effect |

### UI Primitives (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `CyberButton` | Styled button with variants and loading state |
| `ScreenHeader` | Title + subtitle + description layout |
| `ResultFlash` | SUCCESS/FAILED overlay between minigames |
| `CountdownDisplay` | 3-2-1-GO countdown |
| `ConfirmDialog` | Modal confirmation |

## Navigation Model

The app is a single-page state machine with no URL routing. All screens are driven by `status`:

```ts
type GameStatus = "menu" | "playing" | "shop" | "dead" | "training"
                | "codex" | "meta-shop" | "stats" | "milestone" | "paused";
```

Navigate between screens with `setStatus("target")`. `App.tsx` renders the matching screen component via a switch statement.

## Key Architectural Patterns

- **Minigame SSOT**: Each minigame is defined in `src/data/minigames/{id}.ts`. Config includes component ref, base time, briefing, and meta upgrades. Everything else is derived from `MINIGAME_REGISTRY`.
- **Store slices**: State mutations go in the appropriate slice (`run-slice`, `meta-slice`, `shop-slice`). Never call `set` from components directly.
- **Pure data files**: `src/data/` exports only static data and pure functions. No React imports, no store access.
- **`buildMetaPowerUps`**: Generic function in `registry.ts` converts meta upgrades to `PowerUpInstance` objects. No switch statements.
- **`useMinigame` hook**: Every minigame component uses this hook for timer, complete/fail callbacks, and isActive state.
- **Balancing centralization**: All formulas in `src/data/balancing.ts` as `getEffective*` functions. Callers use these, not raw formulas.
- **E2E store access**: `window.__GAME_STORE__` exposes the Zustand store for Playwright tests.

## Extension Recipes

### Adding a Run-Shop Item

1. Add entry to `RUN_SHOP_POOL` in `src/data/power-ups.ts` with `id`, `name`, `description`, `category`, `basePrice`, `effect`, `icon`.
2. If the effect type is new, add it to `PowerUpEffect.type` union in `src/types/game.ts`.
3. Handle the effect in the appropriate place: `run-slice.ts` (completeMinigame/failMinigame), `use-minigame.ts`, or the minigame component.

### Adding a Meta Upgrade

**Stat/defense/starting upgrade:**
1. Add to the appropriate file in `src/data/upgrades/` (`stat.ts`, `defense.ts`, or `starting.ts`).
2. Handle in `run-slice.ts` (`startRun`, `completeMinigame`, `failMinigame`, or `advanceFloor`).

**Game-specific upgrade:**
1. Add to the minigame's config file `metaUpgrades` array in `src/data/minigames/{id}.ts`.
2. Read via `activePowerUps` in the minigame component. It is automatically assembled.

### Adding a Screen

1. Create `src/components/screens/YourScreen.tsx`.
2. Add the status value to `GameStatus` in `src/types/game.ts`.
3. Add the case to `App.tsx` switch statement.
4. Navigate to it with `setStatus("your-status")`.

### Adding an Achievement

1. Add entry to `ACHIEVEMENT_POOL` in `src/data/achievements.ts`.
2. If the condition type is new, add it to `AchievementCondition` union in `src/types/shop.ts` and handle in `src/lib/achievement-checker.ts`.
3. Achievement checking is automatic -- `evaluateAndAwardAchievements()` runs after every minigame result.

### Adding a Minigame

Full guide in `docs/ADDING-A-MINIGAME.md`. Summary: 2 files created (component + config), 2 small edits (type union + registry entry).

## Testing Conventions

### Unit Tests (Vitest)

- Located in `src/__tests__/`
- Run: `npm test` (single run) or `npm run test:watch` (watch mode)
- Test store helper: `createTestStore()` from `src/__tests__/helpers/test-store.ts` -- creates an unpersisted store instance for testing
- Pure functions in `src/data/balancing.ts` and `src/lib/` are tested directly
- Store slices are tested via `createTestStore().getState().someAction()`

### E2E Tests (Playwright)

- Located in `e2e/`
- Run: `npm run test:e2e` (requires `npx playwright install --with-deps chromium` first)
- Use `data-testid` attributes for element selection
- Use `window.__GAME_STORE__` for state manipulation:
  ```ts
  await page.evaluate(() => {
    const store = (window as any).__GAME_STORE__;
    store.setState({ data: 5000 });
  });
  ```

### data-testid Convention

Add `data-testid` to interactive elements and key display elements. Use kebab-case names that describe the element's role: `data-testid="start-run-button"`, `data-testid="floor-display"`.

## Anti-Patterns

- **Do not** import from `@/store/game-store` in data files. Data files must be pure.
- **Do not** access `set()` from React components. Use store actions only.
- **Do not** call `onComplete` directly in minigame components. Use `useMinigame` hook's `complete()`/`fail()`.
- **Do not** use inline `style` props except for dynamic CSS custom properties.
- **Do not** use proportional fonts or sentence-case labels in game UI.
- **Do not** add external UI component libraries for game screens. shadcn/ui exists for structural primitives only.
- **Do not** put time limits or meta upgrade data in component files. They belong in `src/data/minigames/{id}.ts`.
- **Do not** use `BASE_TIME_LIMITS` or `MINIGAME_COMPONENTS` maps directly -- they are derived from the registry for backward compatibility. New code should read from `MINIGAME_REGISTRY[type]`.

## CI/CD

Three GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | Push to non-main branches | Typecheck + unit tests + build |
| `pr.yml` | PR to main | Typecheck + unit tests + E2E + version bump check |
| `cd.yml` | Push to main | Deploy to Fly.io |

**Version bump requirement:** PRs to main must bump `package.json` version. Use `npm version patch`, `npm version minor`, or `npm version major` before merging. The `pr.yml` workflow includes a `version-check` job that fails if the version is unchanged.

## Quick Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm test             # Run unit tests
npm run test:watch   # Run unit tests in watch mode
npm run test:e2e     # Run E2E tests (install Playwright first)
npx tsc --noEmit     # Typecheck only
npm run build        # Full production build (tsc + vite)
npm run preview      # Preview production build locally
```
