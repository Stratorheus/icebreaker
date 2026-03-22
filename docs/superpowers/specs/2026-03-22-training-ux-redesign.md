# Training UX Redesign + Global Back Navigation — Design Spec

## Goal

Fix frustrating navigation (everything returns to main menu) and redesign Training upgrade controls (per-minigame checkboxes with tier control instead of global toggle).

## Scope

- Training flow: picker, briefing, active, result — all navigation
- Global back navigation: Codex, Stats, Meta Shop
- Training briefing: per-minigame difficulty + upgrade checkboxes with +/- tier
- Meta Shop → Training flow (unlock triggers training)

## 1. Back Navigation — "back o krok" principle

Every screen navigates back ONE step, not to menu. Where "back" goes depends on the origin.

### Training navigation

| Origin | Screen | BACK goes to |
|--------|--------|-------------|
| Menu → Training | Picker | Menu |
| Picker → select minigame | Briefing | Picker |
| Briefing → BEGIN | Result/complete | Briefing (preserved state) |
| Briefing → BACK | — | Picker |
| Meta Shop → unlock → training | Briefing | Meta Shop |
| Meta Shop → briefing → BEGIN | Result/complete | Briefing (preserved state) |
| Meta Shop → briefing → BACK | — | Meta Shop |

### Other screens

| Screen | From | BACK goes to |
|--------|------|-------------|
| Codex | Menu | Menu |
| Codex | Vendor (RunShop) | Vendor |
| Stats | Menu | Menu |
| Stats | Vendor (RunShop) | Vendor |
| Meta Shop | Menu | Menu |

### Implementation

Add `trainingOrigin: "picker" | "meta-shop" | null` to run-slice or a local state. Training briefing reads this to determine where BACK goes. Other screens already use `onBack` prop pattern — just ensure it's wired correctly.

## 2. Training Picker — Simplified

### Remove
- Global difficulty selector (moves to per-minigame briefing)
- Global "APPLY META UPGRADES" toggle (replaced by per-minigame checkboxes)

### Keep
- List of unlocked minigames as buttons
- BACK button → Menu

### State
Per-minigame settings are remembered in React state (not persisted):
```ts
type PerMinigameSettings = Record<MinigameType, {
  difficulty: number;
  activeUpgradeIds: Set<string>;
  upgradeTiers: Record<string, number>;
}>;
```
Reset to `{}` when returning to main menu.

When selecting a minigame: if settings exist for it, restore them. Otherwise default to NORMAL difficulty, all upgrades off.

## 3. Training Briefing — New Layout

### Top section (unchanged)
- Protocol name + ID
- BACK button (→ picker or meta shop depending on origin)

### Difficulty selector (NEW — moved from picker)
- 7 options: TRIVIAL / EASY / NORMAL / MEDIUM / HARD / EXPERT / INSANE
- Styled as segmented control (same as before, just moved here)
- Default: NORMAL (or last selected for this minigame)
- Remembered per-minigame

### Protocol Rules (unchanged)
### Controls (unchanged)
### Tactical Tips (unchanged)

### Meta Upgrades section (NEW — replaces global toggle)

For each game-specific meta upgrade that the player OWNS for this minigame:

```
┌─────────────────────────────────────────────────┐
│ [✓] Mine Radar                        [−] Lv.3 [+] │
│     Shows mine count per row/column for 75%...  │
└─────────────────────────────────────────────────┘
```

- **Checkbox** — on/off toggle. Default: OFF. Remembered per-minigame.
- **Name** — from META_UPGRADE_POOL
- **Description** — shows description for CURRENT selected tier (updates when +/- changes tier)
- **Tier +/- control** — min 1, max = purchased tier. Default = max purchased tier. Shows "Lv.X".
- Only OWNED upgrades shown with controls
- Upgrades with 0 purchased tiers: not shown at all (no dimmed placeholder)

**"OPEN META SHOP →"** link at the bottom of the section. Navigates to Meta Shop. When returning from Meta Shop, briefing state is preserved.

### Bottom buttons
- **BACK** — returns to picker (or meta shop if origin is meta-shop)
- **BEGIN TRAINING** — starts countdown with selected difficulty + active upgrades at selected tiers

## 4. Training Result → Back to Briefing

After completing or quitting training rounds:

- Show results (colored dots, rounds played, wins)
- **"CONTINUE TRAINING"** button → returns to briefing of the SAME minigame
- Difficulty and upgrade selections are preserved
- Player can immediately click "BEGIN TRAINING" again
- **"BACK TO LIST"** button → returns to picker (alternative if they want a different minigame)

## 5. Meta Shop → Training Flow

When player unlocks a new minigame in Meta Shop:
1. `trainingMinigame` is set, `trainingOrigin` = `"meta-shop"`
2. Training screen shows briefing (skips picker)
3. BACK from briefing → Meta Shop (not picker)
4. Result CONTINUE → briefing
5. Result BACK → Meta Shop
6. Briefing → OPEN META SHOP → returns to meta shop AND preserves training context for when they come back

## 6. ActiveRound — upgrade application

ActiveRound already accepts `useMetaUpgrades` boolean and reads `purchasedUpgrades` from store. Change to:
- Accept `activeUpgradeIds: Set<string>` and `upgradeTiers: Record<string, number>` instead
- Build power-ups only for checked upgrades at specified tiers
- This replaces the current `buildMetaPowerUps(purchasedUpgrades, type)` call with a filtered version

## What NOT to Change

- Minigame components — they still receive `activePowerUps` prop unchanged
- Run game loop — navigation during actual runs is fine
- Store slices — no schema changes needed
- Vendor/RunShop navigation — already works (Codex/Stats have onBack)

## What Gets Deleted

- Global difficulty selector from Training picker
- Global "APPLY META UPGRADES" toggle from Training picker
- The `useMetaUpgrades` boolean state — replaced by per-minigame checkbox state
