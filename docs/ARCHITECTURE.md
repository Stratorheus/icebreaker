# Icebreaker Architecture

## 1. Overview

Icebreaker is a cyberpunk-themed roguelike browser minigame collection. The player runs an "ICE-breaker" program attempting to breach deeper into a system, floor by floor. Each floor presents a sequence of timed minigame challenges (called "protocols"). Success earns credits (in-run currency) and data (persistent currency). Failure costs HP. When HP reaches zero, the run ends and accumulated data is banked (minus a death penalty) for spending on permanent meta upgrades.

### High-Level Flow

```
Menu
 -> Start Run (applies meta upgrades, optional floor select)
    -> Floor N
       -> Generate floor minigames (power-curve scaled count)
       -> For each minigame:
          -> Countdown (3-2-1-GO, ~2 s)
          -> Active minigame (timed)
          -> Result flash (1 s)
          -> completeMinigame (success) / failMinigame (HP loss, re-roll)
       -> Floor complete
          -> Milestone overlay (every 5th floor)
          -> Run Shop (buy power-ups with credits)
          -> Advance to next floor
    -> HP reaches 0 -> Death Screen
       -> Data breakdown (base + drip + credits saved + milestones - penalty + achievements)
       -> Bank data to persistent store
       -> Return to Menu
 -> Meta Shop (spend data on permanent upgrades)
 -> Training (practice individual minigames)
 -> Codex (minigame rules reference)
 -> Stats (lifetime statistics)
```

Status values driving the router (`GameStatus`):

```ts
type GameStatus = "menu" | "playing" | "shop" | "dead" | "training"
                | "codex" | "meta-shop" | "stats" | "milestone" | "paused";
```

`App.tsx` renders the appropriate screen component based on `status`. There is no client-side URL routing; the entire app is a single-page state machine. Navigation is done via `setStatus()`.

---

## 2. State Management

The store uses **Zustand** with three slices composed into a single flat store:

```ts
export type GameStore = RunSlice & MetaSlice & ShopSlice;
```

Created in `src/store/game-store.ts` with `zustand/middleware/persist`.

### RunSlice (`src/store/run-slice.ts`)

Owns all ephemeral per-run state. Reset on every `startRun()`.

Key state: `hp`, `maxHp`, `floor`, `startFloor`, `currentMinigameIndex`, `floorMinigames`, `inventory` (power-ups), `credits`, `creditsEarnedThisRun`, `runScore`, `status`, `milestoneFloor`, `milestoneDataThisRun`, `dataDripThisRun`, `itemsBoughtThisRun`, `quitVoluntarily`, `floorDamageTaken`, `runDamageTaken`, `timeSiphonBonus`, `cascadeClockPct`, `consecutiveFloorsNoDamage`, `floorCompletionTimestamps`, `lastMinigameResult`, `creditsSpentThisShop`, `consecutiveFloorsNoShop`, `lastDamageTaken`, `currentWinStreak`, `trainingMinigame`, `trainingOrigin`, `previousStatus`, `powerUpsUsedThisFloor`, `minigamesWonThisRun`, `minigamesPlayedThisRun`, `dataAtRunStart`, `runStartTime`.

Key actions: `startRun`, `completeMinigame`, `failMinigame`, `advanceFloor`, `skipRemainingFloor`, `takeDamage`, `heal`, `addCredits`, `addPowerUp`, `usePowerUp`, `pauseRun`, `resumeRun`, `quitRun`, `endRun`, `dismissMilestone`, `setStatus`, `setTrainingMinigame`, `setTrainingOrigin`.

### MetaSlice (`src/store/meta-slice.ts`)

Owns all persistent progression state. Survives across runs and browser sessions.

Key state: `data` (persistent currency), `unlockedMinigames`, `purchasedUpgrades` (`Record<string, number>` mapping upgrade IDs to tier), `achievements` (array of unlocked IDs), `revealedAchievements` (near-miss achievements shown to player), `stats` (`PlayerStats`), `seenBriefings`, `checkpointReaches` (`Record<number, number>` tracking how many times each checkpoint floor has been reached).

Key actions: `addData`, `spendData`, `unlockMinigame`, `purchaseUpgrade`, `unlockAchievement`, `revealAchievement`, `markBriefingSeen`, `updateStats`, `recordMinigameResult`, `getUpgradeTier`, `incrementCheckpointReach`.

### ShopSlice (`src/store/shop-slice.ts`)

Owns generated shop inventories for both the run shop and meta shop.

Key state: `runShopOffers` (generated per floor), `metaShopItems` (full META_UPGRADE_POOL).

Key actions: `generateRunShop(floor)`, `buyRunShopItem(index)`, `generateMetaShop()`.

### Persistence

Only meta-slice keys are persisted to `localStorage` under the key `"icebreaker-meta"`:

```ts
const META_PERSIST_KEYS = [
  "data", "unlockedMinigames", "purchasedUpgrades",
  "achievements", "revealedAchievements", "stats",
  "seenBriefings", "checkpointReaches",
] as const;
```

The `partialize` option in `zustand/persist` filters out all run and shop state, so only progression data survives page reload. Run state resets every run; shop state regenerates on demand.

The `merge` function in `game-store.ts` guarantees that starting minigames are always present after hydration -- if localStorage is corrupted, manually edited, or a new starting minigame is added in an update, the guaranteed set is restored:

```ts
merge: (persisted, current) => {
  const merged = { ...current, ...persisted };
  const guaranteed = [...new Set([...STARTING_MINIGAMES, ...merged.unlockedMinigames])];
  merged.unlockedMinigames = guaranteed;
  return merged;
}
```

### E2E Store Access

The store is exposed on `window.__GAME_STORE__` for Playwright E2E tests:

```ts
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__GAME_STORE__ = useGameStore;
}
```

E2E tests use `page.evaluate(() => window.__GAME_STORE__.getState())` and `page.evaluate(() => window.__GAME_STORE__.setState(...))` to manipulate game state directly.

### Slice Interaction

Slices access each other through `get()` since all three are composed into a single store. For example, `startRun()` in RunSlice reads `purchasedUpgrades` and `unlockedMinigames` from MetaSlice to compute starting HP, credits, and inventory. `completeMinigame()` reads `stats.bestFloor` from MetaSlice to scale milestone bonuses.

---

## 3. Game Loop

### Starting a Run

`startRun(startFloor?)` computes all starting values by reading meta upgrades:

1. **Floor**: defaults to 1, or the selected checkpoint floor (floor select).
2. **Floor minigames**: `pickRandom(unlockedMinigames, getMinigamesPerFloor(floor, diffReducerTier))` -- uses power curve formula.
3. **HP**: `100 + (hp-boost tier * 5) + (unlockHpBonus) + overclockedBonus`. Unlock HP bonus = `(unlockedMinigames.length - 5) * 5`.
4. **Credits**: `getStartingCredits(headStartTier) + getFloorBonusCredits(startFloor)` -- base 25 CR + tier bonus + floor bonus for teleport.
5. **Starting inventory**: always empty (quick-boot and dual-core were removed).
6. **Snapshots**: `dataAtRunStart`, `milestoneDataThisRun = 0`, `dataDripThisRun = 0`, `creditsEarnedThisRun = 0`.

### Minigame Lifecycle (MinigameScreen.tsx)

Each minigame goes through three phases (`Phase = "countdown" | "active" | "result"`):

1. **Countdown**: Displays minigame name, floor/protocol number, counts 3-2-1-GO (~666 ms per tick). Before transitioning to "active", `checkSkip(inventory)` runs. Priority: Warp Gate (skip-floor, 15% rewards for all remaining) > Null Route (skip-silent, full rewards) > Backdoor (skip, 0 rewards). All count as success. Warp Gate calls `skipRemainingFloor(0.15)` to batch-complete remaining protocols and go straight to vendor/milestone.

2. **Active**: The `MinigameRouter` renders the correct minigame component. It computes effective difficulty (with `difficulty-reducer` meta upgrade via `getEffectiveDifficulty`), time limit (via `getEffectiveTimeLimit`), and merges run inventory power-ups with synthetic meta-upgrade power-ups into `activePowerUps`. The minigame component calls `onComplete(result)` when the player wins or the timer expires.

3. **Result**: Displays "SUCCESS" or "FAILED" with credit amount for 1 second, then dispatches to store:
   - Success: `recordMinigameResult(type, true)` then `completeMinigame(result)`.
   - Failure: `recordMinigameResult(type, false)` then `failMinigame()`.
   - Minigame-specific power-ups (those with `effect.minigame` matching the current game) are consumed after each game.
   - `evaluateAndAwardAchievements()` runs after state update.

### completeMinigame

1. Calculates credit reward via `getEffectiveCredits(timeMs, difficulty, creditTier, speedTaxTier, unlockBonus, floor)`.
2. Calculates per-minigame data drip: `getDataDrip(floor)` added to `dataDripThisRun`.
3. Applies `heal-on-success` power-ups (e.g., Nano Repair) and `hp-leech` power-ups (triggers on every protocol, win or fail).
4. If last minigame on floor: checks for milestone (every 5th floor). First-time milestone = full bonus; repeat = 25%. Sets status to `"milestone"` or `"shop"`.
5. If not last: advances `currentMinigameIndex`.

### failMinigame

1. Computes effective damage: `getEffectiveDamage(floor, armorTier)`.
2. Applies shield power-ups via `applyShield()`: full shield > stacked reduction > simple reduction. One power-up consumed per fail.
3. If HP reaches 0: status = `"dead"`.
4. If alive: **re-rolls** the current minigame slot with a different random minigame from the pool. The index does NOT advance. The player must still complete N total minigames on the floor.

### advanceFloor

1. Increments floor number.
2. Generates new floor minigames: `pickRandom(unlockedMinigames, getMinigamesPerFloor(nextFloor, diffReducerTier))`.
3. **Consumes floor-scoped power-ups**: `heal-on-success`, `time-bonus`, `time-siphon`, and `hp-leech` are removed from inventory.
4. **Emergency Patch**: if `purchasedUpgrades["emergency-patch"] > 0`, heals `Math.round(maxHp * 0.02 * tier)` HP before the next floor starts (capped at maxHp).
5. **Checkpoint tracking**: if new floor is a checkpoint, `incrementCheckpointReach(floor)` is called.
6. Resets `floorDamageTaken`, `powerUpsUsedThisFloor`, `timeSiphonBonus`.
7. Clears `runShopOffers` so next shop generates fresh.

### Death / End of Run

`DeathScreen` handles data banking:

1. **Base floor reward**: `getEffectiveDataReward(floor, dataSiphonTier)`.
2. **Protocol win drip**: `dataDripThisRun` (accumulated across all minigame wins).
3. **Credits saved**: `getCreditsSaved(credits, creditsEarnedThisRun)` -- 8% conversion rate, excluding Head Start and floor bonus.
4. **Milestone data**: `milestoneDataThisRun` (accumulated across all milestones hit).
5. **Death penalty**: `getDeathPenaltyPct(dataRecoveryTier, quitVoluntarily)`. Voluntary quit = 0% penalty.
6. **Achievement bonus**: computed after `evaluateAndAwardAchievements()` runs.
7. `addData(totalAfterPenalty)` banks to persistent store.
8. `updateStats()` increments lifetime stats.

---

## 4. Minigame System

### MinigameProps Interface

```ts
interface MinigameProps {
  difficulty: number;             // 0-1 scale
  timeLimit: number;              // seconds
  activePowerUps: PowerUpInstance[];
  onComplete: (result: MinigameResult) => void;
}

interface MinigameResult {
  success: boolean;
  timeMs: number;
  minigame: MinigameType;
  rewardFraction?: number;  // 0 = no rewards, 1 = full, 0.15 = 15% etc.
}
```

Every minigame component receives the same props interface. It must call `onComplete()` exactly once with the result.

### useMinigame Hook (`src/hooks/use-minigame.ts`)

Standard lifecycle hook used by every minigame component:

```ts
interface MinigameState {
  timer: GameTimerState;
  complete: (success: boolean) => void;
  fail: () => void;
  isActive: boolean;
  startTime: number;
}
```

Behavior:
1. On mount: sums all `time-bonus` power-ups from `activePowerUps` and calls `timer.addTime(bonusSecs * 1000)`. Then calls `timer.start()`.
2. `complete(success)`: sets `completedRef` to prevent double-fire, pauses timer, builds `MinigameResult`, calls `onComplete`.
3. `fail()`: alias for `complete(false)`.
4. On timer expiry (`handleExpire`): auto-calls `onComplete` with `success: false`.
5. `isActive`: false after completion -- used by minigame components to ignore input after the game ends.
6. Uses `completedRef` to guarantee single-fire even in React StrictMode.

### useGameTimer Hook (`src/hooks/use-game-timer.ts`)

`requestAnimationFrame`-based countdown timer:

```ts
interface GameTimerState {
  timeLeft: number;     // ms remaining
  progress: number;     // 0-1 ratio (timeLeft / totalMs)
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  addTime: (ms: number) => void;
}
```

Uses `performance.now()` for precision. Segment-based: each start/resume begins a new segment with a snapshot of remaining time. `addTime` works both while running and paused.

### useCipherMinigame Hook (`src/hooks/use-cipher-minigame.ts`)

Shared hook for CipherCrack and CipherCrackV2. Encapsulates:
- Pre-filled position computation (for Decode Assist / Auto-Decode)
- Character display state (`prefilled | typed | cursor | remaining`)
- Hidden mobile input management
- Key handling logic

### Power-Up Passing

The `MinigameRouter` in `MinigameScreen.tsx` builds the `activePowerUps` array by merging:
1. **Run inventory**: power-ups bought from the run shop.
2. **Meta synthetics**: `buildMetaPowerUps(purchasedUpgrades, type)` (imported from `src/data/minigames/registry.ts`) creates synthetic `PowerUpInstance` objects from purchased meta upgrades. It reads `MINIGAME_REGISTRY[type].metaUpgrades` and iterates them generically -- no `switch` statement. The same function is used by both `MinigameScreen.tsx` and `Training.tsx`.

This allows minigame components to consume all bonuses through a single uniform API.

### Power-Up Consumption

- **Minigame-specific** power-ups (those with `effect.minigame` matching the current game) are consumed after each minigame.
- **Time-bonus** power-ups persist through the entire floor (consumed in `advanceFloor`).
- **Heal-on-success** power-ups persist through the entire floor (consumed in `advanceFloor`).
- **HP-leech** power-ups persist through the entire floor (consumed in `advanceFloor`). They trigger after every protocol (win or fail), applying HP recovery before the next protocol begins.
- **Shield** power-ups are consumed on fail trigger (in `failMinigame` via `applyShield()`).
- **Skip** power-ups (Backdoor, Null Route) are consumed before the active phase begins (in countdown logic via `checkSkip()`). Warp Gate (`skip-floor`) also triggers at countdown and calls `skipRemainingFloor()` to skip all remaining protocols on the floor at 15% rewards.
- **Heal** (immediate) items are consumed on purchase in the shop (never added to inventory).

### Available Minigames (15 total)

| Type ID | Display Name | Starting? |
|---|---|---|
| `slash-timing` | Slash Timing | Yes |
| `close-brackets` | Code Inject | Yes |
| `type-backward` | Decrypt Signal | Yes |
| `match-arrows` | Packet Route | Yes |
| `mine-sweep` | Memory Scan | Yes |
| `find-symbol` | Address Lookup | Unlock |
| `wire-cutting` | Process Kill | Unlock |
| `cipher-crack` | Cipher Crack V1 | Unlock |
| `defrag` | Defrag | Unlock |
| `network-trace` | Network Trace | Unlock |
| `signal-echo` | Signal Echo | Unlock |
| `checksum-verify` | Checksum Verify | Unlock |
| `port-scan` | Port Scan | Unlock |
| `subnet-scan` | Subnet Scan | Unlock |
| `cipher-crack-v2` | Cipher Crack V2 | Unlock |

Base time limits per minigame (seconds, before difficulty/floor scaling):

| Minigame | Base Time |
|---|---|
| slash-timing | 8 |
| close-brackets | 8 |
| type-backward | 18 |
| match-arrows | 8 |
| find-symbol | 12 |
| mine-sweep | 15 |
| wire-cutting | 12 |
| cipher-crack | 12 |
| defrag | 40 |
| network-trace | 20 |
| signal-echo | 20 |
| checksum-verify | 15 |
| port-scan | 15 |
| subnet-scan | 20 |
| cipher-crack-v2 | 15 |

---

## 5. Economy

All economy formulas live in `src/data/balancing.ts`. All stacking calculations are centralized as `getEffective*` functions: `getEffectiveDifficulty`, `getEffectiveTimeLimit`, `getEffectiveDamage`, `getEffectiveCredits`. Callers should always use these instead of invoking the base functions directly.

See `docs/ECONOMY.md` for the complete formula reference with examples and tuning guide.

### Key Formulas (Summary)

```ts
getEffectiveDifficulty(floor, diffReducerTier) = min(0.1 + floor / (15 + diffReducerTier * 2), 1.0)

getMinigamesPerFloor(floor, diffReducerTier) = max(1, round(1 + 19 * pow(difficulty, 1.65)))

getCredits(timeMs, difficulty, floor) = round(20 * (1 + difficulty) * speedBonus) + floor * 2

getCreditsSaved(currentCredits, earnedThisRun) = floor(min(earnedThisRun, currentCredits) * 0.08)
```

---

## 6. Achievement System

### Architecture

Achievements are defined in `src/data/achievements.ts` (`ACHIEVEMENT_POOL`). Each achievement has:
- `id`, `name`, `description` -- identity
- `condition` -- typed discriminated union (`AchievementCondition`)
- `reward` -- data bonus (awarded after death penalty)
- `icon` -- Lucide icon name
- `category` -- `"progression" | "speed" | "skill" | "survival" | "playstyle" | "cumulative" | "economy"`

### Checking Pipeline

1. **`checkAchievements(ctx)`** in `src/lib/achievement-checker.ts` -- pure function that takes an `AchievementCheckContext` (snapshot of current game state) and returns an array of newly earned achievements.

2. **`checkNearMisses(ctx)`** -- identifies achievements the player almost earned (e.g., reached floor 4 when floor 5 is a milestone). These are "revealed" to the player in the achievement list as motivation.

3. **`evaluateAndAwardAchievements()`** in `src/hooks/use-achievement-check.ts` -- reads everything from the store, builds the context, calls `checkAchievements`, awards data, shows toasts, then checks near-misses and reveals them.

This function is called:
- After every `completeMinigame` / `failMinigame` (in `MinigameScreen.tsx`)
- After shop purchases (in `RunShop.tsx`)
- During death screen processing (in `DeathScreen.tsx`)

### Condition Types

| Type | Fields | Checks |
|---|---|---|
| `floor-reached` | `floor` | Current floor >= target |
| `minigame-speed` | `minigame`, `maxTimeMs` | Won specific minigame under time |
| `minigame-streak` | `minigame`, `count` | Consecutive wins of specific minigame |
| `minigame-total-wins` | `minigame`, `count` | Lifetime total wins of specific minigame |
| `minigame-win-streak` | `count` | Consecutive wins of ANY minigame |
| `consecutive-floors-no-damage` | `count` | Floors cleared without taking damage |
| `survive-low-hp-pct` | `maxPct` | Survived a hit with HP% <= threshold |
| `survive-low-hp` | `maxHp` | Survived a hit with HP <= threshold |
| `inventory-count` | `count` | Holding N+ power-ups simultaneously |
| `floor-no-powerups` | -- | Cleared a floor without using power-ups |
| `total-minigames-won` | `count` | Lifetime total minigames won |
| `total-runs` | `count` | Lifetime total runs |
| `total-minigames` | `count` | Lifetime total minigames played |
| `all-minigames-unlocked` | -- | All 15 protocols unlocked |
| `shop-spending` | `amount` | Credits spent in a single shop visit |
| `total-data-earned` | `amount` | Lifetime data earned |
| `speed-consecutive-floors` | `count`, `maxTimeMs` | N consecutive floors in under time |
| `consecutive-floors-no-shop` | `count` | Consecutive floors without buying |

---

## 7. Shared UI Components

### Game-Specific Components (`src/components/layout/`)

| Component | File | Purpose |
|---|---|---|
| `MinigameShell` | `MinigameShell.tsx` | Wraps minigame content with consistent layout (timer, title, padding) |
| `ArrowKeyHints` | `ArrowKeyHints.tsx` | Shows arrow key hint icons (desktop-only), supports `vertical` prop |
| `GameCell` | `GameCell.tsx` | Reusable grid cell with cursor/hover/selected states. Exports `CURSOR_CLASSES`, `HOVER_CLASSES`, `cellStyles()` |
| `CipherDisplay` | `CipherDisplay.tsx` | Letter-by-letter cipher display used by both CipherCrack and CipherCrackV2 |
| `HiddenMobileInput` | `HiddenMobileInput.tsx` | Hidden `<input>` for triggering system keyboard on mobile (cipher/typing games) |
| `ProgressDots` | `ProgressDots.tsx` | Dot progress indicator (e.g., "3/5 expressions solved") |
| `TimerBar` | `TimerBar.tsx` | Visual timer bar driven by `progress` prop (0-1) |
| `HUD` | `HUD.tsx` | In-game heads-up display (HP, floor, credits, inventory) |
| `TouchControls` | `TouchControls.tsx` | DPad and BracketButtons for touch devices |
| `ScanlineOverlay` | `ScanlineOverlay.tsx` | CRT scanline effect overlay |

### UI Primitives (`src/components/ui/`)

| Component | File | Purpose |
|---|---|---|
| `CyberButton` | `CyberButton.tsx` | Styled button with cyberpunk aesthetics, variants, loading state |
| `ScreenHeader` | `ScreenHeader.tsx` | Screen title + subtitle + description layout |
| `ResultFlash` | `ResultFlash.tsx` | SUCCESS/FAILED flash overlay between minigames |
| `CountdownDisplay` | `CountdownDisplay.tsx` | 3-2-1-GO countdown display |
| `ConfirmDialog` | `ConfirmDialog.tsx` | Modal confirmation dialog |

---

## 8. Meta Progression

### purchasedUpgrades

`Record<string, number>` mapping upgrade IDs to their current tier (0 = not purchased). Persisted in localStorage.

### Upgrade Categories

Defined across `src/data/upgrades/` files, assembled in `src/data/upgrades/registry.ts` (`META_UPGRADE_POOL`). Four categories:

**Stat upgrades** (stackable or tiered) -- in `src/data/upgrades/stat.ts`:

| ID | Name | Type | Effect |
|---|---|---|---|
| `hp-boost` | HP Boost | Stackable (infinite) | +5 max HP per purchase |
| `delay-injector` | Delay Injector | Stackable (infinite) | +3% all timers per purchase (multiplicative) |
| `difficulty-reducer` | Difficulty Reducer | Stackable (infinite) | Pushes max difficulty 2 floors further per tier |
| `thicker-armor` | Thicker Armor | 5 tiers | -5%/-10%/-15%/-20%/-25% incoming damage |
| `credit-multiplier` | Credit Multiplier | Stackable (infinite) | +3% credits per purchase (multiplicative) |
| `data-siphon` | Data Siphon | Stackable (infinite) | +3% data per purchase (multiplicative) |
| `speed-tax` | Speed Tax | 3 tiers | Flat +round(base * tier * 0.05) per win |
| `data-recovery` | Data Recovery | 6 tiers | Death penalty reduced to 22.5%/20%/17.5%/15%/12.5%/10% |
| `cascade-clock` | Cascade Clock | 5 tiers | +2% base timer per consecutive win; cap 10/20/30/40/50% per tier |
| `emergency-patch` | Emergency Patch | Stackable (infinite) | +2% max HP regen at floor start per purchase |
| `supply-line` | Supply Line | 2 tiers | Vendor inventory: 4 items (T1), 6 items (T2) |

**Starting bonus upgrades** (tiered) -- in `src/data/upgrades/starting.ts`:

| ID | Name | Effect |
|---|---|---|
| `overclocked` | Overclocked | +5/+10/+15/+20/+25 bonus starting HP (5 tiers) |
| `head-start` | Head Start | +50/+125/+300/+600/+1000 bonus starting credits (5 tiers) |

**Defense upgrades** -- in `src/data/upgrades/defense.ts`:
Thicker Armor and Data Recovery are in this file.

**Minigame unlocks**: 10 unlockable protocols (see section 4). Dynamic pricing: `200 + unlocksOwned * 100`. Some have prerequisites (e.g., cipher-crack-v2 requires cipher-crack-license).

**Game-specific upgrades**: 21 upgrades that modify individual minigame behavior. Each is defined in the respective minigame's config file at `src/data/minigames/{id}.ts` under the `metaUpgrades` array. They are automatically assembled into `META_UPGRADE_POOL` via `MINIGAME_REGISTRY.flatMap(cfg => cfg.metaUpgrades)`.

### Upgrade Registries

Meta upgrades are split into focused files under `src/data/upgrades/`:

| File | Contents |
|---|---|
| `src/data/upgrades/stat.ts` | Stackable and tiered stat upgrades |
| `src/data/upgrades/defense.ts` | Defense and healing meta upgrades |
| `src/data/upgrades/starting.ts` | Starting bonus upgrades |
| `src/data/upgrades/registry.ts` | `META_UPGRADE_POOL` assembled from all sources |

`src/data/upgrades/registry.ts` assembles the final pool:

```ts
export const META_UPGRADE_POOL: MetaUpgrade[] = [
  ...STAT_UPGRADES,
  ...DEFENSE_UPGRADES,
  ...STARTING_UPGRADES,
  // Auto-generated unlock licenses from each unlockable MinigameConfig
  ...Object.values(MINIGAME_REGISTRY).filter(...).map(...),
  // Game-specific upgrades from each MinigameConfig.metaUpgrades
  ...Object.values(MINIGAME_REGISTRY).flatMap(cfg => cfg.metaUpgrades),
];
```

---

## 9. Power-Up System

### Run Shop Items (18 items in pool)

Defined in `src/data/power-ups.ts` (`RUN_SHOP_POOL`). See `docs/ECONOMY.md` for the full price table.

### PowerUpEffect Type

```ts
interface PowerUpEffect {
  type:
    | "time-bonus" | "time-multiplier" | "time-pause"
    | "shield" | "damage-reduction" | "damage-reduction-stacked"
    | "skip" | "skip-floor" | "skip-silent"
    | "heal" | "heal-on-success"
    | "preview" | "hint" | "highlight-danger" | "extra-hint"
    | "window-extend"
    | "peek-ahead" | "minigame-specific"
    | "bracket-flash" | "wire-color-labels"
    | "time-siphon" | "deadline-override" | "cascade-clock"
    | "hp-leech" | "floor-regen";
  value: number;
  minigame?: MinigameType;
}
```

### Shield Priority (applyShield)

When a fail occurs, the best shield power-up is consumed (one per fail):
1. `shield` (Firewall Patch) -- full block, damage = 0.
2. `damage-reduction-stacked` (Redundancy Layer) -- take 50% damage per hit, 2 charges.
3. `damage-reduction` (Damage Reducer) -- take 25% damage, consumed on trigger.

### Consumption Rules Summary

| Scope | Consumed When | Examples |
|---|---|---|
| Immediate | On purchase (never enters inventory) | `heal` items |
| Per-floor | On `advanceFloor()` | `time-bonus`, `heal-on-success`, `time-siphon`, `hp-leech` |
| On-trigger | On fail event | `shield`, `damage-reduction`, `damage-reduction-stacked` |
| On-trigger | Before active phase starts | `skip`, `skip-silent`, `skip-floor` |
| Per-minigame | After each game | `deadline-override` (single use, consumed after first minigame) |

---

## 10. Input System

### useKeyboard Hook (`src/hooks/use-keyboard.ts`)

Registers keydown handlers for multiple keys simultaneously using the latest-ref pattern:

```ts
function useKeyboard(keyMap: Record<string, () => void>): void
```

- Uses `event.key` values (e.g., `"ArrowUp"`, `" "`, `"Enter"`).
- Ref is updated on every render; event listener is registered once.
- Companion `useKeyPress(key, callback)` for single-key convenience.

### Touch Detection (`src/hooks/use-touch-device.ts`)

```ts
function useTouchDevice(): boolean
```

Returns `true` if `"ontouchstart" in window || navigator.maxTouchPoints > 0`. Checked once on mount via `useEffect`.

### CSS Visibility Classes

```css
@media (pointer: coarse) {
  .desktop-only { display: none !important; }
}
@media (pointer: fine) {
  .touch-only { display: none !important; }
}
```

Components use these classes to show/hide input instructions and touch controls based on device type.

### TouchControls Component (`src/components/layout/TouchControls.tsx`)

```ts
interface TouchControlsProps {
  type: "dpad" | "brackets" | "none";
  excludedClosers?: string[];
}
```

- **dpad**: Renders 4 directional buttons dispatching synthetic `KeyboardEvent` on `window`.
- **brackets**: Renders bracket-closing buttons dispatching synthetic key events. `excludedClosers` hides removed types.
- **none**: Renders nothing.

---

## 11. Design System

### CSS Variables (`src/index.css`)

```css
@theme {
  --color-cyber-cyan: #00ffff;
  --color-cyber-magenta: #ff0066;
  --color-cyber-green: #00ff41;
  --color-cyber-orange: #ff6600;
  --color-cyber-bg: #06060e;

  --color-currency-credits: #FFD700;
  --color-currency-data: #A855F7;

  --font-heading: "Audiowide", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace;
}
```

### Typography

- **Headings**: Audiowide (self-hosted TTF, SIL Open Font License).
- **Body/UI**: JetBrains Mono stack (monospace). Set as `font-mono` in Tailwind config.
- All UI text is uppercase with wide letter-spacing (`tracking-widest`, `tracking-wider`).

### Glitch Effects (4 tiers)

1. **`glitch-text`**: Subtle chromatic aberration. Used on minigame names and section headings.
2. **`glitch-text-strong`**: Heavier effect with `skewX` transform. Used on death/milestone screen titles.
3. **`glitch-flicker`**: Opacity flickering effect. Used on countdown numbers and labels.
4. **`glitch-subtle`**: Lighter ambient effects on secondary text.

---

## 12. Minigame Data Architecture

### Registry Pattern

Each minigame is a self-contained configuration file at `src/data/minigames/{id}.ts` that exports a single `MinigameConfig` object. This is the single source of truth (SSOT) for everything about that minigame.

**`MinigameConfig` interface** (`src/data/minigames/types.ts`):

```ts
interface MinigameConfig {
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

All 15 config files are imported and composed into `MINIGAME_REGISTRY` in `src/data/minigames/registry.ts`. Derived data is computed from the registry with no duplication:

```ts
export const MINIGAME_REGISTRY: Record<MinigameType, MinigameConfig> = { ... };

// Derived:
export const MINIGAME_COMPONENTS   // component map for the router
export const BASE_TIME_LIMITS      // base seconds per minigame
export const STARTING_MINIGAMES    // minigames with starting: true
export const UNLOCKABLE_MINIGAMES  // minigames with starting: false
export const ALL_MINIGAMES         // all IDs in order
```

Helper functions: `getMinigameDisplayName(type)`, `getMinigameBriefing(type)`, `getMinigameHint(type, isTouch)`.

### buildMetaPowerUps -- Generic, No Switch

`buildMetaPowerUps(purchasedUpgrades, type, overrides?)` in `registry.ts` is fully generic. It reads `config.metaUpgrades` for the given minigame and converts purchased tiers into synthetic `PowerUpInstance` objects. Training mode can pass `overrides` to selectively enable upgrades at chosen tiers.

---

## 13. Key Files Reference

| File | Purpose |
|---|---|
| `src/App.tsx` | Status-based screen router, ScanlineOverlay + HUD + Toaster |
| `src/store/game-store.ts` | Zustand store composition with localStorage persistence + E2E `__GAME_STORE__` |
| `src/store/run-slice.ts` | Ephemeral run state: HP, floor, minigames, inventory, credits |
| `src/store/meta-slice.ts` | Persistent state: data, upgrades, achievements, stats, checkpoints |
| `src/store/shop-slice.ts` | Run shop generation & buying, meta shop display |
| `src/types/game.ts` | Core types: GameStatus, MinigameType, PowerUpInstance, PowerUpEffect, PlayerStats |
| `src/types/minigame.ts` | MinigameProps and MinigameResult interfaces |
| `src/types/shop.ts` | RunShopItem, MetaUpgrade, Achievement, AchievementCondition types |
| `src/hooks/use-minigame.ts` | Standard minigame lifecycle hook (timer, complete, fail, isActive) |
| `src/hooks/use-game-timer.ts` | rAF-based countdown timer with start/pause/addTime |
| `src/hooks/use-keyboard.ts` | Keyboard input registration (useKeyboard, useKeyPress) |
| `src/hooks/use-touch-device.ts` | Touch device detection hook |
| `src/hooks/use-achievement-check.ts` | evaluateAndAwardAchievements + useAchievementCheck hook |
| `src/hooks/use-cipher-minigame.ts` | Shared cipher minigame logic (pre-fill, char display, mobile input) |
| `src/data/balancing.ts` | All economy formulas: difficulty, damage, credits, time limits, prices |
| `src/data/minigames/types.ts` | MinigameConfig and MinigameBriefing interfaces |
| `src/data/minigames/registry.ts` | MINIGAME_REGISTRY, derived data, buildMetaPowerUps, helper functions |
| `src/data/minigames/{id}.ts` | Per-minigame SSOT: component ref, time limit, briefing, meta upgrades |
| `src/data/upgrades/stat.ts` | Stat meta upgrades (stackable and tiered) |
| `src/data/upgrades/defense.ts` | Defense and healing meta upgrades |
| `src/data/upgrades/starting.ts` | Starting bonus meta upgrades |
| `src/data/upgrades/registry.ts` | META_UPGRADE_POOL assembled from all upgrade sources |
| `src/data/power-ups.ts` | RUN_SHOP_POOL: 18 run-shop power-up items |
| `src/data/achievements.ts` | ACHIEVEMENT_POOL with conditions and rewards |
| `src/lib/achievement-checker.ts` | checkAchievements, checkNearMisses -- pure functions |
| `src/lib/power-up-effects.ts` | applyShield(), checkSkip(), getMetaBonus() utility functions |
| `src/lib/maze-generator.ts` | Recursive backtracking maze generator for NetworkTrace |
| `src/components/screens/MinigameScreen.tsx` | Minigame lifecycle: countdown/active/result phases, MinigameRouter |
| `src/components/screens/DeathScreen.tsx` | End-of-run data breakdown, stat banking, achievement awards |
| `src/components/layout/TouchControls.tsx` | DPad and BracketButtons for touch devices |
| `src/components/layout/MinigameShell.tsx` | Consistent minigame wrapper layout |
| `src/components/layout/HUD.tsx` | In-game heads-up display (HP, floor, credits) |
| `src/components/layout/ScanlineOverlay.tsx` | CRT scanline effect overlay |
| `src/components/ui/CyberButton.tsx` | Styled cyberpunk button component |
| `src/components/ui/ScreenHeader.tsx` | Screen title layout component |
| `src/components/ui/ResultFlash.tsx` | Success/failure flash overlay |
| `src/components/ui/CountdownDisplay.tsx` | 3-2-1-GO countdown component |
| `src/components/ui/ConfirmDialog.tsx` | Modal confirmation dialog |
| `src/components/screens/MainMenu.tsx` | Start menu with navigation to all screens |
| `src/components/screens/RunShop.tsx` | Between-floor vendor (credits for power-ups) |
| `src/components/screens/MetaShop.tsx` | Persistent upgrade shop (data for upgrades) |
| `src/components/screens/Training.tsx` | Practice mode for individual minigames |
| `src/components/screens/Codex.tsx` | Minigame rules and controls reference |
| `src/components/screens/Stats.tsx` | Lifetime statistics display |
| `src/components/screens/PauseMenu.tsx` | In-run pause menu |
| `src/components/screens/MilestoneOverlay.tsx` | Milestone floor celebration overlay |
| `src/index.css` | Design system: theme vars, glitch effects, scanlines, touch/desktop classes |
