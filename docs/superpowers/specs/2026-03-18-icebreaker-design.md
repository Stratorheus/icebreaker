# Icebreaker — Game Design Spec

Cyberpunk-themed browser game. Timed reflex/memory/pattern minigames in a roguelike run structure. Inspired by Bitburner infiltration.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | latest | Build + dev server |
| Tailwind CSS | v4 (CSS-first) | Styling, `@tailwindcss/vite` plugin |
| shadcn/ui | new-york, dark-only | UI primitives (button, card, dialog, progress) |
| Zustand | v5 + persist | Game state (run) + meta state (localStorage) |
| motion | v12+ | Animations (transitions, glow, shake) |
| Lucide React | latest | Icons |

No router — single page, screens driven by game state. No backend. Persistence via localStorage.

## Visual Style

**Dual Tone + Terminal aesthetic.**

- **Cyan (#00ffff)** — system UI, info, structure, completed items
- **Magenta/Pink (#ff0066)** — action, danger, timers, currency, damage
- **Green (#00ff41)** — health, success, positive feedback
- **Orange (#ff6600)** — warnings, low timer, urgency
- **Background** — deep dark (#06060e) with subtle scanline overlay
- **Typography** — monospace throughout (JetBrains Mono / Fira Code / Cascadia Code fallback)
- **Textures** — scanlines, terminal prompts (`>_`), uppercase labels with letter-spacing

v1 focuses on functionality and game loop. Polish (glow effects, shake on damage, pulse on timer, glitch transitions) comes later.

## Game Loop & Progression

### Run Structure

```
Main Menu → Start Run → [Floor 1: 2-3 minigames] → Shop → [Floor 2: 3-4 minigames] → Shop → ... → Death
```

- **Endless run** — no victory cap, game continues until HP reaches 0
- **Floor** = sequence of minigames, randomly selected from unlocked pool (can repeat within floor)
- **Minigames per floor** grows: floor 1 = 2, floor 3 = 4, floor 6 = 6, floor 10+ = 8+
- **Difficulty** of minigames scales with floor number (shorter timers, larger grids, longer sequences)
- **Shop** after every floor = checkpoint, relax, purchasing
- **Milestones** — Floor 5, 10, 15, 20... = bonus data + announcement ("ICE LAYER 2 BREACHED")

### HP System

- Start: 100 HP
- Fail minigame: immediate end of minigame + damage (scales with floor difficulty)
- Success: no damage, credits + time bonus
- HP = 0 → run over → data reward based on floor reached

### Two Currencies

| Currency | Earned | Persistence | Used for |
|---|---|---|---|
| **Credits (CR)** | Successful minigames | Current run only | Run shop — consumable power-ups |
| **Data (◆)** | End of run (based on floor) + milestone bonuses | Permanent (localStorage) | Meta shop — permanent upgrades, unlocks |

### Balancing Anchors (v1 starting points, tuned during playtesting)

- **Damage**: base 15 HP, +3 per floor (floor 1 = 15, floor 5 = 30, floor 10 = 45)
- **Credits per minigame**: base 20 CR × difficulty multiplier × speed bonus (1.0-1.5x)
- **Data end-of-run**: `floor_reached × 10` (floor 5 = 50 ◆, floor 10 = 100 ◆)
- **Milestone bonus**: +50 ◆ at floor 5, +100 ◆ at floor 10, +200 ◆ at floor 15, +500 ◆ at floor 20
- **Difficulty mapping**: `difficulty = min(floor / 20, 1.0)` — reaches max at floor 20, stays at 1.0 after
- **Minigames per floor**: `min(1 + floor, 8)` — floor 1 = 2, floor 5 = 6, floor 7+ = 8
- **Run shop prices**: Repair Kit 50 CR (floor 1), prices × `1 + floor × 0.15`
- **Meta shop prices**: Minigame unlock 300 ◆, tier 1 upgrade 100 ◆, tier 2 = 250 ◆, tier 3 = 500 ◆
- **Power-ups**: cannot stack same type, no inventory limit, Time Freeze auto-activates on next minigame start

## Minigames

8 minigames. Each is a self-contained React component. Receives `difficulty: number` (0-1 scale, grows with floor), returns `{ success: boolean, timeMs: number }`.

| # | Name | Mechanic | Keyboard | Difficulty Scaling |
|---|---|---|---|---|
| 1 | **Slash Timing** | Cycles GUARD → PREPARE → ATTACK. Hit the ATTACK window. | Space | Window narrows, PREPARE shorter |
| 2 | **Close Brackets** | Shows opening sequence from `( [ { < \| \` — type matching closers in reverse. Pairs: `(/)`, `[/]`, `{/}`, `</>`, `\|/\|`, `\/\/`. | Bracket keys, \|, \, / | More brackets, shorter time |
| 3 | **Type Backward** | Tech words (firewall, kernel, proxy...) — type backward. Multiple words in sequence. | Typing | More words, longer words, shorter time |
| 4 | **Match Arrows** | Row of hidden arrows. One reveals → press correct arrow key. Confirms, reveals next. | Arrow keys | Longer row, shorter reaction time |
| 5 | **Find Symbol** | Grid of symbols + target sequence. Find and click current target in order. Cannot skip. | Arrow keys + Enter / Click | Larger grid, longer sequence, more similar symbols |
| 6 | **Mine Sweep** | Grid with mines shown for X seconds, then hidden — mark correct cells | Arrow keys + Enter / Click | Larger grid, more mines, shorter preview |
| 7 | **Wire Cutting** | Instructions ("Cut red before blue, skip green") → execute correct order | Number keys 1-9 | More wires, more complex rules |
| 8 | **Cipher Crack** | Encrypted text + hint on method (ROT-N, substitution) → type decrypted word | Typing | Harder ciphers, shorter time |

### Shared Principles

- Timer bar (cyan → orange → magenta as time depletes)
- Fail = immediate end (wrong input or timeout)
- Success = credits + time bonus (faster = more)
- All keyboard-controllable, mouse optional for grid games

### Unlock + Training System

- **Start**: 5 minigames unlocked (Slash Timing, Close Brackets, Type Backward, Match Arrows, Mine Sweep)
- **3 to unlock** in meta shop (Find Symbol, Wire Cutting, Cipher Crack)
- **Unlock flow**: purchase in meta shop → full briefing screen → mandatory training (2-3 rounds on easy, outside run) → added to run pool
- **In run**: minigame name + countdown (2s) before each game
- **Codex** (in menu): rules for all unlocked minigames, accessible anytime

## Shop & Power-ups

### Run Shop (after each floor, costs Credits)

Offers 3-4 random items from pool. Consumable — used once, gone at end of run.

| Category | Examples | Effect |
|---|---|---|
| **Time** | Time Freeze | +2s on next minigame |
| **Defense** | Firewall Patch | Next fail = 0 damage (once) |
| **Skip** | Backdoor | Skip 1 minigame on floor |
| **Healing** | Repair Kit | +20 HP |

Prices scale with floor (inflation — later floors = more CR earned but items cost more).

### Meta Shop (main menu, costs Data)

Permanent upgrades surviving between runs.

| Category | Examples | Effect |
|---|---|---|
| **Stat upgrades** | Thicker Armor (3 tiers) | -10/20/30% damage from fails |
| | Credit Multiplier (3 tiers) | +10/20/30% CR from minigames |
| | Data Siphon (3 tiers) | +10/20/30% Data at end of run |
| **Starting bonuses** | Quick Boot | Start with 1 random power-up |
| | Overclocked | Start with 110 HP instead of 100 |
| **Minigame unlocks** | Cipher Crack License | Unlocks Cipher Crack into pool |
| | Wire Cutting Toolkit | Unlocks Wire Cutting into pool |
| | Symbol Scanner License | Unlocks Find Symbol into pool |
| **Game-specific upgrades** | Bracket Reducer | Removes one bracket type from Close Brackets pool |
| | Mine Echo | Mine Sweep: 1 mine stays visible after preview |
| | Symbol Scanner | Find Symbol: current target blinks when cursor nearby |
| | Arrow Preview (3 tiers) | Match Arrows: first 1/2/3 arrows pre-revealed |
| | Mine Memory (3 tiers) | Mine Sweep: 1/2/3 mines stay visible |

Pools will be significantly expanded during implementation. This defines the structure.

## State Management

### Zustand Store — 3 slices

```
gameStore
├── runSlice        (reset on every new run)
│   ├── hp: number
│   ├── maxHp: number
│   ├── floor: number
│   ├── currentMinigameIndex: number
│   ├── floorMinigames: MinigameType[]
│   ├── inventory: PowerUp[]
│   ├── credits: number
│   ├── runScore: number
│   └── status: 'menu' | 'playing' | 'shop' | 'dead' | 'training'
│
├── metaSlice       (persist → localStorage)
│   ├── data: number
│   ├── unlockedMinigames: Set
│   ├── purchasedUpgrades: Map<id, tier>
│   ├── achievements: Set<id>
│   ├── stats: { totalRuns, bestFloor, totalMinigamesPlayed, ... }
│   └── seenBriefings: Set<MinigameType>
│
└── shopSlice       (holds generated offers, regenerated per floor/visit)
    ├── runShopOffers: PowerUp[]
    └── metaShopItems: MetaUpgrade[]
```

### Screen Flow (driven by `runSlice.status`)

```
'menu'     → MainMenu (start run, meta shop, codex, stats)
'training' → Training (briefing + 2-3 trial rounds)
'playing'  → MinigameScreen (briefing countdown → minigame → result)
'shop'     → RunShop (after last minigame on floor)
'dead'     → DeathScreen (stats, data earned, back to menu)
```

No router — single `<App>` with conditional rendering based on status.

## Achievements

Milestones rewarding specific playstyles. Permanent, tracked in metaSlice. Each gives a one-time data bonus.

| Achievement | Condition | Reward |
|---|---|---|
| **First Breach** | Complete floor 1 | 50 ◆ |
| **Script Kiddie** | Complete floor 5 | 200 ◆ |
| **Zero Day** | Complete floor 10 | 500 ◆ |
| **APT** | Complete floor 20 | 2000 ◆ |
| **Ghost Run** | Complete floor 5 without taking damage | 300 ◆ |
| **Speedrunner** | Complete floors 1-5 in under 60s total | 250 ◆ |
| **Bracket Master** | 10x successful Close Brackets in a row (across runs) | 150 ◆ |
| **Cipher Punk** | Complete Cipher Crack in under 3s | 200 ◆ |
| **Hoarder** | Have 5+ power-ups in inventory at once | 100 ◆ |
| **No Shortcuts** | Complete a floor without using power-ups | 150 ◆ |

**Note:** All item, power-up, upgrade, and achievement lists in this spec are inspirational examples defining the structure and categories. The actual pools must be significantly larger and more creative during implementation — aim for 15+ run shop items, 20+ meta upgrades, and 20+ achievements.
