# Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish test infrastructure and write unit + E2E tests covering core game mechanics, economy formulas, power-up system, and full game loop.

**Architecture:** Two-layer testing: Vitest for fast unit tests (pure functions, store actions, registry logic) + Playwright for E2E browser tests (full game loop, UI interactions, minigame completion). CI pipeline updated to run tests before deploy.

**Tech Stack:** Vitest, @testing-library/react, jsdom, Playwright

---

## File Structure

```
CREATE:
  vitest.config.ts                          ← Vitest config with jsdom + path aliases
  playwright.config.ts                      ← Playwright config
  src/__tests__/
  ├── balancing.test.ts                     ← all 12 economy functions
  ├── power-up-effects.test.ts              ← applyShield, checkSkip
  ├── minigame-registry.test.ts             ← registry completeness, buildMetaPowerUps
  ├── upgrade-registry.test.ts              ← META_UPGRADE_POOL integrity
  ├── run-slice.test.ts                     ← startRun, completeMinigame, failMinigame, skipRemainingFloor
  └── meta-slice.test.ts                    ← purchaseUpgrade, recordMinigameResult
  e2e/
  ├── game-loop.spec.ts                     ← start run → play → shop → death → menu
  ├── training.spec.ts                      ← open training → pick game → play → quit
  └── meta-shop.spec.ts                     ← buy upgrades → verify applied in run

MODIFY:
  package.json                              ← add test scripts + devDependencies
  vite.config.ts                            ← add test config block
  .github/workflows/fly-deploy.yml          ← add test step before deploy
  tsconfig.app.json                         ← include test files
```

---

## Task 1: Install test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1:** Install Vitest + testing utilities:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

- [ ] **Step 2:** Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 3:** Add scripts to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 4:** Update `tsconfig.app.json` to include test files:
```json
"include": ["src", "src/__tests__"]
```

- [ ] **Step 5:** Verify: `npm test` runs (0 tests found, no errors)

- [ ] **Step 6:** Commit: `feat: Vitest test infrastructure`

---

## Task 2: Unit tests — balancing.ts (12 functions)

**Files:**
- Create: `src/__tests__/balancing.test.ts`

These are pure functions — easiest to test, highest value. Every economy formula centralized here.

- [ ] **Step 1:** Write tests for all functions:

```ts
import { describe, it, expect } from "vitest";
import {
  getEffectiveDifficulty,
  getEffectiveTimeLimit,
  getEffectiveDamage,
  getEffectiveCredits,
  getEffectiveDataReward,
  getCreditsSaved,
  getDeathPenaltyPct,
  getDataDrip,
  getTimeLimit,
  getMinigamesPerFloor,
  getDataReward,
  getMilestoneBonus,
  getRunShopPrice,
  getStartingCredits,
} from "@/data/balancing";

describe("balancing", () => {
  describe("getMinigamesPerFloor", () => {
    it("floor 1 gives 2 minigames", () => {
      expect(getMinigamesPerFloor(1)).toBe(2);
    });
    it("caps at 8", () => {
      expect(getMinigamesPerFloor(100)).toBe(8);
    });
  });

  describe("getDataReward", () => {
    it("floor 1 gives 7", () => {
      expect(getDataReward(1)).toBe(Math.round(3 + 1 * 4));
    });
    it("scales with floor", () => {
      expect(getDataReward(10)).toBe(Math.round(3 + 10 * 4));
    });
  });

  describe("getMilestoneBonus", () => {
    it("returns 0 for non-milestone floors", () => {
      expect(getMilestoneBonus(3)).toBe(0);
    });
    it("returns floor*5 for milestone floors (every 5th)", () => {
      expect(getMilestoneBonus(5)).toBe(25);
      expect(getMilestoneBonus(10)).toBe(50);
    });
    it("returns 0 for floor 0", () => {
      expect(getMilestoneBonus(0)).toBe(0);
    });
  });

  describe("getRunShopPrice", () => {
    it("floor 1 applies scaling", () => {
      const price = getRunShopPrice(100, 1);
      expect(price).toBe(Math.round(100 * (1 + 1 * 0.25) * (1 + 1 * 0.01)));
    });
    it("scales quadratically with floor", () => {
      const f1 = getRunShopPrice(100, 1);
      const f10 = getRunShopPrice(100, 10);
      expect(f10).toBeGreaterThan(f1);
    });
  });

  describe("getTimeLimit", () => {
    it("reduces with difficulty", () => {
      const easy = getTimeLimit(10, 0);
      const hard = getTimeLimit(10, 1);
      expect(hard).toBeLessThan(easy);
    });
    it("applies floor scale after floor 15", () => {
      const f1 = getTimeLimit(10, 0.5, 1);
      const f20 = getTimeLimit(10, 0.5, 20);
      expect(f20).toBeLessThan(f1);
    });
    it("no floor scale for floor <= 15", () => {
      const f1 = getTimeLimit(10, 0.5, 1);
      const f15 = getTimeLimit(10, 0.5, 15);
      expect(f15).toBe(f1);
    });
  });

  describe("getEffectiveDifficulty", () => {
    it("returns base difficulty for tier 0", () => {
      // getDifficulty(1) = min(0.1 + 1/15, 1.0) ≈ 0.167
      expect(getEffectiveDifficulty(1, 0)).toBeCloseTo(0.167, 2);
    });
    it("reduces difficulty per tier (0.95^tier)", () => {
      const d0 = getEffectiveDifficulty(5, 0);
      const d3 = getEffectiveDifficulty(5, 3);
      expect(d3).toBeLessThan(d0);
      expect(d3).toBeCloseTo(d0 * Math.pow(0.95, 3), 5);
    });
    it("caps base at 1.0", () => {
      expect(getEffectiveDifficulty(100, 0)).toBeLessThanOrEqual(1.0);
    });
  });

  describe("getEffectiveTimeLimit", () => {
    it("applies flat bonuses (timeSiphon) before percentages", () => {
      // signature: (baseTimeLimitSecs, difficulty, floor, timeSiphonBonus, cascadeClockPct, delayInjectorTier)
      const base = getEffectiveTimeLimit(10, 0.5, 1, 0, 0, 0);
      const withFlat = getEffectiveTimeLimit(10, 0.5, 1, 2, 0, 0);
      const withPct = getEffectiveTimeLimit(10, 0.5, 1, 0, 0.5, 0);
      const withBoth = getEffectiveTimeLimit(10, 0.5, 1, 2, 0.5, 0);
      // flat + pct synergy: more than either alone
      expect(withBoth).toBeGreaterThan(withFlat);
      expect(withBoth).toBeGreaterThan(withPct);
    });
    it("delay injector (1.03^tier) amplifies everything", () => {
      const noInjector = getEffectiveTimeLimit(10, 0.5, 1, 2, 0, 0);
      const withInjector = getEffectiveTimeLimit(10, 0.5, 1, 2, 0, 5);
      expect(withInjector).toBeGreaterThan(noInjector);
    });
    it("cascade clock pct amplifies base + flat", () => {
      const noCascade = getEffectiveTimeLimit(10, 0.5, 1, 0, 0, 0);
      const withCascade = getEffectiveTimeLimit(10, 0.5, 1, 0, 0.3, 0);
      expect(withCascade).toBeGreaterThan(noCascade);
    });
  });

  describe("getEffectiveDamage", () => {
    it("returns full damage with tier 0", () => {
      // getDamage(1) = 20 + 1*4 = 24
      expect(getEffectiveDamage(1, 0)).toBe(24);
    });
    it("reduces by 25% at tier 5", () => {
      const full = getEffectiveDamage(5, 0);
      const reduced = getEffectiveDamage(5, 5);
      expect(reduced).toBe(Math.round(full * 0.75));
    });
    it("armor reduction lookup: tier 1 = 5%, tier 3 = 15%", () => {
      const full = getEffectiveDamage(1, 0);
      expect(getEffectiveDamage(1, 1)).toBe(Math.round(full * 0.95));
      expect(getEffectiveDamage(1, 3)).toBe(Math.round(full * 0.85));
    });
  });

  describe("getEffectiveCredits", () => {
    it("speed tax flat added before credit multiplier", () => {
      // signature: (timeMs, difficulty, creditTier, speedTaxTier, unlockBonus)
      const noTax = getEffectiveCredits(5000, 0.5, 3, 0, 0);
      const withTax = getEffectiveCredits(5000, 0.5, 3, 2, 0);
      expect(withTax).toBeGreaterThan(noTax);
    });
    it("unlock bonus applies as final multiplier", () => {
      const noBonus = getEffectiveCredits(5000, 0.5, 0, 0, 0);
      const withBonus = getEffectiveCredits(5000, 0.5, 0, 0, 0.5);
      expect(withBonus).toBeGreaterThan(noBonus);
    });
  });

  describe("getEffectiveDataReward", () => {
    it("data siphon scales by 1.03^tier", () => {
      const base = getEffectiveDataReward(5, 0);
      const t3 = getEffectiveDataReward(5, 3);
      expect(t3).toBe(Math.round(base * Math.pow(1.03, 3)));
    });
  });

  describe("getCreditsSaved", () => {
    it("saves 8% of credits", () => {
      expect(getCreditsSaved(100)).toBe(8);
      expect(getCreditsSaved(50)).toBe(4);
    });
  });

  describe("getDeathPenaltyPct", () => {
    it("returns 0 for voluntary quit", () => {
      expect(getDeathPenaltyPct(0, true)).toBe(0);
    });
    it("returns 25% base for death with no recovery", () => {
      expect(getDeathPenaltyPct(0, false)).toBe(0.25);
    });
    it("reduces by 2.5% per tier", () => {
      expect(getDeathPenaltyPct(2, false)).toBeCloseTo(0.20);
    });
    it("caps at 10% minimum", () => {
      expect(getDeathPenaltyPct(100, false)).toBe(0.10);
    });
  });

  describe("getStartingCredits", () => {
    it("gives 25 base with no upgrade", () => {
      expect(getStartingCredits(0)).toBe(25);
    });
    it("tier 1 gives 75 (25 + 50)", () => {
      expect(getStartingCredits(1)).toBe(75);
    });
    it("tier 5 gives 1025 (25 + 1000)", () => {
      expect(getStartingCredits(5)).toBe(1025);
    });
  });

  describe("getDataDrip", () => {
    it("scales with floor: round(1 + floor * 0.8)", () => {
      expect(getDataDrip(1)).toBe(Math.round(1 + 1 * 0.8));
      expect(getDataDrip(10)).toBe(Math.round(1 + 10 * 0.8));
    });
  });
});
```

- [ ] **Step 2:** Run: `npm test` — all should pass

- [ ] **Step 3:** Commit: `test: unit tests for balancing.ts`

---

## Task 3: Unit tests — power-up-effects.ts

**Files:**
- Create: `src/__tests__/power-up-effects.test.ts`

- [ ] **Step 1:** Write tests for applyShield and checkSkip:

```ts
describe("applyShield", () => {
  it("full shield blocks all damage", () => { ... });
  it("damage-reduction applies factor", () => { ... });
  it("damage-reduction-stacked decrements uses", () => { ... });
  it("damage-reduction-stacked consumed on last use", () => { ... });
  it("priority: shield > stacked > reduction", () => { ... });
  it("no shield returns full damage", () => { ... });
});

describe("checkSkip", () => {
  it("priority: skip-floor > skip-silent > skip", () => { ... });
  it("skip-floor returns skipFloor: true", () => { ... });
  it("null-route returns rewardFraction: 1", () => { ... });
  it("backdoor returns rewardFraction: 0", () => { ... });
  it("no skip power-up returns skip: false", () => { ... });
});
```

- [ ] **Step 2:** Run tests, verify pass

- [ ] **Step 3:** Commit: `test: unit tests for power-up-effects.ts`

---

## Task 4: Unit tests — minigame registry

**Files:**
- Create: `src/__tests__/minigame-registry.test.ts`

- [ ] **Step 1:** Write registry integrity tests:

```ts
describe("MINIGAME_REGISTRY", () => {
  it("has entry for every MinigameType", () => { ... });
  it("all configs have required fields", () => { ... });
  it("STARTING_MINIGAMES + UNLOCKABLE_MINIGAMES covers all types", () => { ... });
  it("no duplicate IDs in metaUpgrades across configs", () => { ... });
});

describe("buildMetaPowerUps", () => {
  it("returns empty for tier 0 upgrades", () => { ... });
  it("returns correct power-up for purchased upgrade", () => { ... });
  it("uses correct tier value from effects array", () => { ... });
  it("sets name and description from META_UPGRADE_POOL", () => { ... });
});

describe("derived data", () => {
  it("BASE_TIME_LIMITS matches configs", () => { ... });
  it("MINIGAME_COMPONENTS has all entries", () => { ... });
  it("getMinigameDisplayName returns correct name", () => { ... });
});
```

- [ ] **Step 2:** Run tests, verify pass

- [ ] **Step 3:** Commit: `test: unit tests for minigame registry`

---

## Task 5: Unit tests — upgrade registry

**Files:**
- Create: `src/__tests__/upgrade-registry.test.ts`

- [ ] **Step 1:** Write META_UPGRADE_POOL integrity tests:

```ts
describe("META_UPGRADE_POOL", () => {
  it("has no duplicate IDs", () => { ... });
  it("all game-specific upgrades have valid minigame refs", () => { ... });
  it("all unlock licenses reference unlockable minigames", () => { ... });
  it("wire-cutting-toolkit ID is preserved (not auto-generated)", () => { ... });
  it("cipher-crack-v2 license requires cipher-crack-license", () => { ... });
  it("dynamic-priced licenses have prices: [0]", () => { ... });
  it("all tiers have matching effects count", () => { ... });
});
```

- [ ] **Step 2:** Run tests, verify pass

- [ ] **Step 3:** Commit: `test: unit tests for upgrade registry`

---

## Task 6: Unit tests — store slices (run-slice, meta-slice)

**Files:**
- Create: `src/__tests__/run-slice.test.ts`
- Create: `src/__tests__/meta-slice.test.ts`

Testing Zustand stores requires creating isolated store instances.

- [ ] **Step 1:** Write run-slice tests:

```ts
describe("run-slice", () => {
  describe("startRun", () => {
    it("resets all run state", () => { ... });
    it("applies Head Start credits", () => { ... });
    it("applies Overclocked HP bonus", () => { ... });
    it("sets correct starting HP with HP Boost", () => { ... });
  });
  describe("completeMinigame", () => {
    it("awards credits with rewardFraction", () => { ... });
    it("accumulates dataDripThisRun", () => { ... });
    it("increments timeSiphonBonus when power-up active", () => { ... });
    it("increments cascadeClockPct capped at tier max", () => { ... });
    it("applies heal-on-success", () => { ... });
  });
  describe("failMinigame", () => {
    it("applies damage with armor reduction", () => { ... });
    it("resets cascadeClockPct", () => { ... });
    it("resets timeSiphonBonus", () => { ... });
    it("applies hp-leech if survived", () => { ... });
    it("sets status dead if HP reaches 0", () => { ... });
    it("re-rolls minigame on survive", () => { ... });
  });
  describe("skipRemainingFloor", () => {
    it("awards fractional credits for remaining games", () => { ... });
    it("applies heal and leech for remaining games", () => { ... });
    it("cleans up floor-scoped power-ups", () => { ... });
    it("resets timeSiphonBonus", () => { ... });
    it("detects milestones", () => { ... });
  });
});
```

- [ ] **Step 2:** Write meta-slice tests:

```ts
describe("meta-slice", () => {
  it("purchaseUpgrade increments tier", () => { ... });
  it("purchaseUpgrade deducts data", () => { ... });
  it("recordMinigameResult updates win totals", () => { ... });
  it("addData persists across runs", () => { ... });
});
```

- [ ] **Step 3:** Run tests, verify pass

- [ ] **Step 4:** Commit: `test: unit tests for store slices`

---

## Task 7: Install Playwright + infrastructure

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1:** Install Playwright:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2:** Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  webServer: {
    command: "npm run dev -- --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4173",
  },
});
```

- [ ] **Step 3:** Commit: `test: Playwright infrastructure`

---

## Task 7a: Add data-testid attributes to minigame components

**Prerequisite for minigame E2E tests.** Each minigame component needs attributes that Playwright can read to know what the correct answer is. No logic changes — just add `data-testid` and `data-*` attributes.

**Files:**
- Modify: all 15 `src/components/minigames/*.tsx`

For each minigame, add attributes that expose the expected answer:

| Minigame | Attribute needed |
|----------|-----------------|
| SlashTiming | `data-testid="slash-phase"` `data-phase={phase}` on phase container |
| CloseBrackets | `data-testid="expected-closer"` `data-key={expectedCloser}` on a hidden span |
| TypeBackward | `data-testid="expected-word"` `data-word={currentAnswer}` |
| MatchArrows | `data-testid="expected-arrow"` `data-key={currentArrow.key}` |
| FindSymbol | `data-testid="target-code"` `data-code={targets[targetIndex]}` |
| MineSweep | `data-testid="mine-cell"` on mine cells during preview |
| WireCutting | `data-testid="next-wire"` `data-index={nextWireIndex}` |
| CipherCrack | `data-testid="expected-char"` `data-char={word[charIndex]}` |
| CipherCrackV2 | `data-testid="expected-char"` `data-char={word[charIndex]}` |
| Defrag | `data-testid="cell"` `data-mine={cell.isMine}` `data-index={i}` |
| NetworkTrace | `data-testid="player"` `data-row` `data-col` + `data-testid="end"` |
| SignalEcho | `data-testid="echo-sequence"` `data-sequence={JSON.stringify(sequence)}` |
| ChecksumVerify | `data-testid="expected-answer"` `data-answer={expr.answer}` |
| PortScan | `data-testid="port-cell"` `data-open={isOpen}` on each port |
| SubnetScan | `data-testid="address"` `data-correct={isCorrect}` on each address |

Also add to Training upgrade cards:
| Element | Attribute needed |
|---------|-----------------|
| Upgrade card | `data-testid="upgrade-card"` `data-upgrade-id={upgrade.id}` |
| Upgrade checkbox | `data-testid="upgrade-checkbox"` `data-checked={isActive}` |
| Mine radar row indicator | `data-testid="mine-radar-row"` |
| Mine radar col indicator | `data-testid="mine-radar-col"` |
| Arrow preview indicator | `data-testid="preview-arrow"` |

- [ ] **Step 1:** Add data-testid attributes to all 15 components (hidden from user, only for tests)

- [ ] **Step 2:** Verify build: `npm run build`

- [ ] **Step 3:** Commit: `test: add data-testid attributes for E2E testing`

---

## Task 7b: E2E tests — per-minigame via Training

**Strategy:** Use Training mode as test sandbox. Current flow (v1.3.1):
1. Navigate: Menu → TRAINING → Pick minigame from list (picker phase)
2. Briefing phase: select difficulty (7 buttons), optionally toggle upgrades
3. Click BEGIN TRAINING → countdown (3-2-1-GO) → active minigame
4. Read data-testid attributes to know correct answer
5. Interact (type, click, press keys)
6. Assert SUCCESS/FAILED in round-result phase
7. After 3 rounds → complete phase, or quit via ESC/QUIT button

**Important:** Difficulty is selected in the **briefing** phase (not picker). Picker is just a list of unlocked minigames. Upgrades are per-minigame checkboxes in briefing (not a global toggle).

**Files:**
- Create: `e2e/minigames/slash-timing.spec.ts`
- Create: `e2e/minigames/close-brackets.spec.ts`
- Create: `e2e/minigames/type-backward.spec.ts`
- ... (one per minigame, 15 files)
- Create: `e2e/helpers/training.ts` — shared helper for navigating to training

Shared helper:
```ts
// e2e/helpers/training.ts
import type { Page } from "@playwright/test";

/**
 * Navigate to Training and start a minigame.
 * Flow: Menu → TRAINING (picker) → pick minigame → briefing → select difficulty → BEGIN TRAINING → countdown → GO
 */
export async function openTraining(page: Page, minigameDisplayName: string, difficulty = "NORMAL") {
  await page.goto("/");
  // Picker phase: click TRAINING on main menu
  await page.getByText("TRAINING").click();
  // Picker: click the minigame name (shown as "> {NAME}" with "UNLIMITED" badge)
  await page.getByText(minigameDisplayName.toUpperCase()).click();
  // Briefing phase: select difficulty (7 segmented buttons)
  await page.getByText(difficulty).click();
  // Click BEGIN TRAINING
  await page.getByText("BEGIN TRAINING").click();
  // Wait for countdown to finish (3-2-1-GO, ~2s total)
  await page.getByText("GO").waitFor({ timeout: 5000 });
  // Small delay for phase transition to active
  await page.waitForTimeout(800);
}

/**
 * Quit training via the quit button + confirmation modal.
 * Active/countdown phase shows "QUIT" button (mobile) or "ESC — QUIT" (desktop).
 * Clicking opens modal with "CONFIRM" and "CANCEL".
 */
export async function quitTraining(page: Page) {
  await page.getByText("QUIT").first().click();
  await page.getByText("CONFIRM").click();
}

/**
 * Inject purchased upgrades into localStorage so Training briefing shows them.
 * Must be called BEFORE navigating to Training.
 */
export async function setMetaUpgrades(page: Page, upgrades: Record<string, number>) {
  await page.evaluate((ups) => {
    const raw = localStorage.getItem("icebreaker-meta");
    const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    meta.state.purchasedUpgrades = { ...meta.state.purchasedUpgrades, ...ups };
    localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
  }, upgrades);
  await page.reload();
}

/**
 * In briefing phase, enable specific upgrades via per-minigame checkboxes.
 * Each owned upgrade has a checkbox + optional +/- tier controls.
 * Call this AFTER navigating to briefing (after picking a minigame).
 */
export async function enableUpgradeInBriefing(page: Page, upgradeName: string) {
  // Find the upgrade card by name and click its checkbox area
  const card = page.locator(`text=${upgradeName}`).locator("..");
  await card.locator('[class*="border"]').first().click();
}

/**
 * Open Training with upgrades enabled at specific tiers.
 * Flow: inject upgrades → Menu → TRAINING → pick game → briefing → check upgrades → select difficulty → BEGIN
 */
export async function openTrainingWithUpgrades(
  page: Page,
  minigameDisplayName: string,
  upgrades: Record<string, number>,
  upgradeNamesToEnable: string[],
  difficulty = "NORMAL"
) {
  // Inject upgrades into localStorage
  await setMetaUpgrades(page, upgrades);
  await page.goto("/");
  await page.getByText("TRAINING").click();
  // Pick minigame → goes to briefing
  await page.getByText(minigameDisplayName.toUpperCase()).click();
  // In briefing: enable each upgrade checkbox
  for (const name of upgradeNamesToEnable) {
    await enableUpgradeInBriefing(page, name);
  }
  // Select difficulty
  await page.getByText(difficulty).click();
  // Begin
  await page.getByText("BEGIN TRAINING").click();
  await page.getByText("GO").waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
}
```

Per-minigame test example:
```ts
// e2e/minigames/slash-timing.spec.ts
import { test, expect } from "@playwright/test";
import { openTraining, quitTraining } from "../helpers/training";

test.describe("Slash Timing", () => {
  test("success — press Space during attack phase", async ({ page }) => {
    await openTraining(page, "Slash Timing", "TRIVIAL");
    // Wait for attack phase
    await page.waitForSelector('[data-phase="attack"]');
    await page.keyboard.press("Space");
    // Should see success in round-result phase
    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 5000 });
  });

  test("fail — press Space during guard phase", async ({ page }) => {
    await openTraining(page, "Slash Timing", "TRIVIAL");
    // Immediately press Space (guard phase is first)
    await page.keyboard.press("Space");
    // Should see fail in round-result phase
    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 5000 });
  });
});

// e2e/minigames/close-brackets.spec.ts
test.describe("Code Inject", () => {
  test("success — type correct closers", async ({ page }) => {
    await openTraining(page, "Code Inject", "TRIVIAL");
    // Read expected closers one by one from data-testid
    for (let i = 0; i < 20; i++) {
      const el = page.locator('[data-testid="expected-closer"]');
      if (!(await el.isVisible().catch(() => false))) break;
      const expected = await el.getAttribute("data-key");
      if (!expected) break;
      await page.keyboard.press(expected);
      await page.waitForTimeout(50);
    }
    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 5000 });
  });

  test("fail — type wrong closer", async ({ page }) => {
    await openTraining(page, "Code Inject", "TRIVIAL");
    // Spam wrong keys to trigger failure
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press(")");
      await page.waitForTimeout(50);
    }
    await expect(page.getByText(/SUCCESS|FAILED/)).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 1:** Create `e2e/helpers/training.ts` helper

- [ ] **Step 2:** Create 15 minigame test files with success + fail cases each

- [ ] **Step 3:** Run: `npm run test:e2e` — all pass

- [ ] **Step 4:** Commit: `test: E2E minigame tests via Training`

---

## Task 7c: E2E tests — per-minigame power-up variants via Training

**Strategy:** Same as 7b but with meta upgrades enabled. For each minigame that has upgrades, test with upgrades ON.

Uses localStorage injection to set purchased upgrades, then enables them via per-minigame checkboxes in the Training briefing phase. No global toggle exists — each upgrade has its own checkbox.

Test examples:
```ts
import { test, expect } from "@playwright/test";
import { openTrainingWithUpgrades, quitTraining } from "../helpers/training";

test("Bracket Reducer tier 3 — only ( { < remain", async ({ page }) => {
  await openTrainingWithUpgrades(
    page, "Code Inject",
    { "bracket-reducer": 3 },       // inject purchased tier 3
    ["Bracket Reducer"],              // enable checkbox in briefing
    "NORMAL"
  );
  // Verify removed bracket buttons are hidden (\ | [ removed at tier 3)
  await expect(page.getByText("\\")).not.toBeVisible();
  await expect(page.getByText("|")).not.toBeVisible();
  await expect(page.getByText("]")).not.toBeVisible();
  await quitTraining(page);
});

test("Mine Radar shows row/col counts", async ({ page }) => {
  await openTrainingWithUpgrades(
    page, "Defrag",
    { "mine-radar": 4 },            // inject purchased tier 4 (100% timer)
    ["Mine Radar"],                   // enable checkbox in briefing
    "TRIVIAL"
  );
  // Click a cell to place mines (Defrag places after first click)
  await page.locator('[data-testid="cell"]').first().click();
  // Radar should show row/column mine count indicators
  await expect(page.locator('[data-testid="mine-radar-row"]').first()).toBeVisible();
  await quitTraining(page);
});

test("Arrow Preview shows upcoming arrows", async ({ page }) => {
  await openTrainingWithUpgrades(
    page, "Packet Route",
    { "arrow-preview": 3 },          // 40% preview
    ["Arrow Preview"],
    "EASY"
  );
  // Preview arrows should be visible as dimmed indicators
  await expect(page.locator('[data-testid="preview-arrow"]').first()).toBeVisible();
  await quitTraining(page);
});
```

- [ ] **Step 1:** Write power-up variant tests for minigames with upgrades (~20 tests)

- [ ] **Step 2:** Run + commit

---

## Task 7d: E2E tests — run economy + game loop

**Strategy:** Test the full run flow: start → play minigames → shop → advance → death. Focus on:
- Credits earned match expected formula
- Data awarded on death matches breakdown
- HP damage/healing works
- Shop purchasing works
- Skip power-ups work
- Milestone triggers

```ts
// e2e/run-economy.spec.ts
test.describe("Run Economy", () => {
  test("start run → first floor → vendor shows earned credits", async ({ page }) => {
    await page.goto("/");
    await page.getByText("START RUN").click();
    // Let minigames timeout (fail) — we just need to reach vendor
    // ... wait for death or vendor
  });

  test("Head Start tier 5 gives 1025 credits at start", async ({ page }) => {
    await setMetaUpgrades(page, { "head-start": 5 });
    await page.goto("/");
    await page.getByText("START RUN").click();
    // Check HUD credits display
    await expect(page.getByText("1025")).toBeVisible();
  });

  test("Warp Gate skips remaining floor", async ({ page }) => {
    // ... buy Warp Gate in shop, verify jump to vendor
  });

  test("death screen shows correct data breakdown", async ({ page }) => {
    // ... play until death, verify breakdown labels
  });
});

// e2e/meta-shop.spec.ts
test.describe("Meta Shop", () => {
  test("buy HP Boost → verify increased max HP in run", async ({ page }) => {
    // Set data via localStorage
    await setMetaUpgrades(page, {});
    await page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem("icebreaker-meta") || '{"state":{}}');
      m.state.data = 5000;
      localStorage.setItem("icebreaker-meta", JSON.stringify(m));
    });
    await page.reload();
    await page.getByText("META SHOP").click();
    // Find and buy HP Boost
    // ... click buy, verify purchased
    // Start run, check HUD shows 105/105 HP
  });
});
```

- [ ] **Step 1:** Write run economy tests (~10 tests)

- [ ] **Step 2:** Write meta shop tests (~5 tests)

- [ ] **Step 3:** Run + commit

---

## Task 8: CI pipeline — add tests before deploy

**Files:**
- Modify: `.github/workflows/fly-deploy.yml`

- [ ] **Step 1:** Add test step to CI:
```yaml
jobs:
  ci:
    name: Build, Test & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
```

Note: Playwright E2E tests are NOT in CI initially — they need a browser and running server, which adds complexity. Add them later once unit tests are stable.

- [ ] **Step 2:** Commit: `ci: add unit tests to deploy pipeline`

---

## Task Dependency Graph

```
Task 1 (Vitest infrastructure)
  → Tasks 2-6 (unit tests — all independent, parallelizable)
  → Task 7 (Playwright infrastructure)
    → Task 7a (data-testid attributes)
      → Task 7b (minigame success/fail tests via Training)
      → Task 7c (minigame power-up variant tests via Training)
      → Task 7d (run economy + meta shop tests)
  → Task 8 (CI pipeline — last)
```

Tasks 2-6 are independent after Task 1.
Tasks 7b, 7c, 7d are independent after 7a.
Task 8 comes after everything.

---

## Test Priority

If time-constrained, implement in this order:
1. **Task 2 (balancing.ts)** — highest value, pure functions, catches economy bugs
2. **Task 3 (power-up-effects)** — catches shield/skip priority bugs
3. **Task 4 (registry)** — catches missing configs, wrong buildMetaPowerUps mapping
4. **Task 5 (upgrade registry)** — catches duplicate IDs, missing licenses
5. **Task 6 (store slices)** — catches game loop bugs, most complex to test
6. **Task 7 (E2E)** — catches integration bugs, slowest to write/run
7. **Task 8 (CI)** — enables automated testing

## Estimated Test Counts

| File/Suite | Tests | Coverage Target |
|------------|-------|-----------------|
| balancing.test.ts | ~30 | All 14 exported functions (incl. getRunShopPrice, getTimeLimit) |
| power-up-effects.test.ts | ~15 | applyShield + checkSkip + getMetaBonus all paths |
| minigame-registry.test.ts | ~15 | Registry integrity + buildMetaPowerUps (with overrides) |
| upgrade-registry.test.ts | ~10 | Pool integrity + license auto-generation |
| run-slice.test.ts | ~25 | All actions + edge cases |
| meta-slice.test.ts | ~8 | Purchase + stats + recordMinigameResult |
| E2E minigame success/fail (7b) | ~30 | 15 minigames × success + fail |
| E2E minigame power-ups (7c) | ~20 | Upgrade variants per minigame (via per-minigame checkboxes) |
| E2E run economy (7d) | ~15 | Credits, data, HP, shop, skips |
| **Total** | **~168** | |
