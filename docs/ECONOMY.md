# Icebreaker Economy Reference

Complete reference for all numbers, formulas, and tuning knobs in the game economy.
All pure formulas live in `src/data/balancing.ts`.

---

## Currency Overview

The game has two currencies:

- **Credits (CR)** — ephemeral, earned inside a run, spent in the run shop, converted to Data on death/quit.
- **Data (◆)** — persistent across runs, earned at run end, spent in the Upgrade Terminal (meta shop).

---

## Credit Flow

### Earning Credits

Credits are awarded on every minigame win. The core formula:

```
difficulty  = getEffectiveDifficulty(floor, diffReducerTier)
            = min(0.1 + floor / (15 + diffReducerTier * 2), 1.0)

base        = 20 * (1 + difficulty)
speedBonus  = 1 + max(0, 1 - timeMs / 10_000) * 0.5
floorBonus  = floor * 2

credits     = round(base * speedBonus) + floorBonus       // getCredits
```

The speed bonus applies when the player completes the minigame in under 10 seconds. At exactly 0 ms it adds +50%; at 10 s it adds 0%. The floor bonus is a flat `+2 CR per floor`, unaffected by difficulty reducer.

**Meta upgrade modifiers applied on top (in `getEffectiveCredits`):**

```
speedTaxFlat    = round(base * speedTaxTier * 0.05)        // flat, added before multipliers
withFlat        = base + speedTaxFlat
creditMultiplier = 1.03^creditTier                         // multiplicative
unlockBonus     = (unlockedMinigames - 5) * 0.05           // +5% per extra unlock

effectiveCredits = round(withFlat * creditMultiplier * (1 + unlockBonus))
```

| Upgrade | Effect |
|---|---|
| Credit Multiplier (stackable) | `x 1.03^tier` multiplicative |
| Minigame unlocks (beyond 5 starting) | `+5%` per extra unlock, multiplicative with Credit Multiplier |
| Speed Tax (tiered 1-3) | Flat `+round(base * tier * 0.05)` added before percentage multipliers |

**Starting credits:**
- Base: 25 CR at run start (guaranteed minimum so floor 1 shop is usable).
- Head Start meta upgrade (5 tiers): +50/+125/+300/+600/+1000 CR bonus on top of base.
- Floor bonus (when starting from a checkpoint): `getFloorBonusCredits(startFloor)` (see Floor Select section).
- Formula centralized in `getStartingCredits(headStartTier)` + `getFloorBonusCredits(startFloor)` in `src/data/balancing.ts`.

### Spending Credits — Run Shop

The run shop appears between floors. It shows items based on the Supply Line upgrade tier.

**Vendor slot count:**
- Default: 2 items.
- Supply Line tier 1: 4 items.
- Supply Line tier 2: 6 items.

**Item price formula** (`getRunShopPrice` in `src/data/balancing.ts`):

```
price = round(basePrice * (1 + floor * 0.25) * (1 + floor^2 * 0.01))
```

This is quadratic: prices grow slowly in early floors but accelerate sharply at high floors.

**Per-purchase surcharge:** Each item bought this run adds +5% to all subsequent shop prices.

```
finalPrice = round(getRunShopPrice(basePrice, floor) * (1 + itemsBoughtThisRun * 0.05))
```

**Reroll cost:**

```
rerollPrice = round(20 + floor * 10)
```

Rerolling replaces all current offers. The reroll price comes out of current credits.

**Run shop item base prices:**

| Item | Base Price | Category |
|---|---|---|
| Lag Spike (+0.5 s) | 20 CR | time |
| Time Freeze (+1 s) | 30 CR | time |
| Time Siphon (+0.2 s per win) | 35 CR | time |
| Chrono Surge (+1.5 s) | 40 CR | time |
| Deadline Override (1 s pause at 5%) | 50 CR | time |
| Clock Boost (+2 s) | 55 CR | time |
| Buffer Extend (+2.5 s) | 70 CR | time |
| Damage Reducer (75% reduction) | 40 CR | defense |
| HP Leech (+2 HP per protocol) | 40 CR | healing |
| Firewall Patch (shield) | 60 CR | defense |
| Redundancy Layer (2x 50%) | 75 CR | defense |
| Nano Repair (+5 HP/win) | 45 CR | healing |
| Backdoor (skip, no rewards) | 45 CR | skip |
| Repair Drone (+15 HP) | 50 CR | healing |
| Null Route (skip, full rewards) | 55 CR | skip |
| Repair Kit (+25 HP) | 65 CR | healing |
| System Restore (+35 HP) | 80 CR | healing |
| Warp Gate (skip floor, 15% rewards) | 150 CR | skip |

Healing items (Repair Kit, System Restore, Repair Drone) apply immediately on purchase and do not occupy an inventory slot. HP Leech enters the inventory and triggers after each protocol (win or fail), then is consumed at floor advance. All other items enter the inventory.

Note: Run-shop assist items (Slash Calibration, Bracket Auto-Close, Arrow Compass, Sector Scanner) were removed -- their meta-upgrade counterparts provide better coverage.

**No-stacking rule:** You cannot hold two items of the same type simultaneously.

### Credits -> Data Conversion

When a run ends (death or voluntary quit), leftover credits convert to Data at **8%**:

```
creditsSaved = floor(min(earnedThisRun, currentCredits) * 0.08)    // getCreditsSaved
```

Only credits earned during gameplay count -- Head Start bonus credits and floor bonus credits are excluded. Starting credits are spent first, so the eligible amount is `min(earnedThisRun, currentCredits)`.

This is included in the pre-penalty Data subtotal.

---

## Floor Select / Checkpoint System

### Checkpoints

Every 5th floor (5, 10, 15, 20, ...) is a checkpoint floor. When a player reaches a checkpoint floor, the counter `checkpointReaches[floor]` increments. Once a checkpoint has been reached at least once (`CHECKPOINT_UNLOCK_THRESHOLD = 1`), it becomes available for floor select at run start.

Constants in `src/data/balancing.ts`:
```
CHECKPOINT_INTERVAL = 5
CHECKPOINT_UNLOCK_THRESHOLD = 1
```

### Floor Bonus Credits

Starting a run from a higher floor awards bonus credits to compensate for skipped early-floor income:

```
getFloorBonusCredits(startFloor):
  if startFloor <= 1: return 0
  return round(startFloor * 25 + startFloor^2 * 0.3)
```

| Start Floor | Bonus CR |
|---|---|
| 1 | 0 |
| 5 | 133 |
| 10 | 280 |
| 15 | 443 |
| 20 | 620 |
| 25 | 813 |
| 30 | 1020 |
| 50 | 2000 |

These bonus credits are added on top of `getStartingCredits(headStartTier)` in `startRun()`.

### Milestone Suppression

When starting from a checkpoint, milestones at or below the start floor are **not suppressed** -- they were already recorded in previous runs. The milestone repeat penalty (25% of full) still applies for floors the player has cleared before (`floor <= stats.bestFloor`).

---

## Difficulty System

### Effective Difficulty

```
getEffectiveDifficulty(floor, diffReducerTier):
  return min(0.1 + floor / (15 + diffReducerTier * 2), 1.0)
```

Without Difficulty Reducer (tier 0): starts at 0.1 on floor 1, reaches 1.0 at floor 14.
With Difficulty Reducer tier 3: denominator becomes 21, so difficulty reaches 1.0 at floor 19 instead of 14.

The upgrade "pushes max difficulty 2 floors further per tier" by increasing the denominator.

### Minigames Per Floor

```
getMinigamesPerFloor(floor, diffReducerTier):
  difficulty = getEffectiveDifficulty(floor, diffReducerTier)
  return max(1, round(1 + 19 * pow(difficulty, 1.65)))
```

Uses a power curve (1.65 exponent) for gradual ramp -- easy stays low, hard+ climbs steeply.

| Floor | Difficulty (no DR) | Minigames |
|---|---|---|
| 1 | 0.17 | 2 |
| 3 | 0.30 | 3 |
| 5 | 0.43 | 5 |
| 7 | 0.57 | 7 |
| 10 | 0.77 | 12 |
| 14+ | 1.00 | 20 |

### Difficulty Labels

Used by Training picker and vendor display (`DIFFICULTY_OPTIONS`):

| Label | Value |
|---|---|
| TRIVIAL | 0.05 |
| EASY | 0.15 |
| NORMAL | 0.30 |
| MEDIUM | 0.50 |
| HARD | 0.70 |
| EXPERT | 0.85 |
| INSANE | 1.00 |

---

## Data Flow

### How Data is Earned at Run End

Data is accumulated from four sources, summed before applying the death penalty:

```
prePenaltyData = baseDataEarned + dataDripThisRun + creditsSaved + milestoneDataThisRun
```

**1. Base floor reward** (`getDataReward` / `getEffectiveDataReward`):

```
baseData = round(3 + floor * 4)                         // getDataReward
baseDataEarned = round(baseData * 1.03^dataSiphonTier)   // getEffectiveDataReward
```

**2. Per-minigame drip** (`getDataDrip`, accumulated in `dataDripThisRun`):

```
minigameDataDrip = round(1 + floor * 0.8)   // awarded per win, added to running total
```

**3. Credits saved** -- see conversion formula above.

**4. Milestone bonuses** (accumulated in `milestoneDataThisRun`):

Every 5th floor triggers a milestone. The bonus scales linearly with the floor number:

```
getMilestoneBonus(floor) = floor * 5    // only when floor % 5 === 0
```

Examples: floor 5 = 25 data, floor 10 = 50 data, floor 15 = 75 data, floor 20 = 100 data, floor 50 = 250 data, floor 100 = 500 data.

Milestone data is **not awarded immediately**. It accumulates in `milestoneDataThisRun` and is subject to the death penalty at run end.

**Milestone repeat penalty:** If the player has already cleared this floor in a previous run (i.e. `floor <= stats.bestFloor`), the milestone bonus is reduced to **25%** of the full amount.

### Death Penalty

On death, 25% of the pre-penalty total is deducted. The Data Recovery meta upgrade reduces this:

```
penaltyPct = max(0.10, 0.25 - dataRecoveryTier * 0.025)    // getDeathPenaltyPct
// Tier 0 = 25%, Tier 1 = 22.5%, Tier 2 = 20%, Tier 3 = 17.5%,
// Tier 4 = 15%, Tier 5 = 12.5%, Tier 6 = 10%

penaltyAmount = floor(prePenaltyData * penaltyPct)
dataAfterPenalty = prePenaltyData - penaltyAmount
```

**Voluntary quit (QUIT RUN):** No death penalty is applied (`penaltyPct = 0`). The full pre-penalty total is awarded.

### Achievement Bonuses

After the base data award, `evaluateAndAwardAchievements()` runs and grants bonus Data for any newly unlocked achievements. This bonus is shown separately in the death screen breakdown. Achievement bonuses are **not subject to the death penalty** (they are awarded after it).

Selected achievement rewards:

| Achievement | Reward |
|---|---|
| First Breach (floor 1) | 15 data |
| Script Kiddie (floor 5) | 50 data |
| Zero Day (floor 10) | 100 data |
| APT (floor 20) | 400 data |
| Core Meltdown (floor 50) | 1,500 data |
| Singularity (floor 100) | 7,500 data |
| God Mode (100 floors no damage) | 100,000 data |

### Spending Data -- Meta Shop (Upgrade Terminal)

Three pricing models exist:

**Stackable upgrades** (HP Boost, Credit Multiplier, Data Siphon, Delay Injector, Difficulty Reducer, Emergency Patch):

```
price = round(basePrice * (1 + timesPurchased * 0.5))
// Purchase 1: 100, Purchase 2: 150, Purchase 3: 200, ...
```

**Global price scalar** (applies to all non-stackable purchases):

```
scaledPrice = round(basePrice * (1 + totalPurchasesMade * 0.15))
```

`totalPurchasesMade` is the sum of all upgrade tiers bought across every category.

**Tiered upgrades** (Thicker Armor, Data Recovery, Speed Tax, etc.) use the per-tier base price from the pool, then apply the global scalar.

**Minigame unlock pricing** (dynamic):

```
base  = 200 + unlocksOwned * 100
price = round(base * (1 + totalPurchasesMade * 0.15))
// First unlock: 200, Second: 300, Third: 400, ...
// All scaled by global purchase count multiplier
```

---

## HP System

### Base HP

- Starting HP: 100.
- Max HP: 100 + all bonuses below.

### HP Bonuses (applied at `startRun`)

| Source | Bonus |
|---|---|
| HP Boost (stackable) | +5 per purchase |
| Minigame unlock (beyond 5 starting) | +5 per extra unlocked minigame |
| Overclocked Tier 1 | +5 |
| Overclocked Tier 2 | +10 |
| Overclocked Tier 3 | +15 |
| Overclocked Tier 4 | +20 |
| Overclocked Tier 5 | +25 |

These stack additively:

```
actualMaxHp = 100 + (hpBoostTier * 5) + (extraUnlocks * 5) + overclockedBonus
```

### Damage Formula

On minigame failure:

```
rawDamage  = 20 + floor * 4                          // getDamage
baseDamage = round(rawDamage * (1 - armorReduction))  // getEffectiveDamage
// armorReductions = [0, 0.05, 0.10, 0.15, 0.20, 0.25] indexed by tier
```

Then run-shop defensive power-ups apply. **Damage stacking priority** (one power-up consumed per fail, best first via `applyShield`):

1. **Firewall Patch** (`shield`): next failure deals 0 damage, consumed on trigger.
2. **Redundancy Layer** (`damage-reduction-stacked`): next failure deals 50% damage, has 2 charges, consumed after both uses.
3. **Damage Reducer** (`damage-reduction`): next failure deals only 25% damage (75% reduction), consumed on trigger.

---

## Time Limit System

### Base Time Limit

Each minigame has a `baseTimeLimit` defined in its config file at `src/data/minigames/{id}.ts`.

### Time Scaling

```
getTimeLimit(baseTime, difficulty, floor?):
  difficultyScale = 1 - difficulty * 0.4       // at diff 1.0 -> 60% of base
  floorScale = floor > 15
    ? max(0.4, 1 - (floor - 15) * 0.02)        // 2% shrink per floor past 15
    : 1
  return round(baseTime * difficultyScale * floorScale)
```

### Effective Time (all stacking)

```
getEffectiveTimeLimit(baseTime, difficulty, floor, timeSiphon, cascadeClockPct, delayInjectorTier):
  base = getTimeLimit(baseTime, difficulty, floor)
  return round((base + timeSiphon) * (1 + cascadeClockPct) * 1.03^delayInjectorTier)
```

Canonical order: **flat bonuses first, percentage multipliers last**.

Time-bonus power-ups from run shop are added separately by the `useMinigame` hook on mount.

---

## Meta Upgrade Cost Reference

### Stackable Upgrades (base price, then +50% per purchase)

| Upgrade | Base Price | Effect per purchase |
|---|---|---|
| HP Boost | 100 data | +5 max HP |
| Credit Multiplier | 100 data | +3% credits (multiplicative) |
| Data Siphon | 100 data | +3% data reward (multiplicative) |
| Delay Injector | 100 data | +3% all timers (multiplicative) |
| Difficulty Reducer | 150 data | Pushes max difficulty 2 floors further per tier |
| Emergency Patch | 120 data | +2% max HP regen at start of each floor (stackable) |

### Tiered Stat Upgrades (fixed tiers, global scalar applies)

| Upgrade | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 | Effect |
|---|---|---|---|---|---|---|---|
| Thicker Armor | 100 | 200 | 350 | 500 | 750 | -- | Damage -5/10/15/20/25% |
| Speed Tax | 100 | 250 | 500 | -- | -- | -- | Flat +round(base * tier * 0.05) per win |
| Data Recovery | 100 | 200 | 300 | 400 | 550 | 750 | Death penalty 22.5/20/17.5/15/12.5/10% |
| Cascade Clock | 150 | 300 | 500 | 750 | 1000 | -- | +2% base timer per win, cap 10/20/30/40/50% |
| Supply Line | 300 | 600 | -- | -- | -- | -- | Vendor inventory: 4/6 items |

### Starting Bonuses (tiered, global scalar applies)

| Upgrade | Prices | Effect |
|---|---|---|
| Head Start | 100 / 250 / 450 / 700 / 1000 | +50/+125/+300/+600/+1000 starting credits (5 tiers) |
| Overclocked | 100 / 200 / 350 / 500 / 750 | +5/10/15/20/25 max and starting HP (5 tiers) |

### Protocol Licenses (minigame unlocks)

First three unlocks have fixed prices:

| License | Price | Unlocks |
|---|---|---|
| Address Lookup License | 300 data | find-symbol |
| Process Kill Toolkit | 300 data | wire-cutting |
| Cipher Crack V1 License | 300 data | cipher-crack |

Remaining unlocks (Defrag, Network Trace, Signal Echo, Checksum Verify, Port Scan, Subnet Scan, Cipher Crack V2) use dynamic pricing:

```
price = round((200 + unlocksOwned * 100) * (1 + totalPurchasesMade * 0.15))
```

### Game-Specific Upgrades (tiered, global scalar applies)

| Upgrade | Protocol | Tiers | Prices | Effect |
|---|---|---|---|---|
| Bracket Reducer | Code Inject | 3 | 150/300/500 | Removes bracket types (slash/+pipe/+square) |
| Bracket Mirror | Code Inject | 1 | 150 | Shows next expected closing bracket |
| Memory Echo | Memory Scan | 5 | 150/250/400/600/850 | 20/30/40/50/60% mines visible at start |
| Symbol Scanner | Address Lookup | 1 | 200 | Subtly highlights target hex code |
| Arrow Preview | Packet Route | 5 | 150/250/400/600/850 | 20/30/40/50/60% of arrows pre-revealed |
| Stream Monitor | Process Kill | 1 | 200 | Dims non-target processes, highlights next |
| Cipher Hint | Cipher Crack V1 | 1 | 225 | Shows first letter of answer |
| Decode Assist | Cipher Crack V1 | 3 | 150/300/500 | Pre-fills 25/50/75% of letters |
| Slash Window | Slash Timing | 1 | 175 | Attack window 25% wider |
| Autocorrect | Decrypt Signal | 4 | 150/300/500/750 | Shows 25/50/75/100% of words normally |
| Path Highlight | Network Trace | 4 | 150/300/500/750 | Shows path for 25/50/75/100% of timer |
| Slow Replay | Signal Echo | 1 | 200 | Sequence 30% slower |
| Calculator | Checksum Verify | 1 | 175 | Shows first digit of answer |
| Error Margin | Checksum Verify | 5 | 100/200/350/500/700 | Accept +/-1/+/-2/+/-3/+/-4/+/-5 tolerance |
| Range Hint | Checksum Verify | 3 | 150/300/500 | Shows answer range (+/-10/+/-5/+/-3) |
| Deep Scan | Port Scan | 1 | 200 | Ports flash twice |
| Port Logger | Port Scan | 1 | 200 | Shows open port list during selection |
| Mine Radar | Defrag | 4 | 150/300/500/750 | Row/col indicators for 25/50/75/100% of timer |
| Shift Marker | Cipher Crack V2 | 1 | 175 | Highlights shift offset in alphabet chart |
| Auto-Decode | Cipher Crack V2 | 3 | 200/400/650 | Pre-fills 20/40/60% of letters |
| CIDR Helper | Subnet Scan | 1 | 225 | Shows expanded IP range |

---

## Exported Functions from balancing.ts

| Function | Signature | Description |
|---|---|---|
| `getMinigamesPerFloor` | `(floor, diffReducerTier?) -> number` | Minigame count per floor using power curve |
| `getFloorBonusCredits` | `(startFloor) -> number` | Bonus CR for starting from checkpoint |
| `getDataReward` | `(floor) -> number` | Base data reward for clearing a floor |
| `getMilestoneBonus` | `(floor) -> number` | Bonus data at every 5th floor |
| `getRunShopPrice` | `(basePrice, floor) -> number` | Run shop item price scaling |
| `getTimeLimit` | `(baseTime, difficulty, floor?) -> number` | Adjusted time limit for a minigame |
| `getEffectiveTimeLimit` | `(base, diff, floor, siphon, cascade, injector) -> number` | Time with all meta stacking |
| `getEffectiveDifficulty` | `(floor, diffReducerTier) -> number` | Difficulty with meta applied |
| `getEffectiveDamage` | `(floor, armorTier) -> number` | Damage with Thicker Armor applied |
| `getEffectiveCredits` | `(timeMs, diff, creditTier, speedTaxTier, unlockBonus, floor?) -> number` | Credits with all meta |
| `getEffectiveDataReward` | `(floor, dataSiphonTier) -> number` | Data reward with Data Siphon |
| `getDataDrip` | `(floor) -> number` | Per-minigame data drip |
| `getCreditsSaved` | `(currentCredits, earnedThisRun) -> number` | Credit-to-data conversion |
| `getStartingCredits` | `(headStartTier) -> number` | Starting credits with Head Start |
| `getDeathPenaltyPct` | `(dataRecoveryTier, quitVoluntarily) -> number` | Death penalty percentage |
| `getDifficultyLabel` | `(difficulty) -> string` | Map 0-1 scalar to named label |

Constants: `CHECKPOINT_INTERVAL = 5`, `CHECKPOINT_UNLOCK_THRESHOLD = 1`, `DIFFICULTY_OPTIONS`.

---

## Example Runs

### Floor 1 -- Brand New Player

Assume no meta upgrades purchased.

**Setup:**
- Max HP: 100, Starting HP: 100, Starting Credits: 25.
- Floor 1 difficulty: `min(0.1 + 1/15, 1.0) = 0.167`.
- Minigames per floor: `max(1, round(1 + 19 * 0.167^1.65)) = 2`.

**Winning both minigames:**

- If you complete minigame 1 in 5 s: `base = 20 * 1.167 = 23.3`, `speedBonus = 1.25`, credits = `round(23.3 * 1.25) + 2 = 31`.
- If you complete minigame 2 in 8 s: `speedBonus = 1.1`, credits = `round(23.3 * 1.1) + 2 = 28`.
- Total credits after floor 1: 25 (start) + 31 + 28 = **84 CR**.

**Run shop at floor 1 (example item):**

A Repair Kit (base 65 CR): `round(65 * (1 + 1*0.25) * (1 + 1*0.01)) = round(65 * 1.25 * 1.01) = round(82.1) = 82 CR`.

**Per-minigame drip:** `round(1 + 1 * 0.8) = 2 data` per win -> 4 data total after 2 wins.

**Floor reward on clearing floor 1:**

`getDataReward(1) = round(3 + 1*4) = 7 data`.

**Death on floor 1 with 50 CR remaining (all 50 earned this run):**

- Base data: 7 data.
- Drip: 4 data.
- Credits saved: `floor(min(50, 50) * 0.08) = 4 data`.
- Pre-penalty: 15 data.
- Penalty (25%): `floor(15 * 0.25) = 3 data`.
- Total awarded: **12 data**.

---

### Floor 10 -- Mid-Game Run

Assume: Credit Multiplier tier 3, Thicker Armor tier 2, no other meta.

**Setup:**
- Floor 10 difficulty: `min(0.1 + 10/15, 1.0) = 0.767`.
- Minigames per floor: `max(1, round(1 + 19 * 0.767^1.65)) = 13`.
- Credit multiplier: `1.03^3 = 1.093`.

**Winning a minigame in 4 s at floor 10:**

- `base = 20 * (1 + 0.767) = 35.34`.
- `speedBonus = 1 + (1 - 4000/10000) * 0.5 = 1.3`.
- `baseCredits = round(35.34 * 1.3) + 20 = 46 + 20 = 66`.
- After multiplier: `round(66 * 1.093) = 72 CR`.

**Damage on failure at floor 10:**

- `rawDamage = 20 + 10 * 4 = 60`.
- After Thicker Armor tier 2 (-10%): `round(60 * 0.90) = 54 damage`.

**Milestone at floor 10 (first time reaching it):**

- `getMilestoneBonus(10) = 10 * 5 = 50 data` (full, since floor 10 > bestFloor).

**Run shop at floor 10 (example item):**

Repair Kit (base 65 CR): `round(65 * (1 + 10*0.25) * (1 + 100*0.01)) = round(65 * 3.5 * 2.0) = 455 CR`.

Reroll at floor 10: `round(20 + 10*10) = 120 CR`.

**Per-minigame drip at floor 10:** `round(1 + 10 * 0.8) = 9 data` per win.

**Floor 10 data reward:** `round(3 + 10*4) = 43 data`.

---

## Tuning Guide

All pure formulas are in `src/data/balancing.ts`. Edit constants there to adjust difficulty.

### Credit Income

| What to change | Where | Effect |
|---|---|---|
| Base credit amount per win | `getCredits`: change `20` | Scales all credit income linearly |
| Speed bonus magnitude | `getCredits`: change `0.5` | How much faster completions are rewarded |
| Speed bonus window | `getCredits`: change `10_000` | Time threshold for full speed bonus |
| Floor bonus per floor | `getCredits`: change `floor * 2` | Flat bonus per floor |
| Difficulty scaling | `getEffectiveDifficulty`: change `0.1` (floor-zero value) or `15` (ramp rate) | Credit base scales with difficulty |

### Run Shop Prices

| What to change | Where | Effect |
|---|---|---|
| Floor scaling rate | `getRunShopPrice`: `0.25` (linear) or `0.01` (quadratic) | How fast prices grow per floor |
| Item base prices | `src/data/power-ups.ts`: `basePrice` on each item | Individual item affordability |
| Per-purchase surcharge | `shop-slice.ts`: `0.05` in price calculation | How fast prices increase within a run |
| Vendor slot count | `src/data/upgrades/stat.ts`: Supply Line effects | Base items and upgrade tiers |

### Data Rewards

| What to change | Where | Effect |
|---|---|---|
| Base floor reward | `getDataReward`: change `3` (intercept) or `4` (slope) | How much data each floor is worth |
| Credit conversion rate | `getCreditsSaved`: `0.08` | Credits-to-data conversion |
| Milestone formula | `getMilestoneBonus`: change `floor * 5` | Milestone data scaling |
| Milestone frequency | `getMilestoneBonus`: change `% 5` modulo | How often milestones trigger |
| Per-win drip | `getDataDrip`: `1 + floor * 0.8` | Data trickle per minigame win |

### HP and Damage

| What to change | Where | Effect |
|---|---|---|
| Base HP | `run-slice.ts` `initialRunState`: `hp: 100` | Starting health |
| Damage per floor | `getDamage`: change `20` (base) or `4` (scaling) | How punishing failure is |
| Time limit curve | `getTimeLimit`: `0.4` (max compression at difficulty 1) | Pressure at high difficulty |
| Post-floor-15 time decay | `getTimeLimit`: `0.02` per floor, `0.4` minimum | Late-game time pressure |

### Death Penalty

The base penalty is 25% (`0.25` in `getDeathPenaltyPct`). The minimum with Data Recovery tier 6 is 10% (`0.10`). Each tier reduces the penalty by 2.5%. Change these to soften or harden the failure cost.

### Minigame Count

`getMinigamesPerFloor(floor, diffReducerTier) = max(1, round(1 + 19 * pow(difficulty, 1.65)))`. The power curve keeps low-difficulty floors short while high-difficulty floors have many protocols.
