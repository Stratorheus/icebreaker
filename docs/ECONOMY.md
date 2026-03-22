# Icebreaker Economy Reference

Complete reference for all numbers, formulas, and tuning knobs in the game economy.

---

## Currency Overview

The game has two currencies:

- **Credits (CR)** — ephemeral, earned inside a run, spent in the run shop, converted to Data on death/quit.
- **Data (◆)** — persistent across runs, earned at run end, spent in the Upgrade Terminal (meta shop).

---

## Credit Flow

### Earning Credits

Credits are awarded on every minigame win. All math lives in `src/data/balancing.ts`.

```
difficulty = min(0.1 + floor / 15, 1.0)       // getDifficulty
base       = 20 * (1 + difficulty)
speedBonus = 1 + max(0, 1 - timeMs / 10_000) * 0.5
credits    = round(base * speedBonus)           // getCredits
```

The speed bonus applies when the player completes the minigame in under 10 seconds. At exactly 0 ms it adds +50%; at 10 s it adds 0%.

**Meta upgrade modifiers applied on top (in `completeMinigame`):**

| Upgrade | Effect |
|---|---|
| Credit Multiplier (stackable) | `×1.03^tier` multiplicative |
| Minigame unlocks (beyond 5 starting) | `+5%` per extra unlock, multiplicative with Credit Multiplier |
| Speed Tax (tiered 1-3) | Flat `+round(base * tier * 0.05)` added to base before percentage multipliers are applied |

**Starting credits:**
- Base: 25 CR at run start (guaranteed minimum so floor 1 shop is usable).
- Head Start meta upgrade: +50 CR bonus on top of base.

### Spending Credits — Run Shop

The run shop appears between floors. It shows 3 or 4 randomly selected items.

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
| Buffer Extend (+2.5 s) | 70 CR | time |
| Chrono Surge (+1.5 s) | 40 CR | time |
| Damage Reducer (75% reduction) | 40 CR | defense |
| Nano Repair (+5 HP/win) | 45 CR | healing |
| Repair Kit (+25 HP) | 65 CR | healing |
| Backdoor (skip, no rewards) | 45 CR | skip |
| Repair Drone (+15 HP) | 50 CR | healing |
| Null Route (skip, full rewards) | 55 CR | skip |
| Clock Boost (+2 s) | 55 CR | time |
| Firewall Patch (shield) | 60 CR | defense |
| System Restore (+35 HP) | 80 CR | healing |
| Redundancy Layer (2× 50%) | 75 CR | defense |
| Warp Gate (skip floor, 15% rewards) | 150 CR | skip |
| Time Siphon (+0.2 s per win) | 35 CR | time |
| Deadline Override (1 s pause at 5%) | 50 CR | time |
| HP Leech (+2 HP after every protocol) | 40 CR | healing |

Healing items (Repair Kit, System Restore, Repair Drone) apply immediately on purchase and do not occupy an inventory slot. HP Leech enters the inventory and triggers after each protocol (win or fail), then is consumed at floor advance. All other items enter the inventory.

Note: Run-shop assist items (Slash Calibration, Bracket Auto-Close, Arrow Compass, Sector Scanner) were removed -- their meta-upgrade counterparts provide better coverage.

**No-stacking rule:** You cannot hold two items of the same type simultaneously.

### Credits → Data Conversion

When a run ends (death or voluntary quit), leftover credits convert to Data at **8%**:

```
creditsSaved = floor(credits * 0.08)
```

This is included in the pre-penalty Data subtotal.

---

## Data Flow

### How Data is Earned at Run End

Data is accumulated from four sources, summed before applying the death penalty:

```
prePenaltyData = baseDataEarned + dataDripThisRun + creditsSaved + milestoneDataThisRun
```

**1. Base floor reward** (`getDataReward` in `src/data/balancing.ts`):

```
baseData = round(3 + floor * 4)
```

Multiplied by Data Siphon meta upgrade if purchased:

```
baseDataEarned = round(baseData * 1.03^dataSiphonTier)
```

**2. Per-minigame drip** (accumulated in `dataDripThisRun` during the run):

```
minigameDataDrip = round(1 + floor * 0.8)   // awarded per win, added to running total
```

**3. Credits saved** — see conversion formula above.

**4. Milestone bonuses** (accumulated in `milestoneDataThisRun`):

Every 5th floor triggers a milestone. The bonus scales linearly with the floor number:

```
getMilestoneBonus(floor) = floor * 5    // only when floor % 5 === 0
```

Examples: floor 5 = 25 ◆, floor 10 = 50 ◆, floor 15 = 75 ◆, floor 20 = 100 ◆, floor 50 = 250 ◆, floor 100 = 500 ◆.

Milestone data is **not awarded immediately**. It accumulates in `milestoneDataThisRun` and is subject to the death penalty at run end.

**Milestone repeat penalty:** If the player has already cleared this floor in a previous run (i.e. `floor <= stats.bestFloor`), the milestone bonus is reduced to **25%** of the full amount.

### Death Penalty

On death, 25% of the pre-penalty total is deducted. The Data Recovery meta upgrade reduces this:

```
penaltyPct = max(0.10, 0.25 - dataRecoveryTier * 0.025)
// Tier 0 = 25%, Tier 1 = 22.5%, Tier 2 = 20%, Tier 3 = 17.5%, Tier 4 = 15%, Tier 5 = 12.5%, Tier 6 = 10%

penaltyAmount = floor(prePenaltyData * penaltyPct)
dataAfterPenalty = prePenaltyData - penaltyAmount
```

**Voluntary quit (QUIT RUN):** No death penalty is applied (`penaltyPct = 0`). The full pre-penalty total is awarded.

### Achievement Bonuses

After the base data award, `awardNewAchievements` runs and grants bonus Data for any newly unlocked achievements. This bonus is shown separately in the death screen breakdown. Achievement bonuses are **not subject to the death penalty** (they are awarded after it).

Achievement rewards range from 10 ◆ (First Breach) to 5000 ◆ (Singularity — floor 100).

### Spending Data — Meta Shop (Upgrade Terminal)

Three pricing models exist in `src/components/screens/MetaShop.tsx`:

**Stackable upgrades** (HP Boost, Credit Multiplier, Data Siphon, Delay Injector, Difficulty Reducer):

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

On minigame failure (`getDamage` in `src/data/balancing.ts`):

```
rawDamage  = 20 + floor * 4
```

**Thicker Armor** meta upgrade applies first:

```
baseDamage = round(rawDamage * (1 - armorReduction))
// Tier 1: -5%, Tier 2: -10%, Tier 3: -15%, Tier 4: -20%, Tier 5: -25%
```

Then run-shop defensive power-ups apply:
- **Firewall Patch (shield):** next failure deals 0 damage, consumed on trigger.
- **Damage Reducer:** next failure deals only 25% damage (75% reduction), consumed on trigger.
- **Redundancy Layer:** next 2 failures deal 50% damage each, consumed after both uses.

---

## Meta Upgrade Cost Reference

### Stackable Upgrades (base price, then +50% per purchase)

| Upgrade | Base Price | Effect per purchase |
|---|---|---|
| HP Boost | 100 ◆ | +5 max HP |
| Credit Multiplier | 100 ◆ | +3% credits (multiplicative) |
| Data Siphon | 100 ◆ | +3% data reward (multiplicative) |
| Delay Injector | 100 ◆ | +3% all timers (multiplicative) |
| Difficulty Reducer | 150 ◆ | ×0.95 effective difficulty |
| Emergency Patch | 120 ◆ | +2% max HP regen at start of each floor (stackable) |

### Tiered Stat Upgrades (fixed tiers, global scalar applies)

| Upgrade | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 | Effect |
|---|---|---|---|---|---|---|---|
| Thicker Armor | 100 ◆ | 200 ◆ | 350 ◆ | 500 ◆ | 750 ◆ | — | Damage -5/10/15/20/25% |
| Speed Tax | 100 ◆ | 250 ◆ | 500 ◆ | — | — | — | Speed bonus +15/25/40% |
| Data Recovery | 100 ◆ | 200 ◆ | 300 ◆ | 400 ◆ | 550 ◆ | 750 ◆ | Death penalty 22.5/20/17.5/15/12.5/10% |
| Cascade Clock | 150 ◆ | 300 ◆ | 500 ◆ | 750 ◆ | 1000 ◆ | — | +2% base timer per win, cap 10/20/30/40/50% |

### Starting Bonuses (one-time, global scalar applies)

| Upgrade | Price | Effect |
|---|---|---|
| Quick Boot | 200 ◆ | Start with 1 random power-up |
| Dual Core | 350 ◆ | Start with 2 random power-ups (requires Quick Boot) |
| Head Start | 150 ◆ | +50 starting credits |
| ~~Pre-Loaded~~ | ~~120 ◆~~ | Removed |
| Cache Primed | 175 ◆ | Floor 1 shop always has a heal item |
| Overclocked | 100 / 200 / 350 / 500 / 750 ◆ | +5/10/15/20/25 max and starting HP |

### Protocol Licenses (minigame unlocks)

First three unlocks have fixed prices (100 ◆ less than dynamic formula):

| License | Price | Unlocks |
|---|---|---|
| Address Lookup License | 300 ◆ | find-symbol |
| Wire Cutting Toolkit | 300 ◆ | wire-cutting |
| Cipher Crack V1 License | 300 ◆ | cipher-crack |

Remaining unlocks (Defrag, Network Trace, Signal Echo, Checksum Verify, Port Scan, Subnet Scan, Cipher Crack V2) use dynamic pricing:

```
price = round((200 + unlocksOwned * 100) * (1 + totalPurchasesMade * 0.15))
```

### Game-Specific Upgrades (tiered, global scalar applies)

| Upgrade | Protocol | Tiers | Prices | Effect |
|---|---|---|---|---|
| Bracket Reducer | Code Inject | 3 | 150/300/500 ◆ | Removes bracket types (slash/+pipe/+square) |
| Bracket Mirror | Code Inject | 1 | 150 ◆ | Shows next expected closing bracket |
| Memory Echo | Memory Scan | 5 | 150/250/400/600/850 ◆ | 20/30/40/50/60% mines visible at start |
| Symbol Scanner | Address Lookup | 1 | 200 ◆ | Subtly highlights target hex code |
| Arrow Preview | Packet Route | 5 | 150/250/400/600/850 ◆ | 20/30/40/50/60% of arrows pre-revealed |
| Wire Guide | Wire Cutting | 1 | 200 ◆ | Dims non-target wires, highlights next |
| Cipher Hint | Cipher Crack V1 | 1 | 225 ◆ | Shows first letter of answer |
| Decode Assist | Cipher Crack V1 | 3 | 150/300/500 ◆ | Pre-fills 25/50/75% of letters |
| Slash Window | Slash Timing | 1 | 175 ◆ | Attack window 25% wider |
| Autocorrect | Decrypt Signal | 4 | 150/300/500/750 ◆ | Shows 25/50/75/100% of words normally |
| Path Highlight | Network Trace | 4 | 150/300/500/750 ◆ | Shows path for 25/50/75/100% of timer |
| Slow Replay | Signal Echo | 1 | 200 ◆ | Sequence 30% slower |
| Calculator | Checksum Verify | 1 | 175 ◆ | Shows first digit of answer |
| Error Margin | Checksum Verify | 5 | 100/200/350/500/700 ◆ | Accept ±1/±2/±3/±4/±5 tolerance |
| Range Hint | Checksum Verify | 3 | 150/300/500 ◆ | Shows answer range (±50%/±30%/±15%) |
| Deep Scan | Port Scan | 1 | 200 ◆ | Ports flash twice |
| Port Logger | Port Scan | 1 | 200 ◆ | Shows open port list during selection |
| Mine Radar | Defrag | 4 | 150/300/500/750 ◆ | Row/col indicators for 25/50/75/100% of timer |
| Shift Marker | Cipher Crack V2 | 1 | 175 ◆ | Highlights shift offset in alphabet chart |
| Auto-Decode | Cipher Crack V2 | 3 | 200/400/650 ◆ | Pre-fills 25/50/75% of letters |
| CIDR Helper | Subnet Scan | 1 | 225 ◆ | Shows expanded IP range |

---

## Example Runs

### Floor 1 — Brand New Player

Assume no meta upgrades purchased.

**Setup:**
- Max HP: 100, Starting HP: 100, Starting Credits: 25.
- Floor 1 difficulty: `min(0.1 + 1/15, 1.0) ≈ 0.167`.
- Minigames per floor: `min(1 + 1, 8) = 2`.

**Winning both minigames:**

- If you complete minigame 1 in 5 s: `base = 20 * 1.167 ≈ 23.3`, `speedBonus = 1 + (1 - 5000/10000) * 0.5 = 1.25`, credits = `round(23.3 * 1.25) = 29`.
- If you complete minigame 2 in 8 s: `speedBonus = 1 + (1 - 8000/10000) * 0.5 = 1.1`, credits = `round(23.3 * 1.1) = 26`.
- Total credits after floor 1: 25 (start) + 29 + 26 = **80 CR**.

**Run shop at floor 1 (example item):**

A Repair Kit (base 50 CR): `round(50 * (1 + 1*0.25) * (1 + 1*0.01)) = round(50 * 1.25 * 1.01) = round(63.1) = 63 CR`.

**Per-minigame drip:** `round(1 + 1 * 0.8) = 2 ◆` per win → 4 ◆ total after 2 wins.

**Floor reward on clearing floor 1:**

`getDataReward(1) = round(3 + 1*4) = 7 ◆`.

**Death on floor 1 with 50 CR remaining:**

- Base data: 7 ◆.
- Drip: 4 ◆.
- Credits saved: `floor(50 * 0.08) = 4 ◆`.
- Pre-penalty: 15 ◆.
- Penalty (25%): `floor(15 * 0.25) = 3 ◆`.
- Total awarded: **12 ◆**.

---

### Floor 10 — Mid-Game Run

Assume: Credit Multiplier tier 3, Thicker Armor tier 2, no other meta.

**Setup:**
- Floor 10 difficulty: `min(0.1 + 10/15, 1.0) ≈ 0.767`.
- Minigames per floor: `min(1 + 10, 8) = 8`.
- Credit multiplier: `1.03^3 ≈ 1.093`.

**Winning a minigame in 4 s at floor 10:**

- `base = 20 * (1 + 0.767) = 35.34`.
- `speedBonus = 1 + (1 - 4000/10000) * 0.5 = 1.3`.
- `baseCredits = round(35.34 * 1.3) = 46`.
- After multiplier: `round(46 * 1.093) = 50 CR`.

**Damage on failure at floor 10:**

- `rawDamage = 20 + 10 * 4 = 60`.
- After Thicker Armor tier 2 (-20%): `round(60 * 0.8) = 48 damage`.

**Milestone at floor 10 (first time reaching it):**

- `getMilestoneBonus(10) = 10 * 5 = 50 ◆` (full, since floor 10 > bestFloor).

**Run shop at floor 10 (example item):**

Repair Kit (base 50 CR): `round(50 * (1 + 10*0.25) * (1 + 100*0.01)) = round(50 * 3.5 * 2.0) = 350 CR`.

Reroll at floor 10: `round(20 + 10*10) = 120 CR`.

**Per-minigame drip at floor 10:** `round(1 + 10 * 0.8) = 9 ◆` per win.

**Floor 10 data reward:** `round(3 + 10*4) = 43 ◆`.

---

## Tuning Guide

All pure formulas are in `src/data/balancing.ts`. Edit constants there to adjust difficulty.

### Credit Income

| What to change | Where | Effect |
|---|---|---|
| Base credit amount per win | `getCredits`: change `20` | Scales all credit income linearly |
| Speed bonus magnitude | `getCredits`: change `0.5` | How much faster completions are rewarded |
| Speed bonus window | `getCredits`: change `10_000` | Time threshold for full speed bonus |
| Difficulty scaling | `getDifficulty`: change `0.1` (floor-zero value) or `15` (ramp rate) | Credit base scales with difficulty |

### Run Shop Prices

| What to change | Where | Effect |
|---|---|---|
| Floor scaling rate | `getRunShopPrice`: `0.25` (linear) or `0.01` (quadratic) | How fast prices grow per floor |
| Item base prices | `src/data/power-ups.ts`: `basePrice` on each item | Individual item affordability |
| Per-purchase surcharge | `shop-slice.ts`: `0.05` in price calculation | How fast prices increase within a run |
| Reroll price | `RunShop.tsx`: `20 + floor * 10` | Reroll cost curve |

### Data Rewards

| What to change | Where | Effect |
|---|---|---|
| Base floor reward | `getDataReward`: change `3` (intercept) or `4` (slope) | How much data each floor is worth |
| Credit conversion rate | `DeathScreen.tsx`: `0.08` | Credits-to-data conversion |
| Milestone formula | `getMilestoneBonus`: change `floor * 5` | Milestone data scaling |
| Milestone frequency | `getMilestoneBonus`: change `% 5` modulo | How often milestones trigger |
| Per-win drip | `run-slice.ts` `completeMinigame`: `1 + floor * 0.8` | Data trickle per minigame win |

### HP and Damage

| What to change | Where | Effect |
|---|---|---|
| Base HP | `run-slice.ts` `initialRunState`: `hp: 100` | Starting health |
| Damage per floor | `getDamage`: change `20` (base) or `4` (scaling) | How punishing failure is |
| Time limit curve | `getTimeLimit`: `0.4` (max compression at difficulty 1) | Pressure at high difficulty |
| Post-floor-15 time decay | `getTimeLimit`: `0.02` per floor, `0.4` minimum | Late-game time pressure |

### Death Penalty

The base penalty is 25% (`0.25` in `DeathScreen.tsx`). The minimum with Data Recovery tier 6 is 10% (`0.10` in the `max(0.10, ...)` call). Each tier reduces the penalty by 2.5%. Change these to soften or harden the failure cost.

### Minigame Count

`getMinigamesPerFloor(floor) = min(1 + floor, 8)`. The cap of 8 prevents floors from becoming arbitrarily long. Lower the cap or reduce the slope to decrease floor length.
