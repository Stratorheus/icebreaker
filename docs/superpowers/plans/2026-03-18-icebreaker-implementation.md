# Icebreaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cyberpunk roguelike browser minigame collection with run progression, dual economy, and meta-progression.

**Architecture:** Single-page React app, no router. Zustand store with 3 slices drives all screen transitions. Each minigame is an isolated component receiving difficulty, returning success/time. localStorage for meta-persistence.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4 (CSS-first), shadcn/ui (new-york, dark-only), Zustand v5, motion v12+, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-18-icebreaker-design.md`

---

## File Structure

```
src/
├── main.tsx                          # Entry point
├── App.tsx                           # Screen router (switch on status)
├── index.css                         # Design system, Tailwind, fonts, scanlines
│
├── types/
│   ├── game.ts                       # Core types: MinigameType, GameStatus, PowerUp, etc.
│   ├── minigame.ts                   # MinigameProps, MinigameResult interfaces
│   └── shop.ts                       # ShopItem, MetaUpgrade, Achievement types
│
├── data/
│   ├── balancing.ts                  # Damage formulas, credit calc, difficulty mapping
│   ├── power-ups.ts                  # Run shop item pool (15+ items)
│   ├── meta-upgrades.ts              # Meta shop upgrade pool (20+ items)
│   ├── achievements.ts               # Achievement definitions (20+ achievements)
│   └── words.ts                      # Tech word list for Type Backward
│
├── store/
│   ├── game-store.ts                 # Combined Zustand store
│   ├── run-slice.ts                  # Run state: HP, floor, inventory, status
│   ├── meta-slice.ts                 # Persistent: data, unlocks, upgrades, achievements, stats
│   └── shop-slice.ts                 # Generated shop offers
│
├── hooks/
│   ├── use-game-timer.ts             # Shared countdown timer hook
│   ├── use-keyboard.ts               # Keyboard event hook
│   └── use-minigame.ts               # Shared minigame lifecycle (start, complete, fail)
│
├── components/
│   ├── layout/
│   │   ├── HUD.tsx                   # Top bar: HP, floor, credits, inventory
│   │   ├── TimerBar.tsx              # Animated timer (cyan → orange → magenta)
│   │   └── ScanlineOverlay.tsx       # CSS scanline effect
│   │
│   ├── screens/
│   │   ├── MainMenu.tsx              # Start run, meta shop, codex, stats
│   │   ├── RunShop.tsx               # Between-floor shop
│   │   ├── MetaShop.tsx              # Permanent upgrade shop
│   │   ├── DeathScreen.tsx           # Run summary, data earned
│   │   ├── Codex.tsx                 # Minigame rules reference
│   │   ├── Training.tsx              # Briefing + trial rounds
│   │   └── MinigameScreen.tsx        # Countdown → minigame → result
│   │
│   └── minigames/
│       ├── SlashTiming.tsx           # Minigame 1
│       ├── CloseBrackets.tsx         # Minigame 2
│       ├── TypeBackward.tsx          # Minigame 3
│       ├── MatchArrows.tsx           # Minigame 4
│       ├── FindSymbol.tsx            # Minigame 5
│       ├── MineSweep.tsx             # Minigame 6
│       ├── WireCutting.tsx           # Minigame 7
│       └── CipherCrack.tsx           # Minigame 8
│
├── lib/
│   ├── utils.ts                      # cn() utility
│   ├── run-generator.ts              # Floor minigame selection, difficulty calc
│   └── achievement-checker.ts        # Check + award achievements after events
│
└── components/ui/                    # shadcn components (button, card, dialog, progress, etc.)
```

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/lib/utils.ts`, `components.json`, `.gitignore`

- [ ] **Step 1: Init Vite project**

```bash
cd /c/Projects/icebreaker
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
npm install zustand motion lucide-react class-variance-authority clsx tailwind-merge tw-animate-css
npm install -D @tailwindcss/vite tailwindcss@latest
```

- [ ] **Step 3: Configure Vite with Tailwind v4**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Update `tsconfig.app.json` to add `@/*` path alias.

- [ ] **Step 4: Set up shadcn/ui**

```bash
npx shadcn@latest init
```

Select: new-york style, zinc base color, CSS variables, `@/` aliases. Config `""` for Tailwind v4.

- [ ] **Step 5: Write design system in index.css**

`src/index.css` — Tailwind v4 imports, custom properties for cyberpunk palette:
- `--color-cyber-cyan: #00ffff`
- `--color-cyber-magenta: #ff0066`
- `--color-cyber-green: #00ff41`
- `--color-cyber-orange: #ff6600`
- `--color-cyber-bg: #06060e`
- Monospace font stack (JetBrains Mono, Fira Code, Cascadia Code)
- Scanline overlay as repeating-linear-gradient
- Dark-only: `class="dark"` on html

- [ ] **Step 6: Create placeholder App.tsx**

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-cyber-bg text-white font-mono">
      <h1 className="text-cyber-cyan text-4xl text-center pt-20">
        <span className="text-cyber-cyan">ICE</span>
        <span className="text-cyber-magenta">BREAKER</span>
      </h1>
    </div>
  );
}
```

- [ ] **Step 7: Verify dev server runs**

```bash
npm run dev
```

Open localhost, verify cyberpunk title renders with correct colors.

- [ ] **Step 8: Init git + commit**

```bash
git init
git add .
git commit -m "feat: project scaffold — Vite, React 19, Tailwind v4, shadcn/ui, cyberpunk design system"
```

---

### Task 2: Types & Interfaces

**Files:**
- Create: `src/types/game.ts`, `src/types/minigame.ts`, `src/types/shop.ts`

- [ ] **Step 1: Define core game types**

`src/types/game.ts`:
```ts
// Extends spec's 5 statuses with 'codex' and 'meta-shop' for direct navigation
// Spec routes these through main menu, but dedicated statuses simplify App.tsx routing
export type GameStatus = "menu" | "playing" | "shop" | "dead" | "training" | "codex" | "meta-shop" | "stats";

export type MinigameType =
  | "slash-timing"
  | "close-brackets"
  | "type-backward"
  | "match-arrows"
  | "find-symbol"
  | "mine-sweep"
  | "wire-cutting"
  | "cipher-crack";

export const STARTING_MINIGAMES: MinigameType[] = [
  "slash-timing",
  "close-brackets",
  "type-backward",
  "match-arrows",
  "mine-sweep",
];

export const UNLOCKABLE_MINIGAMES: MinigameType[] = [
  "find-symbol",
  "wire-cutting",
  "cipher-crack",
];

export interface PowerUpInstance {
  id: string;
  type: string;
  name: string;
  description: string;
  effect: PowerUpEffect;
}

export interface PowerUpEffect {
  type: "time-bonus" | "shield" | "skip" | "heal" | "minigame-specific";
  value: number;
  minigame?: MinigameType;
}

export interface PlayerStats {
  totalRuns: number;
  bestFloor: number;
  totalMinigamesPlayed: number;
  totalMinigamesWon: number;
  totalCreditsEarned: number;
  totalDataEarned: number;
  totalPlayTimeMs: number;
}
```

- [ ] **Step 2: Define minigame interfaces**

`src/types/minigame.ts`:
```ts
import type { MinigameType, PowerUpInstance } from "./game";

export interface MinigameProps {
  difficulty: number; // 0-1 scale
  timeLimit: number; // seconds
  activePowerUps: PowerUpInstance[];
  onComplete: (result: MinigameResult) => void;
}

export interface MinigameResult {
  success: boolean;
  timeMs: number;
  minigame: MinigameType;
}
```

- [ ] **Step 3: Define shop types**

`src/types/shop.ts`:
```ts
import type { MinigameType } from "./game";

export interface RunShopItem {
  id: string;
  name: string;
  description: string;
  category: "time" | "defense" | "skip" | "healing" | "vision" | "assist";
  basePrice: number;
  effect: { type: string; value: number; minigame?: MinigameType };
  icon: string;
}

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  category: "stat" | "starting-bonus" | "minigame-unlock" | "game-specific";
  maxTier: number;
  prices: number[]; // price per tier
  effects: { type: string; value: number; minigame?: MinigameType }[];
  requires?: string; // prerequisite upgrade id
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: AchievementCondition;
  reward: number; // data
  icon: string;
}

export type AchievementCondition =
  | { type: "floor-reached"; floor: number }
  | { type: "floor-no-damage"; floor: number }
  | { type: "speed-run"; floors: [number, number]; maxTimeMs: number }
  | { type: "minigame-streak"; minigame: MinigameType; count: number }
  | { type: "minigame-speed"; minigame: MinigameType; maxTimeMs: number }
  | { type: "inventory-count"; count: number }
  | { type: "floor-no-powerups" }
  | { type: "total-runs"; count: number }
  | { type: "total-minigames"; count: number };
```

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: define core TypeScript types — game, minigame, shop interfaces"
```

---

### Task 3: Balancing Data & Content Pools

**Files:**
- Create: `src/data/balancing.ts`, `src/data/power-ups.ts`, `src/data/meta-upgrades.ts`, `src/data/achievements.ts`, `src/data/words.ts`

- [ ] **Step 1: Balancing formulas**

`src/data/balancing.ts` — pure functions:
- `getDifficulty(floor)` → `min(floor / 20, 1.0)`
- `getDamage(floor)` → `15 + floor * 3`
- `getCredits(timeMs, difficulty)` → base 20 × difficulty multiplier × speed bonus
- `getMinigamesPerFloor(floor)` → `min(1 + floor, 8)`
- `getDataReward(floor)` → `floor * 10`
- `getMilestoneBonus(floor)` → lookup for 5/10/15/20
- `getRunShopPrice(basePrice, floor)` → `basePrice * (1 + floor * 0.15)`

- [ ] **Step 2: Power-up pool (15+ items)**

`src/data/power-ups.ts` — `RunShopItem[]` covering all categories. Include creative items beyond spec examples (e.g., "Overclock" = next minigame at 0.75x speed, "Mirror Shield" = reflect damage as bonus CR, "Ghost Protocol" = invisible cursor in Mine Sweep reveals nearby mines).

- [ ] **Step 3: Meta upgrade pool (20+ items)**

`src/data/meta-upgrades.ts` — `MetaUpgrade[]` with tiered stat upgrades, starting bonuses, minigame unlocks, game-specific upgrades. Expand beyond spec examples.

- [ ] **Step 4: Achievement pool (20+ achievements)**

`src/data/achievements.ts` — `Achievement[]` mixing progression, skill, playstyle, and cumulative achievements.

- [ ] **Step 5: Tech word list**

`src/data/words.ts` — 100+ tech words for Type Backward, categorized by length (short: 4-5 chars, medium: 6-7, long: 8+). Examples: kernel, daemon, socket, proxy, buffer, malloc, mutex, thread, cache, docker, nginx, redis, kafka, grafana, kubectl, webhook, payload, firewall.

- [ ] **Step 6: Commit**

```bash
git add src/data/
git commit -m "feat: add balancing formulas, power-up/upgrade/achievement pools, word list"
```

---

### Task 4: Zustand Store

**Files:**
- Create: `src/store/run-slice.ts`, `src/store/meta-slice.ts`, `src/store/shop-slice.ts`, `src/store/game-store.ts`

- [ ] **Step 1: Run slice**

`src/store/run-slice.ts` — state + actions:
- State: `hp`, `maxHp`, `floor`, `currentMinigameIndex`, `floorMinigames`, `inventory`, `credits`, `runScore`, `status`, `runStartTime`
- Actions: `startRun()`, `nextMinigame()`, `completeMinigame(result)`, `failMinigame()`, `takeDamage(amount)`, `heal(amount)`, `addCredits(amount)`, `addPowerUp(item)`, `usePowerUp(id)`, `advanceFloor()`, `setStatus(status)`, `endRun()`

- [ ] **Step 2: Meta slice (persisted)**

`src/store/meta-slice.ts` — uses Zustand persist middleware:
- State: `data`, `unlockedMinigames`, `purchasedUpgrades`, `achievements`, `stats`, `seenBriefings`
- Actions: `addData(amount)`, `spendData(amount)`, `unlockMinigame(type)`, `purchaseUpgrade(id)`, `unlockAchievement(id)`, `markBriefingSeen(type)`, `updateStats(partial)`

- [ ] **Step 3: Shop slice**

`src/store/shop-slice.ts`:
- State: `runShopOffers`, `metaShopItems`
- Actions: `generateRunShop(floor)`, `buyRunShopItem(index)`, `generateMetaShop()`

- [ ] **Step 4: Combined store**

`src/store/game-store.ts` — merges all slices into single `useGameStore` hook with persist for meta slice only.

- [ ] **Step 5: Commit**

```bash
git add src/store/
git commit -m "feat: Zustand store — run, meta (persisted), shop slices"
```

---

### Task 5: Shared Hooks

**Files:**
- Create: `src/hooks/use-game-timer.ts`, `src/hooks/use-keyboard.ts`, `src/hooks/use-minigame.ts`

- [ ] **Step 1: Game timer hook**

`src/hooks/use-game-timer.ts`:
- `useGameTimer(totalMs, onExpire)` → `{ timeLeft, progress, isRunning, start, pause, addTime }`
- Uses `requestAnimationFrame` for smooth updates
- `progress` is 0-1 for timer bar

- [ ] **Step 2: Keyboard hook**

`src/hooks/use-keyboard.ts`:
- `useKeyboard(keyMap)` — registers keydown handlers, cleans up on unmount
- `useKeyPress(key, callback)` — single key listener

- [ ] **Step 3: Minigame lifecycle hook**

`src/hooks/use-minigame.ts`:
- `useMinigame(props: MinigameProps)` — wraps timer + completion/failure handling
- Returns `{ timer, complete, fail, isActive }`
- Calls `props.onComplete` with result

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: shared hooks — game timer, keyboard input, minigame lifecycle"
```

---

## Phase 2: Core UI Shell

### Task 6: Layout Components

**Files:**
- Create: `src/components/layout/ScanlineOverlay.tsx`, `src/components/layout/TimerBar.tsx`, `src/components/layout/HUD.tsx`
- Install: `npx shadcn@latest add button card dialog progress badge`

- [ ] **Step 1: Scanline overlay**

Pure CSS overlay component. Absolutely positioned, pointer-events none.

- [ ] **Step 2: Timer bar**

Receives `progress: number` (0-1). Renders a bar transitioning cyan → orange → magenta via gradient stops. Uses motion for smooth width animation.

- [ ] **Step 3: HUD**

Top bar showing: logo, floor number, HP bar (green), credits (magenta), inventory power-up icons. Reads from `useGameStore`.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ src/components/ui/
git commit -m "feat: layout components — HUD, TimerBar, ScanlineOverlay + shadcn primitives"
```

---

### Task 7: Screen Shell & Routing

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/screens/MainMenu.tsx`, `src/components/screens/DeathScreen.tsx`, `src/components/screens/MinigameScreen.tsx`, `src/components/screens/RunShop.tsx`

- [ ] **Step 1: App.tsx screen router**

Switch on `useGameStore().status`:
- `menu` → `<MainMenu />`
- `playing` → `<MinigameScreen />`
- `shop` → `<RunShop />`
- `dead` → `<DeathScreen />`
- `training` → `<Training />`
- `codex` → `<Codex />`
- `meta-shop` → `<MetaShop />`

Wrap in `<ScanlineOverlay />`.

- [ ] **Step 2: Main Menu (functional)**

Logo, "START RUN" button (calls `startRun()`), "META SHOP" button, "CODEX" button. Terminal aesthetic with `>_` prompts. Show best floor stat from meta store.

- [ ] **Step 3: Death Screen (functional)**

Run summary: floor reached, minigames played/won, credits earned, data earned. "RETURN TO MENU" button. Animated data counter.

- [ ] **Step 4: MinigameScreen shell**

Shows minigame name + 2s countdown (per spec) → renders minigame component by type → shows result (success/fail flash) → calls store action. HUD visible throughout.

- [ ] **Step 5: RunShop shell**

Displays `runShopOffers` as cards. Buy button spends credits. "CONTINUE" advances to next floor. HUD visible.

- [ ] **Step 6: Create early run-generator.ts**

`src/lib/run-generator.ts` — implement `generateFloor(floor, unlockedMinigames)` now (needed for game loop). Returns `MinigameType[]` of length `min(1 + floor, 8)`, randomly selected from unlocked pool.

- [ ] **Step 7: Verify full loop works**

Start run → see countdown → (placeholder minigame auto-succeeds) → shop → next floor → eventually die → death screen → menu. All screen transitions work.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/screens/
git commit -m "feat: screen shell — menu, minigame screen, run shop, death screen, full game loop"
```

---

## Phase 3: Minigames

Each minigame is an isolated task. All follow the same interface: receive `MinigameProps`, call `onComplete(result)`.

### Task 8: Slash Timing

**Files:** Create `src/components/minigames/SlashTiming.tsx`

- [ ] **Step 1: Implement** — 3-phase cycle (GUARD/PREPARE/ATTACK). Visual indicator for each phase. Space to strike during ATTACK. Difficulty narrows ATTACK window (from 800ms at d=0 to 300ms at d=1) and shortens PREPARE (from 500ms to 200ms).
- [ ] **Step 2: Test manually** — verify phases cycle, hitting ATTACK window succeeds, missing fails.
- [ ] **Step 3: Commit**

### Task 9: Close Brackets

**Files:** Create `src/components/minigames/CloseBrackets.tsx`

- [ ] **Step 1: Implement** — Generate random opening sequence from `( [ { < | \`. Display sequence. Player types matching closers in reverse order. Pairs: `()`, `[]`, `{}`, `<>`, `||`, `\/`. Difficulty increases bracket count (3 at d=0, 8 at d=1) and reduces time.
- [ ] **Step 2: Test manually** — verify correct/incorrect input handling, timer.
- [ ] **Step 3: Commit**

### Task 10: Type Backward

**Files:** Create `src/components/minigames/TypeBackward.tsx`

- [ ] **Step 1: Implement** — Select random tech words from `words.ts`. Display word, player types it backward. Multiple words in sequence. Difficulty: more words (2 at d=0, 5 at d=1), longer words, shorter time per word.
- [ ] **Step 2: Test manually**
- [ ] **Step 3: Commit**

### Task 11: Match Arrows

**Files:** Create `src/components/minigames/MatchArrows.tsx`

- [ ] **Step 1: Implement** — Generate row of hidden arrows. Reveal first one. Player presses matching arrow key. Correct → confirms, reveals next. Wrong → fail. Difficulty: longer row (4 at d=0, 10 at d=1), shorter reaction time per arrow.
- [ ] **Step 2: Test manually**
- [ ] **Step 3: Commit**

### Task 12: Find Symbol

**Files:** Create `src/components/minigames/FindSymbol.tsx`

- [ ] **Step 1: Implement** — Grid of random symbols (Unicode/ASCII: ◆ ◇ ■ □ ▲ △ ● ○ ★ ☆ etc.). Target sequence shown at top. Player must click/navigate to current target in order. Cannot skip. Difficulty: larger grid (4x4 → 6x6), longer sequence (2 → 5), more visually similar symbols.
- [ ] **Step 2: Test manually**
- [ ] **Step 3: Commit**

### Task 13: Mine Sweep

**Files:** Create `src/components/minigames/MineSweep.tsx`

- [ ] **Step 1: Implement** — Grid shows mines for preview period, then hides them. Player marks cells where mines were. Difficulty: larger grid (3x3 → 5x5), more mines (2 → 8), shorter preview (3s → 1s).
- [ ] **Step 2: Test manually**
- [ ] **Step 3: Commit**

### Task 14: Wire Cutting

**Files:** Create `src/components/minigames/WireCutting.tsx`

- [ ] **Step 1: Implement** — Display colored wires (numbered 1-N) + instruction set ("Cut red before blue", "Skip green", "Cut yellow last"). Player presses number keys in correct order. Difficulty: more wires (3 → 7), more complex rule combinations.
- [ ] **Step 2: Test manually**
- [ ] **Step 3: Commit**

### Task 15: Cipher Crack

**Files:** Create `src/components/minigames/CipherCrack.tsx`

- [ ] **Step 1: Implement** — Display encrypted word + cipher hint (e.g., "ROT-3", "A→D substitution"). Player types decrypted word. Difficulty: harder ciphers (ROT → multi-step substitution), longer words, shorter time.
- [ ] **Step 2: Test manually**
- [ ] **Step 3: Commit**

- [ ] **Step 4 (all minigames): Integration commit**

```bash
git add src/components/minigames/
git commit -m "feat: implement all 8 minigames — slash, brackets, type, arrows, symbol, mines, wires, cipher"
```

---

## Phase 4: Economy & Meta Systems

### Task 16: Run Shop (full)

**Files:** Modify `src/components/screens/RunShop.tsx`, `src/store/shop-slice.ts`

- [ ] **Step 1:** Wire up `generateRunShop(floor)` — picks 3-4 random items from pool, applies floor price scaling.
- [ ] **Step 2:** Implement buy flow — spend credits, add to inventory, remove from offers.
- [ ] **Step 3:** Style cards with cyberpunk aesthetic, show item effects clearly.
- [ ] **Step 4: Commit**

### Task 17: Meta Shop

**Files:** Create `src/components/screens/MetaShop.tsx`

- [ ] **Step 1:** Display upgrade categories (stat, starting-bonus, unlock, game-specific). Show current tier, next tier price, effect preview.
- [ ] **Step 2:** Implement purchase flow — spend data, increment tier, apply effect.
- [ ] **Step 3:** Minigame unlock → trigger training flow.
- [ ] **Step 4: Commit**

### Task 18: Power-Up Effects

**Files:** Create `src/lib/power-up-effects.ts`, modify minigame components

- [ ] **Step 1:** Implement power-up effect application — Time Freeze auto-activates on next minigame start (adds to timer), Shield negates next damage, Skip advances minigame index, Heal restores HP. Enforce no-stacking-same-type constraint in `addPowerUp()` — reject if inventory already contains same `type`.
- [ ] **Step 2:** Wire game-specific meta upgrades into minigame props. Each upgrade modifies the `MinigameProps` or adds to `activePowerUps`:
  - Bracket Reducer → pass `removedBracketType` to CloseBrackets
  - Mine Echo / Mine Memory → pass `visibleMinesAfterPreview` count to MineSweep
  - Symbol Scanner → pass `hintProximity: true` to FindSymbol
  - Arrow Preview → pass `preRevealedCount` to MatchArrows
- [ ] **Step 3: Commit**

### Task 19: Achievement System

**Files:** Create `src/lib/achievement-checker.ts`, modify store

- [ ] **Step 1:** `checkAchievements(state)` — evaluates all unearned achievements against current state. Called after minigame completion, floor completion, run end.
- [ ] **Step 2:** Achievement notification toast on unlock (use sonner/shadcn).
- [ ] **Step 3:** Achievement display in stats or dedicated screen.
- [ ] **Step 4: Commit**

### Task 20: Training System

**Files:** Create `src/components/screens/Training.tsx`

- [ ] **Step 1:** Full briefing screen (minigame name, rules, controls, visual example).
- [ ] **Step 2:** 2-3 trial rounds on easy difficulty, outside of run. Results don't affect stats.
- [ ] **Step 3:** After training, mark briefing as seen, return to menu.
- [ ] **Step 4: Commit**

### Task 21: Stats Screen

**Files:** Create `src/components/screens/Stats.tsx`

- [ ] **Step 1:** Display all `PlayerStats` fields from meta store — total runs, best floor, minigames played/won, credits/data earned, total play time. Terminal-styled table layout.
- [ ] **Step 2:** Show achieved/locked achievements with progress indicators.
- [ ] **Step 3:** Accessible from main menu via "STATS" button (status → `'stats'`).
- [ ] **Step 4: Commit**

### Task 22: Codex

**Files:** Create `src/components/screens/Codex.tsx`

- [ ] **Step 1:** List all unlocked minigames with rules, controls, tips.
- [ ] **Step 2:** Accessible from main menu. Terminal-styled scrollable list.
- [ ] **Step 3: Commit**

---

## Phase 5: Run Orchestration & Polish

### Task 22: Run Generator & Floor Logic

**Files:** Create `src/lib/run-generator.ts`, modify `src/store/run-slice.ts`

- [ ] **Step 1:** `generateFloor(floor, unlockedMinigames)` — returns `MinigameType[]` of length `min(1 + floor, 8)`, randomly selected from unlocked pool (repeats allowed).
- [ ] **Step 2:** Wire into store — `advanceFloor()` generates next floor, resets minigame index.
- [ ] **Step 3:** Milestone detection — at floors 5/10/15/20, add bonus data + show full-screen announcement overlay ("ICE LAYER 2 BREACHED") with auto-dismiss after 3s or keypress. Cyberpunk styled with glitch text effect.
- [ ] **Step 4:** Apply meta upgrades to run start (Overclocked → 110 HP, Quick Boot → random power-up).
- [ ] **Step 5: Commit**

### Task 23: Full Integration Test

- [ ] **Step 1:** Play through complete loop manually: menu → run → multiple floors → shop → death → meta shop → run again. Verify:
  - HP decreases on fail
  - Credits earned and spent correctly
  - Data awarded at end of run
  - Meta upgrades persist across runs
  - Achievements fire correctly
  - Training triggers on first unlock
- [ ] **Step 2:** Fix any integration issues found.
- [ ] **Step 3: Commit**

---

## Phase 6: GitHub & PR

### Task 24: GitHub Repository

- [ ] **Step 1: Create repo**

```bash
gh repo create icebreaker --public --description "Cyberpunk roguelike browser minigame collection" --source . --remote origin
```

- [ ] **Step 2: Push**

```bash
git push -u origin main
```

- [ ] **Step 3: Create feature branch + PR**

```bash
git checkout -b feat/v1-game
git push -u origin feat/v1-game
gh pr create --title "feat: Icebreaker v1 — complete game" --body "..."
```

- [ ] **Step 4: Run /code-review on PR**

Use code-review plugin to review the PR with multi-agent pipeline.

---

## Task Dependency Graph

```
Task 1 (scaffold)
  → Task 2 (types)
    → Task 3 (data pools)
      → Task 4 (store) — depends on Task 3 for shop data imports
        → Task 5 (hooks)
          → Task 6 (layout)
            → Task 7 (screen shell + early run-generator)
              → Tasks 8-15 (minigames, parallel)
                → Task 16 (run shop full)
                → Task 17 (meta shop)
                → Task 18 (power-up effects)
                → Task 19 (achievements)
                → Task 20 (training)
                → Task 21 (stats)
                → Task 22 (codex)
                  → Task 23 (run orchestration polish)
                    → Task 24 (integration test)
                      → Task 25 (GitHub + PR)
```

**Follow-up (not in v1 scope):** motion/animation polish — glow effects, shake on damage, pulse on timer, glitch transitions. Deferred per spec.
