# Training UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix navigation to go back one step (not menu), redesign Training with per-minigame difficulty + upgrade checkboxes with tier control.

**Architecture:** Training.tsx is the main file — picker simplifies (no global difficulty/toggle), briefing gains difficulty selector + upgrade cards with checkboxes/+- tier. Navigation uses origin-aware back callbacks. Per-minigame settings stored in local React state (not persisted).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-22-training-ux-redesign.md`

---

## File Structure

```
MODIFY:
  src/components/screens/Training.tsx      ← main changes: picker, briefing, result, state
  src/components/screens/MetaShop.tsx      ← training origin tracking on unlock
  src/store/run-slice.ts                   ← add trainingOrigin field
  src/types/game.ts                        ← add TrainingOrigin type
```

---

## Task 1: Add trainingOrigin to store

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/store/run-slice.ts`

- [ ] **Step 1:** In `src/types/game.ts`, add type:
```ts
export type TrainingOrigin = "picker" | "meta-shop" | null;
```

- [ ] **Step 2:** In `src/store/run-slice.ts`, add to RunSlice interface:
```ts
trainingOrigin: TrainingOrigin;
setTrainingOrigin: (origin: TrainingOrigin) => void;
```
Add to `initialRunState`:
```ts
trainingOrigin: null,
```
Add action:
```ts
setTrainingOrigin: (origin: TrainingOrigin) => {
  set({ trainingOrigin: origin });
},
```

- [ ] **Step 3:** Verify tsc: `npx tsc --noEmit`

- [ ] **Step 4:** Commit: `feat: trainingOrigin state for back navigation`

---

## Task 2: Update MetaShop unlock → training flow

**Files:**
- Modify: `src/components/screens/MetaShop.tsx`

- [ ] **Step 1:** Read MetaShop.tsx. Find where `setTrainingMinigame()` is called on unlock. Add `setTrainingOrigin("meta-shop")` before `setStatus("training")`.

- [ ] **Step 2:** Verify tsc + build

- [ ] **Step 3:** Commit: `feat: MetaShop sets trainingOrigin on unlock`

---

## Task 3: Redesign Training picker — remove globals

**Files:**
- Modify: `src/components/screens/Training.tsx`

- [ ] **Step 1:** Read Training.tsx fully. In the main `Training` component:

Add per-minigame settings state:
```ts
type MinigameTrainingSettings = {
  difficulty: number;
  activeUpgradeIds: Set<string>;
  upgradeTiers: Record<string, number>;
};

const [perMinigameSettings, setPerMinigameSettings] = useState<
  Partial<Record<MinigameType, MinigameTrainingSettings>>
>({});
```

Remove:
- `selectedDifficulty` state (global) — moves to per-minigame
- `useMetaUpgrades` state (global toggle) — replaced by per-minigame checkboxes

- [ ] **Step 2:** Update `PickerPhase`:
- Remove difficulty selector (7 buttons)
- Remove meta upgrades toggle switch
- Remove `selectedDifficulty` prop — picker no longer sets difficulty
- `onPick` callback now just takes `(type: MinigameType)` — no difficulty or meta param

- [ ] **Step 3:** Update `handlePickGame`:
```ts
const handlePickGame = useCallback((pickedType: MinigameType) => {
  setTrainingMinigame(pickedType);
  if (!trainingOrigin) setTrainingOrigin("picker");
  setPhase("briefing");
  setRound(1);
  setRoundResults([]);
  setLastSuccess(null);
}, [setTrainingMinigame, trainingOrigin, setTrainingOrigin]);
```

- [ ] **Step 4:** Verify tsc + build

- [ ] **Step 5:** Commit: `refactor: simplify Training picker, add per-minigame settings`

---

## Task 4: Redesign Training briefing — difficulty + upgrade checkboxes

**Files:**
- Modify: `src/components/screens/Training.tsx`

- [ ] **Step 1:** Update `BriefingPhase` props:
```ts
function BriefingPhase({
  type,
  briefing,
  settings,           // current MinigameTrainingSettings for this minigame
  onSettingsChange,    // update settings
  onBegin,
  onBack,
  onOpenMetaShop,      // navigate to meta shop
}: { ... })
```

- [ ] **Step 2:** Add difficulty selector to BriefingPhase (moved from picker):
- 7 buttons in segmented control style
- Reads `settings.difficulty` (default 0.3 NORMAL)
- On change: `onSettingsChange({ ...settings, difficulty: value })`

- [ ] **Step 3:** Replace old meta upgrades section with per-upgrade checkboxes:
- Read `purchasedUpgrades` from store
- Get game-specific upgrades for this minigame from `MINIGAME_REGISTRY[type].metaUpgrades`
- For each upgrade with `purchasedUpgrades[upgrade.id] > 0`:
  - Render card with:
    - Checkbox (checked if `settings.activeUpgradeIds.has(upgrade.id)`)
    - Name + description (for current selected tier)
    - +/- tier control: min 1, max `purchasedUpgrades[upgrade.id]`, current `settings.upgradeTiers[upgrade.id] ?? purchasedUpgrades[upgrade.id]`
  - On checkbox toggle: add/remove from `settings.activeUpgradeIds`
  - On +/-: update `settings.upgradeTiers[upgrade.id]`
  - Description updates based on selected tier (read from `upgrade.effects[selectedTier - 1]`)
- "OPEN META SHOP →" link: calls `onOpenMetaShop()`

- [ ] **Step 4:** Remove old upgrade card display (the green bordered section from previous implementation)

- [ ] **Step 5:** Verify tsc + build

- [ ] **Step 6:** Commit: `feat: Training briefing with per-minigame difficulty + upgrade controls`

---

## Task 5: Update ActiveRound — use selected upgrades + tiers

**Files:**
- Modify: `src/components/screens/Training.tsx`

- [ ] **Step 1:** Update `ActiveRound` to accept settings:
```ts
function ActiveRound({
  type,
  settings,    // MinigameTrainingSettings
  onComplete,
}: { ... })
```

- [ ] **Step 2:** Build power-ups from settings instead of `purchasedUpgrades`:
```ts
const activePowerUps = useMemo(() => {
  const config = MINIGAME_REGISTRY[type];
  const synth: PowerUpInstance[] = [];
  for (const upgrade of config.metaUpgrades) {
    if (!settings.activeUpgradeIds.has(upgrade.id)) continue;
    const tier = settings.upgradeTiers[upgrade.id] ?? 1;
    const effect = upgrade.effects[tier - 1];
    if (!effect) continue;
    synth.push({
      id: `meta-${upgrade.id}`,
      type: `meta-${upgrade.id}`,
      name: upgrade.name,
      description: upgrade.description,
      effect: { type: effect.type, value: effect.value, minigame: type },
    });
  }
  return synth;
}, [type, settings]);
```

- [ ] **Step 3:** Pass `settings.difficulty` as difficulty and `activePowerUps` to the component:
```ts
<Component
  difficulty={settings.difficulty}
  timeLimit={TRAINING_TIME_LIMIT}
  activePowerUps={activePowerUps}
  onComplete={onComplete}
/>
```

- [ ] **Step 4:** Verify tsc + build

- [ ] **Step 5:** Commit: `feat: ActiveRound uses per-minigame upgrade settings`

---

## Task 6: Update Training result — back to briefing

**Files:**
- Modify: `src/components/screens/Training.tsx`

- [ ] **Step 1:** Update `CompletePhase`:
- Rename "RETURN TO MENU" button to "CONTINUE TRAINING"
- Add: calls `onContinue()` which sets phase back to "briefing" (not menu)
- Add secondary button: "BACK TO LIST" which calls `onBackToList()` → goes to picker
- `handleFinish` now goes to briefing, not menu:
```ts
const handleContinue = useCallback(() => {
  // Return to briefing with preserved settings
  setPhase("briefing");
  setRound(1);
  setRoundResults([]);
  setLastSuccess(null);
}, []);

const handleBackToList = useCallback(() => {
  setTrainingMinigame(null);
  setTrainingOrigin(null);
  setPhase("picker");
}, []);
```

- [ ] **Step 2:** Update briefing `onBack`:
```ts
const handleBriefingBack = useCallback(() => {
  if (trainingOrigin === "meta-shop") {
    // Return to meta shop
    setTrainingMinigame(null);
    setTrainingOrigin(null);
    setStatus("meta-shop");
  } else {
    // Return to picker
    setTrainingMinigame(null);
    setPhase("picker");
  }
}, [trainingOrigin, setTrainingMinigame, setTrainingOrigin, setStatus]);
```

- [ ] **Step 3:** Update picker `handleBack`:
```ts
const handleBack = useCallback(() => {
  setTrainingMinigame(null);
  setTrainingOrigin(null);
  setStatus("menu");
}, []);
```

- [ ] **Step 4:** Handle "OPEN META SHOP" from briefing:
```ts
const handleOpenMetaShop = useCallback(() => {
  // Go to meta shop but remember we came from training
  setStatus("meta-shop");
  // trainingMinigame stays set so we can return
}, [setStatus]);
```
Note: returning from meta shop to training requires meta shop to call `setStatus("training")` when back is pressed if `trainingMinigame` is set.

- [ ] **Step 5:** Verify tsc + build

- [ ] **Step 6:** Commit: `feat: Training result returns to briefing, origin-aware back`

---

## Task 7: Global back navigation for other screens

**Files:**
- Modify: `src/components/screens/Codex.tsx` — verify `onBack` prop works
- Modify: `src/components/screens/Stats.tsx` — verify `onBack` prop works
- Modify: `src/components/screens/MetaShop.tsx` — add back-to-training support

- [ ] **Step 1:** Codex and Stats already have `onBack` prop. Verify they work from both menu and vendor. No changes needed if already correct.

- [ ] **Step 2:** MetaShop: when BACK is pressed, check if `trainingMinigame` is set. If yes, return to training (not menu):
```ts
const handleBack = useCallback(() => {
  if (trainingMinigame) {
    setStatus("training");
  } else {
    setStatus("menu");
  }
}, [trainingMinigame, setStatus]);
```

- [ ] **Step 3:** Verify tsc + build

- [ ] **Step 4:** Commit: `feat: global back navigation, MetaShop ↔ Training`

---

## Task 8: Final polish + cleanup

**Files:**
- Modify: `src/components/screens/Training.tsx`

- [ ] **Step 1:** Clean up unused imports from old implementation (META_UPGRADE_POOL if no longer needed, old state variables)

- [ ] **Step 2:** Ensure `perMinigameSettings` resets when returning to menu (in `handleBack`)

- [ ] **Step 3:** Full build: `npm run build`

- [ ] **Step 4:** Manual test:
- Menu → Training → pick game → verify difficulty selector in briefing
- Toggle upgrades on/off → verify they apply in active round
- Complete round → verify "CONTINUE TRAINING" returns to briefing with settings preserved
- Briefing → BACK → verify returns to picker
- Meta Shop → unlock → training → BACK → verify returns to meta shop
- Briefing → OPEN META SHOP → buy something → BACK → verify returns to training

- [ ] **Step 5:** Commit: `feat: Training UX redesign complete`

---

## Task Dependency Graph

```
Task 1 (trainingOrigin state)
  → Task 2 (MetaShop origin)
  → Task 3 (picker simplification)
    → Task 4 (briefing redesign)
      → Task 5 (ActiveRound upgrade application)
      → Task 6 (result → briefing navigation)
        → Task 7 (global back nav)
          → Task 8 (cleanup)
```
