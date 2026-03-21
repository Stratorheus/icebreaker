# Icebreaker Architecture

## 1. Overview

Icebreaker is a cyberpunk-themed roguelike browser minigame collection. The player runs an "ICE-breaker" program attempting to breach deeper into a system, floor by floor. Each floor presents a sequence of timed minigame challenges (called "protocols"). Success earns credits (in-run currency) and data (persistent currency). Failure costs HP. When HP reaches zero, the run ends and accumulated data is banked (minus a death penalty) for spending on permanent meta upgrades.

### High-Level Flow

```
Menu
 -> Start Run (applies meta upgrades)
    -> Floor N
       -> Generate floor minigames (1+N, capped at 8)
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

`App.tsx` renders the appropriate screen component based on `status`. There is no client-side URL routing; the entire app is a single-page state machine.

---

## 2. State Management

The store uses **Zustand** with three slices composed into a single flat store:

```ts
export type GameStore = RunSlice & MetaSlice & ShopSlice;
```

Created in `src/store/game-store.ts` with `zustand/middleware/persist`.

### RunSlice (`src/store/run-slice.ts`)

Owns all ephemeral per-run state. Reset on every `startRun()`.

Key state: `hp`, `maxHp`, `floor`, `currentMinigameIndex`, `floorMinigames`, `inventory` (power-ups), `credits`, `runScore`, `status`, `milestoneFloor`, `milestoneDataThisRun`, `dataDripThisRun`, `itemsBoughtThisRun`, `quitVoluntarily`, `floorDamageTaken`, `runDamageTaken`, `timeSiphonBonus`, `cascadeClockPct`.

Key actions: `startRun`, `completeMinigame`, `failMinigame`, `advanceFloor`, `takeDamage`, `heal`, `addCredits`, `addPowerUp`, `usePowerUp`, `pauseRun`, `resumeRun`, `quitRun`, `endRun`, `dismissMilestone`.

### MetaSlice (`src/store/meta-slice.ts`)

Owns all persistent progression state. Survives across runs and browser sessions.

Key state: `data` (persistent currency), `unlockedMinigames`, `purchasedUpgrades` (`Record<string, number>` mapping upgrade IDs to tier), `achievements` (array of unlocked IDs), `stats` (`PlayerStats`), `seenBriefings`.

Key actions: `addData`, `spendData`, `unlockMinigame`, `purchaseUpgrade`, `unlockAchievement`, `recordMinigameResult`, `updateStats`, `getUpgradeTier`.

### ShopSlice (`src/store/shop-slice.ts`)

Owns generated shop inventories for both the run shop and meta shop.

Key state: `runShopOffers` (generated per floor), `metaShopItems` (full META_UPGRADE_POOL).

Key actions: `generateRunShop(floor)`, `buyRunShopItem(index)`, `generateMetaShop()`.

### Persistence

Only meta-slice keys are persisted to `localStorage` under the key `"icebreaker-meta"`:

```ts
const META_PERSIST_KEYS = [
  "data", "unlockedMinigames", "purchasedUpgrades",
  "achievements", "stats", "seenBriefings",
] as const;
```

The `partialize` option in `zustand/persist` filters out all run and shop state, so only progression data survives page reload. Run state resets every run; shop state regenerates on demand.

### Slice Interaction

Slices access each other through `get()` since all three are composed into a single store. For example, `startRun()` in RunSlice reads `purchasedUpgrades` and `unlockedMinigames` from MetaSlice to compute starting HP, credits, and inventory. `completeMinigame()` reads `stats.bestFloor` from MetaSlice to scale milestone bonuses.

---

## 3. Game Loop

### Starting a Run

`startRun()` computes all starting values by reading meta upgrades:

1. **Floor minigames**: `pickRandom(unlockedMinigames, getMinigamesPerFloor(1))` — floor 1 gets 2 minigames.
2. **HP**: `100 + (hp-boost tier * 5) + (unlockHpBonus) + overclockedBonus`. Unlock HP bonus = `(unlockedMinigames.length - 5) * 5`.
3. **Credits**: `25 + (50 if head-start purchased)`.
4. **Bonus time**: removed (`pre-loaded` upgrade was removed).
5. **Starting inventory**: 0, 1, or 2 random power-ups from `RUN_SHOP_POOL` (via `quick-boot` / `dual-core`).
6. **Snapshots**: `dataAtRunStart`, `milestoneDataThisRun = 0`, `dataDripThisRun = 0`.

### Minigame Lifecycle (MinigameScreen.tsx)

Each minigame goes through three phases (`Phase = "countdown" | "active" | "result"`):

1. **Countdown**: Displays minigame name, floor/protocol number, counts 3-2-1-GO (~666 ms per tick). If a Hint Module power-up is in inventory, it is consumed and countdown extends to 4-3-2-1-GO with a hint line shown. Before transitioning to "active", `checkSkip(inventory)` runs; if a skip power-up is found, the minigame auto-completes as success without playing.

2. **Active**: The `MinigameRouter` renders the correct minigame component. It computes effective difficulty (with `difficulty-reducer` meta upgrade), time limit (with `delay-injector` meta upgrade), and merges run inventory power-ups with synthetic meta-upgrade power-ups into `activePowerUps`. The minigame component calls `onComplete(result)` when the player wins or the timer expires.

3. **Result**: Displays "SUCCESS" or "FAILED" with credit amount for 1 second, then dispatches to store:
   - Success: `recordMinigameResult(type, true)` then `completeMinigame(result)`.
   - Failure: `recordMinigameResult(type, false)` then `failMinigame()`.
   - Minigame-specific power-ups (those with `effect.minigame` matching the current game) are consumed after each game.
   - `awardNewAchievements()` runs after state update.

### completeMinigame

1. Calculates credit reward with multipliers (credit-multiplier meta, unlock bonus, speed-tax meta).
2. Calculates per-minigame data drip: `Math.round(1 + floor * 0.8)` added to `dataDripThisRun`.
3. Applies `heal-on-success` power-ups (e.g., Nano Repair) and `hp-leech` power-ups (triggers on every protocol, win or fail).
4. If last minigame on floor: checks for milestone (every 5th floor). First-time milestone = full bonus; repeat = 25%. Sets status to `"milestone"` or `"shop"`.
5. If not last: advances `currentMinigameIndex`.

### failMinigame

1. Computes raw damage: `getDamage(floor)`.
2. Applies `thicker-armor` meta reduction (5/10/15/20/25%).
3. Applies shield power-ups via `applyShield()`: full shield > stacked reduction > simple reduction. One power-up consumed per fail.
4. If HP reaches 0: status = `"dead"`.
5. If alive: **re-rolls** the current minigame slot with a different random minigame from the pool. The index does NOT advance. The player must still complete N total minigames on the floor.

### advanceFloor

1. Increments floor number.
2. Generates new floor minigames: `pickRandom(unlockedMinigames, getMinigamesPerFloor(nextFloor))`.
3. **Consumes floor-scoped power-ups**: `heal-on-success`, `time-bonus`, `time-siphon`, and `hp-leech` are removed from inventory.
4. **Emergency Patch**: if `purchasedUpgrades["emergency-patch"] > 0`, heals `Math.round(maxHp * 0.02 * tier)` HP before the next floor starts (capped at maxHp).
5. Resets `floorDamageTaken`, `powerUpsUsedThisFloor`.
6. Clears `runShopOffers` so next shop generates fresh.

### Death / End of Run

`DeathScreen` handles data banking:

1. **Base floor reward**: `getDataReward(floor)` with Data Siphon multiplier.
2. **Protocol win drip**: `dataDripThisRun` (accumulated across all minigame wins).
3. **Credits saved**: `floor(credits * 0.08)` (8% conversion rate).
4. **Milestone data**: `milestoneDataThisRun` (accumulated across all milestones hit).
5. **Death penalty**: `25%` of pre-penalty total, reduced by Data Recovery (6 tiers: 22.5%/20%/17.5%/15%/12.5%/10%). Voluntary quit = 0% penalty.
6. **Achievement bonus**: computed after `awardNewAchievements()` runs.
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
5. `isActive`: false after completion — used by minigame components to ignore input after the game ends.
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

### Power-Up Passing

The `MinigameRouter` in `MinigameScreen.tsx` builds the `activePowerUps` array by merging:
1. **Run inventory**: power-ups bought from the run shop.
2. **Meta synthetics**: `buildMetaPowerUps()` creates synthetic `PowerUpInstance` objects from purchased meta upgrades (e.g., `slash-window` becomes a `window-extend` power-up for Slash Timing).

This allows minigame components to consume all bonuses through a single uniform API.

### Power-Up Consumption

- **Minigame-specific** power-ups (those with `effect.minigame` matching the current game) are consumed after each minigame.
- **Time-bonus** power-ups persist through the entire floor (consumed in `advanceFloor`).
- **Heal-on-success** power-ups persist through the entire floor (consumed in `advanceFloor`).
- **HP-leech** power-ups persist through the entire floor (consumed in `advanceFloor`). They trigger after every protocol (win or fail), applying HP recovery before the next protocol begins.
- **Shield** power-ups are consumed on fail trigger (in `failMinigame` via `applyShield()`).
- **Skip** power-ups are consumed before the active phase begins (in countdown logic via `checkSkip()`).
- **Heal** (immediate) items are consumed on purchase in the shop (never added to inventory).
- **Hint Module** is consumed at the start of the countdown phase.

### Time-Bonus Persistence Through Floor

`time-bonus` power-ups remain in inventory across all minigames on a floor. The `useMinigame` hook reads them on every mount and applies them to the timer. They are only removed when `advanceFloor()` filters the inventory.

### Available Minigames (15 total)

| Type ID | Display Name | Starting? |
|---|---|---|
| `slash-timing` | Slash Timing | Yes |
| `close-brackets` | Code Inject | Yes |
| `type-backward` | Decrypt Signal | Yes |
| `match-arrows` | Packet Route | Yes |
| `mine-sweep` | Memory Scan | Yes |
| `find-symbol` | Address Lookup | Unlock |
| `wire-cutting` | Wire Cutting | Unlock |
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

### Difficulty

```ts
getDifficulty(floor) = Math.min(0.1 + floor / 15, 1.0)
```

Starts at 0.1 on floor 1, reaches 1.0 around floor 13. Affects minigame complexity and time limits.

With `difficulty-reducer` meta upgrade: `effective = getDifficulty(floor) * Math.pow(0.95, tier)`.

### Time Limit

```ts
getTimeLimit(baseTime, difficulty, floor?) {
  const difficultyScale = 1 - difficulty * 0.4;        // at diff 1.0 -> 60% of base
  const floorScale = floor > 15
    ? Math.max(0.4, 1 - (floor - 15) * 0.02)           // additional 2% shrink per floor past 15
    : 1;
  return Math.round(baseTime * difficultyScale * floorScale);
}
```

With `cascade-clock` meta upgrade: `baseTime * (1 + cascadeClockPct)` where `cascadeClockPct` grows by +2% per consecutive win, capped per tier (10/20/30/40/50%).

With `time-siphon` run-shop item: adds flat `timeSiphonBonus` seconds (grows +0.2 s per win, floor-scoped, resets on fail/advanceFloor).

With `delay-injector` meta upgrade: `final = Math.round((baseTime + timeSiphonBonus) * (1 + cascadeClockPct) * Math.pow(1.03, delayInjectorTier))`.

> All time limit calculations are centralized in `getEffectiveTimeLimit()` in `balancing.ts`.

With `time-bonus` power-ups: added by `useMinigame` hook on mount.

With `deadline-override` run-shop item: when timer progress drops below 5%, injects 1 s bonus time once (single use, consumed after the minigame).

### Damage on Fail

```ts
getDamage(floor) = 20 + floor * 4
```

Floor 1 = 24 damage. Floor 10 = 60 damage. Floor 20 = 100 damage.

With `thicker-armor` meta: `Math.round(rawDamage * (1 - [0.05, 0.10, 0.15, 0.20, 0.25][tier - 1]))`.

### Credits on Win

```ts
getCredits(timeMs, difficulty) {
  const base = 20 * (1 + difficulty);
  const speedBonus = 1 + Math.max(0, 1 - timeMs / 10_000) * 0.5;
  return Math.round(base * speedBonus);
}
```

Speed bonus: completing under 10 seconds earns up to +50% extra credits.

Applied multipliers in `completeMinigame()`:
- `credit-multiplier` meta: `Math.pow(1.03, tier)`.
- Minigame unlock bonus: `+5%` per unlocked minigame beyond the starting 5.
- `speed-tax` meta: `Math.round(baseCredits * tier * 0.05)` flat bonus added to base credits before percentage multipliers (Credit Multiplier, unlock bonus).

### Minigames Per Floor

```ts
getMinigamesPerFloor(floor) = Math.min(1 + floor, 8)
```

Floor 1 = 2, Floor 2 = 3, ..., Floor 7+ = 8 (cap).

### Data (Persistent Currency) Sources

1. **Floor reward** (on death): `getDataReward(floor) = Math.round(3 + floor * 4)`. Modified by `data-siphon` meta: `Math.pow(1.03, tier)`.

2. **Per-minigame data drip** (on each win): `Math.round(1 + floor * 0.8)`. Accumulated in `dataDripThisRun`, awarded at death.

3. **Credits saved** (on death): `Math.floor(credits * 0.08)` — 8% conversion rate.

4. **Milestone bonus** (every 5th floor): `getMilestoneBonus(floor) = floor * 5` (floor 5 = 25, floor 10 = 50, etc.). First-time reaching a floor = full bonus; repeat = 25%. Accumulated in `milestoneDataThisRun`, awarded at death.

5. **Achievement rewards**: data bonuses for unlocking achievements (10-5000 range).

### Death Penalty

Base: 25% of all pre-penalty data earned in the run.

With `data-recovery` meta upgrade: `Math.max(0.10, 0.25 - tier * 0.025)`. Tiers: 22.5% / 20% / 17.5% / 15% / 12.5% / 10%.

Voluntary quit (`quitRun()`): 0% penalty.

### Run Shop Price Scaling

```ts
getRunShopPrice(basePrice, floor) = Math.round(basePrice * (1 + floor * 0.25) * (1 + floor^2 * 0.01))
```

Plus `+5%` per item already bought this run: `price * (1 + itemsBoughtThisRun * 0.05)`.

---

## 6. Meta Progression

### purchasedUpgrades

`Record<string, number>` mapping upgrade IDs to their current tier (0 = not purchased). Persisted in localStorage.

### Upgrade Categories

Defined in `src/data/meta-upgrades.ts` (META_UPGRADE_POOL). Four categories:

**Stat upgrades** (stackable or tiered):
| ID | Name | Type | Effect |
|---|---|---|---|
| `hp-boost` | HP Boost | Stackable (infinite) | +5 max HP per purchase |
| `delay-injector` | Delay Injector | Stackable (infinite) | +3% all timers per purchase (multiplicative) |
| `difficulty-reducer` | Difficulty Reducer | Stackable (infinite) | -5% effective difficulty per purchase (multiplicative) |
| `thicker-armor` | Thicker Armor | 5 tiers | -5%/-10%/-15%/-20%/-25% incoming damage |
| `credit-multiplier` | Credit Multiplier | Stackable (infinite) | +3% credits per purchase (multiplicative) |
| `data-siphon` | Data Siphon | Stackable (infinite) | +3% data per purchase (multiplicative) |
| `speed-tax` | Speed Tax | 3 tiers | Speed bonuses +15%/+25%/+40% more effective |
| `data-recovery` | Data Recovery | 6 tiers | Death penalty reduced to 22.5%/20%/17.5%/15%/12.5%/10% |
| `cascade-clock` | Cascade Clock | 5 tiers | +2% base timer per consecutive win; cap 10/20/30/40/50% per tier; resets on fail, persists across floors |
| `emergency-patch` | Emergency Patch | Stackable (infinite) | +2% max HP regen at floor start per purchase; applied in `advanceFloor` |

**Starting bonus upgrades** (single-tier or tiered):
| ID | Name | Effect |
|---|---|---|
| `quick-boot` | Quick Boot | Start with 1 random power-up |
| `dual-core` | Dual Core | Start with 2 random power-ups (requires quick-boot) |
| `overclocked` | Overclocked | +5/+10/+15/+20/+25 bonus starting HP (5 tiers) |
| `head-start` | Head Start | +50 bonus starting credits |
| ~~`pre-loaded`~~ | ~~Pre-Loaded~~ | Removed |
| `cache-primed` | Cache Primed | Run shop always offers a heal item |

**Minigame unlocks**: 10 unlockable protocols (see section 4). Dynamic pricing: `200 + unlocksOwned * 100`. Some have prerequisites (e.g., cipher-crack-v2 requires cipher-crack-license).

**Game-specific upgrades**: 17 upgrades that modify individual minigame behavior (bracket-reducer, mine-echo, symbol-scanner, arrow-preview, type-assist, wire-labels, cipher-hint, slash-window, bracket-mirror, symbol-magnifier, reverse-trainer, wire-schematic, slash-echo, defrag-safe-start, network-trace-highlight, signal-echo-slow, checksum-calculator, port-scan-deep, subnet-cidr-helper).

### Stackable vs Tiered

- **Stackable** (`stackable: true`, `maxTier: 999`): Can be purchased infinitely. Pricing is dynamic via `getStackablePrice()` (not in balancing.ts — handled by MetaShop UI). Effects compound multiplicatively (e.g., `Math.pow(1.03, tier)`).
- **Tiered** (`maxTier: 1-3`): Fixed number of levels. Each tier has a specific price and effect value. `prices[0]` = tier 1 cost, `prices[1]` = tier 2 cost, etc.

### How startRun Applies Meta Upgrades

The `startRun()` function in run-slice.ts reads `purchasedUpgrades` from the meta slice and computes:

```
maxHp = 100 + (hp-boost tier * 5) + (unlockHpBonus) + overclockedBonus
startCredits = 25 + (50 if head-start)
powerUpCount = 2 if dual-core, 1 if quick-boot, 0 otherwise
```

### Minigame Unlock HP Bonus

Each unlocked minigame beyond the starting 5 grants +5 max HP and +5% global credit multiplier. This incentivizes buying unlock upgrades early.

---

## 7. Power-Up System

### Run Shop Items (23 items in pool)

Defined in `src/data/power-ups.ts` (`RUN_SHOP_POOL`). Categories:

**Time** (7 items):
| Item | Effect | Base Price |
|---|---|---|
| Time Freeze | `time-bonus` +1 s | 30 |
| Clock Boost | `time-bonus` +2 s | 55 |
| Chrono Surge | `time-bonus` +1.5 s | 40 |
| Lag Spike | `time-bonus` +0.5 s | 20 |
| Buffer Extend | `time-bonus` +2.5 s | 70 |
| Time Siphon | `time-siphon` +0.2 s per win (floor-scoped) | 35 |
| Deadline Override | `deadline-override` 1 s pause at 5% timer (single use) | 50 |

**Defense** (3 items):
| Item | Effect | Base Price |
|---|---|---|
| Firewall Patch | `shield` (full block) | 60 |
| Damage Reducer | `damage-reduction` 25% (75% reduction) | 40 |
| Redundancy Layer | `damage-reduction-stacked` 50% (2 charges) | 75 |

**Skip** (3 items):
| Item | Effect | Base Price |
|---|---|---|
| Backdoor | `skip` (skip 1 protocol) | 55 |
| Emergency Exit | `skip` (skip 1 protocol) | 80 |
| Null Route | `skip-silent` (auto-pass, 0 credits) | 50 |

**Healing** (5 items):
| Item | Effect | Base Price |
|---|---|---|
| Repair Kit | `heal` +25 HP (immediate) | 65 |
| System Restore | `heal` +35 HP (immediate) | 80 |
| Repair Drone | `heal` +15 HP (immediate) | 50 |
| Nano Repair | `heal-on-success` +5 HP per win (floor) | 45 |
| HP Leech | `hp-leech` +2 HP after every protocol (floor) | 40 |

**Vision** (1 item):
| Item | Effect | Base Price |
|---|---|---|
| Hint Module | `hint` (reveals hint during countdown) | 40 |

**Assist** (4 items):
| Item | Effect | Base Price |
|---|---|---|
| Slash Calibration | `window-extend` +20% for slash-timing | 40 |
| Bracket Auto-Close | `auto-close` 1 bracket for close-brackets | 45 |
| Arrow Compass | `peek-ahead` see 2 ahead for match-arrows | 40 |
| Sector Scanner | `flag-mine` flag 1 mine for mine-sweep | 45 |

### PowerUpEffect Type

```ts
interface PowerUpEffect {
  type:
    | "time-bonus" | "time-multiplier" | "time-pause"
    | "shield" | "damage-reduction" | "damage-reduction-stacked"
    | "skip" | "skip-floor" | "skip-silent"
    | "heal" | "heal-on-success"
    | "preview" | "hint" | "highlight-danger"
    | "window-extend" | "auto-close" | "reveal-first"
    | "peek-ahead" | "flag-mine" | "minigame-specific"
    | "time-siphon" | "deadline-override" | "cascade-clock"
    | "hp-leech" | "floor-regen";
  value: number;
  minigame?: MinigameType;
}
```

### No-Stacking Rule

A player cannot hold two power-ups of the same `type` (item ID) simultaneously. `addPowerUp()` rejects duplicates: `inventory.some(p => p.type === item.type)`.

### Consumption Rules Summary

| Scope | Consumed When | Examples |
|---|---|---|
| Immediate | On purchase (never enters inventory) | `heal` items |
| Per-minigame | After each game if `effect.minigame` matches | Slash Calibration, Arrow Compass, Sector Scanner |
| Per-floor | On `advanceFloor()` | `time-bonus`, `heal-on-success`, `time-siphon`, `hp-leech` |
| On-trigger | On fail event | `shield`, `damage-reduction`, `damage-reduction-stacked` |
| On-trigger | Before active phase starts | `skip`, `skip-silent` |
| On-trigger | At countdown start | `hint` (Hint Module) |
| Per-minigame | After each game | `deadline-override` (single use, consumed after first minigame) |

### Run Shop Generation

`generateRunShop(floor)`:
1. Picks 3-4 random items from `RUN_SHOP_POOL` (50% chance of 4th item).
2. If `cache-primed` meta upgrade is active, guarantees at least one `heal`-type item.
3. Prices scaled by floor: `getRunShopPrice(basePrice, floor) * (1 + itemsBoughtThisRun * 0.05)`.

### Shield Priority (applyShield)

When a fail occurs, the best shield power-up is consumed (one per fail):
1. `shield` (Firewall Patch) -- full block, damage = 0.
2. `damage-reduction-stacked` (Redundancy Layer) -- take 50% damage per hit, 2 charges.
3. `damage-reduction` (Damage Reducer) -- take 25% damage, consumed on trigger.

---

## 8. Input System

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
}
```

- **dpad**: Renders 4 directional buttons (Up/Down/Left/Right) dispatching synthetic `KeyboardEvent` on `window`. Used by MatchArrows, NetworkTrace, Defrag, FindSymbol, etc.
- **brackets**: Renders 6 bracket-closing buttons (`)`, `]`, `}`, `>`, `|`, `/`) dispatching synthetic key events. Used by CloseBrackets.
- **none**: Renders nothing.

All touch buttons fire via `onPointerDown` for immediate response. They use `fireKey()` which dispatches a synthetic `keydown` event, so the same `useKeyboard` handlers work for both input methods.

---

## 9. Design System

### CSS Variables (`src/index.css`)

```css
@theme {
  --color-cyber-cyan: #00ffff;      /* Primary accent, success, UI borders */
  --color-cyber-magenta: #ff0066;   /* Failure, danger, death penalty */
  --color-cyber-green: #00ff41;     /* Success text, credit gains, hints */
  --color-cyber-orange: #ff6600;    /* Warnings, Signal Echo panel */
  --color-cyber-bg: #06060e;        /* Base background (near-black) */

  --color-currency-credits: #FFD700;  /* Gold for credits (CR) */
  --color-currency-data: #A855F7;     /* Purple for data (hex icon) */

  --font-heading: "Audiowide", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace;
}
```

### Typography

- **Headings**: Audiowide (self-hosted TTF, SIL Open Font License).
- **Body/UI**: JetBrains Mono stack (monospace). Set as `font-mono` in Tailwind config.
- All UI text is uppercase with wide letter-spacing (`tracking-widest`, `tracking-wider`).

### Background

Multi-layered mesh gradient: 18 radial gradients at various positions with low-opacity (3%) cyan, magenta, purple, and blue hues on the `#06060e` base. Creates a subtle nebula-like cyberpunk atmosphere.

### Glitch Effects (4 tiers)

1. **`glitch-text`**: Subtle chromatic aberration. 4-second cycle, activates at 92-96% with small translate and cyan/magenta text-shadow. Used on minigame names and section headings.

2. **`glitch-text-strong`**: Heavier effect. 3-second cycle, activates at 85-92% with larger offsets and `skewX` transform. Used on death/milestone screen titles.

3. **`glitch-flicker`**: Opacity flickering effect. 5-second cycle, stepped animation that drops opacity between 92-97.5%. Used on countdown numbers and labels.

4. **`glitch-subtle`**: Referenced in CSS classes (`glitch-subtle`) for lighter ambient effects on secondary text.

### Scanline Overlay

A `ScanlineOverlay` component renders a `::after` pseudo-element with repeating 2px transparent / 2px semi-opaque black gradient, creating a CRT monitor effect over the entire screen. `pointer-events: none` ensures it doesn't block interaction.

### shadcn/ui Integration

Uses shadcn/ui dark theme (zinc base) with standard CSS custom properties (`--background`, `--foreground`, `--primary`, etc.) in HSL format.

---

## 10. Key Files Reference

| File | Purpose |
|---|---|
| `src/App.tsx` | Status-based screen router, ScanlineOverlay + HUD + Toaster |
| `src/store/game-store.ts` | Zustand store composition with localStorage persistence |
| `src/store/run-slice.ts` | Ephemeral run state: HP, floor, minigames, inventory, credits |
| `src/store/meta-slice.ts` | Persistent state: data, upgrades, achievements, stats |
| `src/store/shop-slice.ts` | Run shop generation & buying, meta shop display |
| `src/types/game.ts` | Core types: GameStatus, MinigameType, PowerUpInstance, PowerUpEffect, PlayerStats |
| `src/types/minigame.ts` | MinigameProps and MinigameResult interfaces |
| `src/types/shop.ts` | RunShopItem, MetaUpgrade, Achievement, AchievementCondition types |
| `src/hooks/use-minigame.ts` | Standard minigame lifecycle hook (timer, complete, fail, isActive) |
| `src/hooks/use-game-timer.ts` | rAF-based countdown timer with start/pause/addTime |
| `src/hooks/use-keyboard.ts` | Keyboard input registration (useKeyboard, useKeyPress) |
| `src/hooks/use-touch-device.ts` | Touch device detection hook |
| `src/data/balancing.ts` | All economy formulas: difficulty, damage, credits, time limits, prices |
| `src/data/meta-upgrades.ts` | META_UPGRADE_POOL: 40+ persistent upgrades across 4 categories |
| `src/data/power-ups.ts` | RUN_SHOP_POOL: 20 run-shop power-up items |
| `src/data/achievements.ts` | ACHIEVEMENT_POOL: 30+ achievements with conditions and rewards |
| `src/data/minigame-descriptions.ts` | MINIGAME_BRIEFINGS: rules, controls, tips, hints per minigame |
| `src/data/minigame-names.ts` | MINIGAME_DISPLAY_NAMES: type ID to display name mapping |
| `src/lib/power-up-effects.ts` | applyShield(), checkSkip(), getMetaBonus() utility functions |
| `src/components/screens/MinigameScreen.tsx` | Minigame lifecycle: countdown/active/result phases, MinigameRouter |
| `src/components/screens/DeathScreen.tsx` | End-of-run data breakdown, stat banking, achievement awards |
| `src/components/layout/TouchControls.tsx` | DPad and BracketButtons for touch devices |
| `src/components/layout/HUD.tsx` | In-game heads-up display (HP, floor, credits) |
| `src/components/layout/ScanlineOverlay.tsx` | CRT scanline effect overlay |
| `src/components/screens/MainMenu.tsx` | Start menu with navigation to all screens |
| `src/components/screens/RunShop.tsx` | Between-floor vendor (credits for power-ups) |
| `src/components/screens/MetaShop.tsx` | Persistent upgrade shop (data for upgrades) |
| `src/components/screens/Training.tsx` | Practice mode for individual minigames |
| `src/components/screens/Codex.tsx` | Minigame rules and controls reference |
| `src/components/screens/Stats.tsx` | Lifetime statistics display |
| `src/components/screens/MilestoneOverlay.tsx` | Milestone floor celebration overlay |
| `src/index.css` | Design system: theme vars, glitch effects, scanlines, touch/desktop classes |
