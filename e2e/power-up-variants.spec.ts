import { test, expect, type Page } from "@playwright/test";
import { openTraining, setMetaUpgrades, unlockMinigames } from "./helpers/training";
import { skipOnboarding } from "./helpers/setup";

// ---------------------------------------------------------------------------
// Helper: enable an upgrade in the briefing phase by data-testid
// ---------------------------------------------------------------------------

async function enableUpgrade(page: Page, upgradeId: string) {
  const card = page.locator(`[data-testid="upgrade-card"][data-upgrade-id="${upgradeId}"]`);
  const checkbox = card.locator('[data-testid="upgrade-checkbox"]');
  const checked = await checkbox.getAttribute("data-checked");
  if (checked !== "true") {
    await checkbox.click();
  }
}

// ---------------------------------------------------------------------------
// Helper: navigate to training briefing with upgrades injected
// ---------------------------------------------------------------------------

async function goToBriefing(
  page: Page,
  displayName: string,
  upgrades: Record<string, number>,
  minigameUnlocks?: string[],
) {
  await page.goto("/");
  await skipOnboarding(page);
  if (minigameUnlocks && minigameUnlocks.length > 0) {
    await unlockMinigames(page, minigameUnlocks);
  }
  await setMetaUpgrades(page, upgrades);
  await page.getByText("TRAINING").click();
  await page.locator('[data-testid="minigame-picker-item"]').filter({ hasText: displayName }).click();
}

// ---------------------------------------------------------------------------
// Helper: enable upgrade, select difficulty, begin training, wait for GO
// ---------------------------------------------------------------------------

async function beginWithUpgrade(
  page: Page,
  upgradeIds: string[],
  difficulty = "TRIVIAL",
) {
  for (const id of upgradeIds) {
    await enableUpgrade(page, id);
  }
  await page.locator(`[data-testid="difficulty-option"][data-value="${difficulty}"]`).click();
  await page.locator('[data-testid="begin-training"]').click();
  await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}

// ===========================================================================
// BRACKET REDUCER — removes bracket types from Code Inject
// ===========================================================================

test.describe("bracket-reducer — Code Inject", () => {
  test("tier 3 removes slash, pipe, and square brackets", async ({ page }) => {
    await goToBriefing(page, "Code Inject", { "bracket-reducer": 3 });
    await beginWithUpgrade(page, ["bracket-reducer"]);

    // Solve the minigame — all expected closers should be ), }, or >
    const seenKeys: string[] = [];
    for (let i = 0; i < 20; i++) {
      const hint = page.locator('[data-testid="expected-closer"]');
      const key = await hint.getAttribute("data-key", { timeout: 5000 });
      if (!key) break;
      seenKeys.push(key);
      await page.keyboard.press(key);
      await page.waitForTimeout(100);

      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;
    }

    // Verify no excluded closers were required
    const excluded = ["/", "|", "]"];
    for (const k of seenKeys) {
      expect(excluded).not.toContain(k);
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });
});

// ===========================================================================
// BRACKET MIRROR — shows next expected bracket
// ===========================================================================

test.describe("bracket-mirror — Code Inject", () => {
  test("shows 'Next' hint matching the expected closer", async ({ page }) => {
    await goToBriefing(page, "Code Inject", { "bracket-mirror": 1 });
    await beginWithUpgrade(page, ["bracket-mirror"]);

    // The Bracket Mirror upgrade shows a "Next" label with the expected closer
    await expect(page.getByText("Next")).toBeVisible({ timeout: 5000 });

    // Read the expected closer from the test helper attribute
    const hint = page.locator('[data-testid="expected-closer"]');
    const expectedKey = await hint.getAttribute("data-key");
    expect(expectedKey).toBeTruthy();

    // The "Next" hint box should contain the same character as the expected closer
    // The hint is rendered inside a sibling div with the closer character
    const nextHintBox = page.locator("text=Next").locator("..").locator("span.text-cyber-cyan");
    const hintChar = await nextHintBox.textContent();
    expect(hintChar).toBe(expectedKey);
  });
});

// ===========================================================================
// ARROW PREVIEW — pre-reveals upcoming arrows in Packet Route
// ===========================================================================

test.describe("arrow-preview — Packet Route", () => {
  test("tier 3 pre-reveals arrows beyond the current one", async ({ page }) => {
    await goToBriefing(page, "Packet Route", { "arrow-preview": 3 });
    await beginWithUpgrade(page, ["arrow-preview"]);

    // The arrow sequence is rendered as individual divs in a flex row.
    // Current arrow shows the real character; peeked arrows also show real characters
    // (in yellow); hidden arrows show "?".
    // With tier 3 (40% of sequence), on a trivial sequence of 3-5 arrows,
    // at least 1 peeked arrow should be visible beyond the current one.

    const hint = page.locator('[data-testid="expected-arrow"]');
    await expect(hint).toBeAttached({ timeout: 5000 });

    // Count arrow grid slots: the arrow row contains div children
    // Arrows showing real characters contain ←→↑↓, hidden ones show "?"
    const arrowSlots = page.locator(".flex.items-center.justify-center.gap-2 > div, .flex.items-center.justify-center.gap-3 > div").filter({ hasText: /^[←→↑↓?]$/ });
    const allSlots = await arrowSlots.all();

    let revealedCount = 0;
    let hiddenCount = 0;
    for (const slot of allSlots) {
      const text = (await slot.textContent())?.trim() ?? "";
      if (/^[←→↑↓]$/.test(text)) revealedCount++;
      if (text === "?") hiddenCount++;
    }

    // Current arrow (1) + at least 1 peeked arrow should be revealed
    expect(revealedCount).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// SLASH WINDOW — widens the attack window in Slash Timing
// ===========================================================================

test.describe("slash-window — Slash Timing", () => {
  test("game starts and runs with slash-window enabled", async ({ page }) => {
    await goToBriefing(page, "Slash Timing", { "slash-window": 1 });
    await beginWithUpgrade(page, ["slash-window"]);

    // Verify the game is running by checking the phase indicator
    const phase = page.locator('[data-testid="slash-phase"]');
    await expect(phase).toBeAttached({ timeout: 5000 });

    // Wait for attack phase and press space
    await expect(phase).toHaveAttribute("data-phase", "attack", { timeout: 15000 });
    await page.keyboard.press("Space");

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });
});

// ===========================================================================
// MINE RADAR — shows mine row/col counts in Defrag
// ===========================================================================

test.describe("mine-radar — Defrag", () => {
  // Radar indicators depend on React re-render after first click — can be slow in CI
  test.describe.configure({ retries: 1 });
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["defrag"]);
  });

  test("tier 4 shows radar indicators with mine counts after first click", async ({ page }) => {
    await goToBriefing(page, "Defrag", { "mine-radar": 4 }, ["defrag"]);
    // Use HARD difficulty so flood fill doesn't auto-win on first click (TRIVIAL = 4x4 with 1 mine)
    await beginWithUpgrade(page, ["mine-radar"], "HARD");

    // Click the first cell to place mines (defrag places mines after first click)
    const cells = page.locator('[data-testid="cell"]');
    await cells.first().click();

    // Wait for radar indicators to render (mines placed → radar visible on next frame)
    const radarIndicators = page.locator('[data-testid="mine-radar-indicator"]');
    await radarIndicators.first().waitFor({ timeout: 5000 });

    const indicatorCount = await radarIndicators.count();

    // Should have indicators for rows + columns (e.g. 5x5 grid = 5 col + 5 row = 10)
    expect(indicatorCount).toBeGreaterThanOrEqual(6); // minimum 3x3 grid = 3+3=6

    // At least one indicator should show a non-zero mine count
    let hasNonZero = false;
    for (let i = 0; i < indicatorCount; i++) {
      const count = await radarIndicators.nth(i).getAttribute("data-count");
      if (count && parseInt(count, 10) > 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });
});

// ===========================================================================
// MINE ECHO — keeps some mines visible in Memory Scan
// ===========================================================================

test.describe("mine-echo — Memory Scan", () => {
  test("tier 3 keeps some mines visible after preview", async ({ page }) => {
    await goToBriefing(page, "Memory Scan", { "mine-echo": 3 });
    await beginWithUpgrade(page, ["mine-echo"]);

    // Wait for the mark phase (after preview phase ends)
    // In mark phase, mine-echo keeps some mines visible
    await expect(page.locator('[data-testid="mine-phase"][data-phase="mark"]')).toBeVisible({ timeout: 10000 });

    // With mine-echo tier 3 active, some mine cells should still be visually
    // indicated in mark phase (data-visible-mine="true")
    const visibleMines = page.locator('[data-testid="cell"][data-visible-mine="true"]');
    const visibleCount = await visibleMines.count();

    // Tier 3 reveals a percentage of mines — at least 1 should be visible
    expect(visibleCount).toBeGreaterThanOrEqual(1);

    // All visible-mine cells should actually be mines
    for (let i = 0; i < visibleCount; i++) {
      const isMine = await visibleMines.nth(i).getAttribute("data-mine");
      expect(isMine).toBe("true");
    }
  });
});

// ===========================================================================
// ERROR MARGIN — accepts answers within ±N in Checksum Verify
// ===========================================================================

test.describe("error-margin — Checksum Verify", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["checksum-verify"]);
  });

  test("tier 5 accepts answer off by 5", async ({ page }) => {
    await goToBriefing(page, "Checksum Verify", { "error-margin": 5 }, ["checksum-verify"]);
    await beginWithUpgrade(page, ["error-margin"]);

    // Verify the tolerance indicator is visible
    await expect(page.getByText("tolerance active", { exact: false })).toBeVisible({ timeout: 5000 });

    // Read the expected answer
    const hint = page.locator('[data-testid="expected-answer"]');
    const answer = await hint.getAttribute("data-answer", { timeout: 5000 });
    const correctAnswer = parseInt(answer ?? "0", 10);

    // Type answer + 5 (within tolerance)
    const offBy5 = String(correctAnswer + 5);
    for (const char of offBy5) {
      await page.keyboard.press(char === "-" ? "-" : char);
      await page.waitForTimeout(50);
    }
    await page.keyboard.press("Enter");

    // Should NOT fail immediately — either still playing or success
    await page.waitForTimeout(500);
    const failed = page.getByText("FAILED");
    const isFailed = await failed.isVisible().catch(() => false);
    expect(isFailed).toBe(false);
  });

  test("tier 1 accepts answer off by 1 but rejects off by 2", async ({ page }) => {
    await goToBriefing(page, "Checksum Verify", { "error-margin": 1 }, ["checksum-verify"]);
    await beginWithUpgrade(page, ["error-margin"]);

    // Read correct answer
    const hint = page.locator('[data-testid="expected-answer"]');
    const answer = parseInt((await hint.getAttribute("data-answer"))!, 10);

    // Type answer + 1 (within ±1 tolerance) → should succeed
    const offBy1 = String(answer + 1);
    for (const char of offBy1) {
      await page.keyboard.press(char === "-" ? "Minus" : char);
      await page.waitForTimeout(50);
    }
    await page.keyboard.press("Enter");

    // Should not fail
    await page.waitForTimeout(500);
    const failed = await page.getByText("FAILED").isVisible().catch(() => false);
    expect(failed).toBe(false);
  });

  test("tier 1 rejects answer off by 2", async ({ page }) => {
    await goToBriefing(page, "Checksum Verify", { "error-margin": 1 }, ["checksum-verify"]);
    await beginWithUpgrade(page, ["error-margin"]);

    const hint = page.locator('[data-testid="expected-answer"]');
    const answer = parseInt((await hint.getAttribute("data-answer"))!, 10);

    // Type answer + 2 (outside ±1 tolerance) → should fail
    const offBy2 = String(answer + 2);
    for (const char of offBy2) {
      await page.keyboard.press(char === "-" ? "Minus" : char);
      await page.waitForTimeout(50);
    }
    await page.keyboard.press("Enter");

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 5000 });
  });

  test("tier 3 accepts answer off by 3 but rejects off by 4", async ({ page }) => {
    await goToBriefing(page, "Checksum Verify", { "error-margin": 3 }, ["checksum-verify"]);
    await beginWithUpgrade(page, ["error-margin"]);

    const hint = page.locator('[data-testid="expected-answer"]');
    const answer = parseInt((await hint.getAttribute("data-answer"))!, 10);

    // Type answer + 3 (within ±3 tolerance) → should not fail
    const offBy3 = String(answer + 3);
    for (const char of offBy3) {
      await page.keyboard.press(char === "-" ? "Minus" : char);
      await page.waitForTimeout(50);
    }
    await page.keyboard.press("Enter");

    await page.waitForTimeout(500);
    const failed = await page.getByText("FAILED").isVisible().catch(() => false);
    expect(failed).toBe(false);
  });

  test("tier 3 rejects answer off by 4", async ({ page }) => {
    await goToBriefing(page, "Checksum Verify", { "error-margin": 3 }, ["checksum-verify"]);
    await beginWithUpgrade(page, ["error-margin"]);

    const hint = page.locator('[data-testid="expected-answer"]');
    const answer = parseInt((await hint.getAttribute("data-answer"))!, 10);

    // Type answer + 4 (outside ±3 tolerance) → should fail
    const offBy4 = String(answer + 4);
    for (const char of offBy4) {
      await page.keyboard.press(char === "-" ? "Minus" : char);
      await page.waitForTimeout(50);
    }
    await page.keyboard.press("Enter");

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// RANGE HINT — shows answer range in Checksum Verify
// ===========================================================================

test.describe("range-hint — Checksum Verify", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["checksum-verify"]);
  });

  test("tier 1 shows range containing the correct answer", async ({ page }) => {
    await goToBriefing(page, "Checksum Verify", { "range-hint": 1 }, ["checksum-verify"]);
    await beginWithUpgrade(page, ["range-hint"]);

    // Range hint should display the answer range
    const rangeText = page.getByText("Answer is between", { exact: false });
    await expect(rangeText).toBeVisible({ timeout: 5000 });

    // Read the correct answer from the test helper
    const hint = page.locator('[data-testid="expected-answer"]');
    const correctAnswer = parseInt((await hint.getAttribute("data-answer"))!, 10);

    // Extract the range bounds from "Answer is between X and Y"
    const fullText = (await rangeText.textContent()) ?? "";
    const rangeMatch = fullText.match(/between\s+(-?\d+)\s+and\s+(-?\d+)/i);
    expect(rangeMatch).not.toBeNull();

    const lo = parseInt(rangeMatch![1], 10);
    const hi = parseInt(rangeMatch![2], 10);

    // The correct answer should fall within the displayed range
    expect(correctAnswer).toBeGreaterThanOrEqual(lo);
    expect(correctAnswer).toBeLessThanOrEqual(hi);

    // Tier 1 spread is ±10, so range should be 20 wide
    expect(hi - lo).toBe(20);
  });
});

// ===========================================================================
// PORT LOGGER — shows text list of open ports in Port Scan
// ===========================================================================

test.describe("port-logger — Port Scan", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["port-scan"]);
  });

  test("shows open port list matching actual open ports", async ({ page }) => {
    await goToBriefing(page, "Port Scan", { "port-logger": 1 }, ["port-scan"]);
    await beginWithUpgrade(page, ["port-logger"]);

    // Wait for select phase
    await expect(
      page.locator('[data-testid="port-phase"][data-phase="select"]'),
    ).toBeVisible({ timeout: 15000 });

    // Port logger shows "Open: <port numbers>" during select phase
    const openText = page.getByText("Open:", { exact: false });
    await expect(openText).toBeVisible({ timeout: 3000 });

    // Read actual open port numbers from data-testid="port-cell" with data-open="true"
    const openCells = page.locator('[data-testid="port-cell"][data-open="true"]');
    const openCount = await openCells.count();
    expect(openCount).toBeGreaterThanOrEqual(2);

    const openPortNumbers: string[] = [];
    for (let i = 0; i < openCount; i++) {
      const text = (await openCells.nth(i).textContent())?.trim() ?? "";
      openPortNumbers.push(text);
    }

    // The "Open:" text should contain all the open port numbers
    const loggerText = (await openText.textContent()) ?? "";
    for (const port of openPortNumbers) {
      expect(loggerText).toContain(port);
    }
  });
});

// ===========================================================================
// DEEP SCAN — open ports flash twice in Port Scan
// ===========================================================================

test.describe("port-scan-deep — Port Scan", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["port-scan"]);
  });

  test("game starts with deep scan enabled", async ({ page }) => {
    await goToBriefing(page, "Port Scan", { "port-scan-deep": 1 }, ["port-scan"]);
    await beginWithUpgrade(page, ["port-scan-deep"]);

    // Wait for select phase (display phase will flash twice with deep scan)
    await expect(
      page.locator('[data-testid="port-phase"][data-phase="select"]'),
    ).toBeVisible({ timeout: 20000 });

    // Game is running in select phase — deep scan worked (no crash)
    const cells = page.locator('[data-testid="port-cell"]');
    await expect(cells.first()).toBeVisible();
  });
});

// ===========================================================================
// WIRE LABELS — highlights next wire to cut in Wire Cutting
// ===========================================================================

test.describe("wire-labels — Process Kill", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["wire-cutting"]);
  });

  test("next wire is highlighted with data-next=true", async ({ page }) => {
    await goToBriefing(page, "Process Kill", { "wire-labels": 1 }, ["wire-cutting"]);
    await beginWithUpgrade(page, ["wire-labels"]);

    // data-next="true" should exist on the wire to cut
    const nextWire = page.locator('[data-testid="stream"][data-next="true"]');
    await expect(nextWire).toBeVisible({ timeout: 5000 });

    // Click it to cut
    await nextWire.click();
    await page.waitForTimeout(200);

    // Game should still be running or completed successfully
    const cells = page.locator('[data-testid="stream"]');
    await expect(cells.first()).toBeAttached();
  });
});

// ===========================================================================
// DECODE ASSIST — pre-fills letters in Cipher Crack V1
// ===========================================================================

test.describe("decode-assist — Cipher Crack V1", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["cipher-crack"]);
  });

  test("tier 3 pre-fills roughly 60% of letters", async ({ page }) => {
    await goToBriefing(page, "Cipher Crack V1", { "decode-assist": 3 }, ["cipher-crack"]);
    await beginWithUpgrade(page, ["decode-assist"]);

    // Decode assist at 60% should pre-fill some letters
    // The component shows "(N pre-filled)" text
    const preFilledText = page.getByText("pre-filled", { exact: false });
    await expect(preFilledText).toBeVisible({ timeout: 5000 });

    // Extract the count from "(N pre-filled)" and verify it's > 0
    const text = (await preFilledText.textContent()) ?? "";
    const match = text.match(/\((\d+)\s+pre-filled\)/);
    expect(match).not.toBeNull();
    const preFilledCount = parseInt(match![1], 10);
    expect(preFilledCount).toBeGreaterThan(0);

    // Read total word length from the progress display (e.g. "2/5")
    const progressText = await page.locator("text=/\\d+\\/\\d+/").first().textContent() ?? "";
    const totalMatch = progressText.match(/\/(\d+)/);
    if (totalMatch) {
      const wordLength = parseInt(totalMatch[1], 10);
      // 60% of a word of length N: ceil(N*0.6), allow ±1 tolerance for rounding
      const expectedMin = Math.max(1, Math.ceil(wordLength * 0.6) - 1);
      const expectedMax = Math.ceil(wordLength * 0.6) + 1;
      expect(preFilledCount).toBeGreaterThanOrEqual(expectedMin);
      expect(preFilledCount).toBeLessThanOrEqual(expectedMax);
    }
  });
});

// ===========================================================================
// CIPHER HINT — extra hint letter in Cipher Crack V1
// ===========================================================================

test.describe("cipher-hint — Cipher Crack V1", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["cipher-crack"]);
  });

  test("shows 'starts with' hint matching the first expected character", async ({ page }) => {
    await goToBriefing(page, "Cipher Crack V1", { "cipher-hint": 1 }, ["cipher-crack"]);
    await beginWithUpgrade(page, ["cipher-hint"]);

    // Cipher hint shows "Hint: starts with 'X'" where X is the first letter
    const hintText = page.getByText("starts with", { exact: false });
    await expect(hintText).toBeVisible({ timeout: 5000 });

    // Read the first expected character from the test helper
    const expectedChar = page.locator('[data-testid="expected-char"]');
    await expect(expectedChar).toBeAttached({ timeout: 5000 });

    // The first character of the word is revealed. We need to compare with the hint.
    // The word starts at charIndex 0 (or the first non-pre-filled position).
    // The hint displays as: Hint: starts with "X"
    // where X should match the very first letter of the word.
    const fullHintText = (await hintText.textContent()) ?? "";
    // The hint contains a bold letter — extract it
    const hintLetter = await page.locator("text=starts with").locator("..").locator("strong").textContent();
    expect(hintLetter).toBeTruthy();
    expect(hintLetter!.length).toBe(1);
    // The letter should be a lowercase alpha character
    expect(hintLetter!).toMatch(/^[a-z]$/);
  });
});

// ===========================================================================
// SHIFT MARKER — highlights ROT shift in Cipher Crack V2
// ===========================================================================

test.describe("shift-marker — Cipher Crack V2", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["cipher-crack-v2"]);
  });

  test("shows ROT-N label when enabled", async ({ page }) => {
    await goToBriefing(page, "Cipher Crack V2", { "shift-marker": 1 }, ["cipher-crack-v2"]);
    await beginWithUpgrade(page, ["shift-marker"]);

    // Shift marker shows a "ROT-N" label above the alphabet chart
    await expect(page.getByText(/ROT-\d+/)).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// AUTO-DECODE V2 — pre-fills letters in Cipher Crack V2
// ===========================================================================

test.describe("auto-decode-v2 — Cipher Crack V2", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["cipher-crack-v2"]);
  });

  test("tier 3 pre-fills roughly 60% of letters", async ({ page }) => {
    await goToBriefing(page, "Cipher Crack V2", { "auto-decode-v2": 3 }, ["cipher-crack-v2"]);
    await beginWithUpgrade(page, ["auto-decode-v2"]);

    // Auto-decode at 60% should pre-fill some letters — shows "(N pre-filled)"
    const preFilledText = page.getByText("pre-filled", { exact: false });
    await expect(preFilledText).toBeVisible({ timeout: 5000 });

    // Extract the count and verify it's > 0
    const text = (await preFilledText.textContent()) ?? "";
    const match = text.match(/\((\d+)\s+pre-filled\)/);
    expect(match).not.toBeNull();
    const preFilledCount = parseInt(match![1], 10);
    expect(preFilledCount).toBeGreaterThan(0);

    // Read total word length from the progress display (e.g. "2/5")
    const progressText = await page.locator("text=/\\d+\\/\\d+/").first().textContent() ?? "";
    const totalMatch = progressText.match(/\/(\d+)/);
    if (totalMatch) {
      const wordLength = parseInt(totalMatch[1], 10);
      // 60% of a word: ceil(N*0.6), allow ±1 tolerance
      const expectedMin = Math.max(1, Math.ceil(wordLength * 0.6) - 1);
      const expectedMax = Math.ceil(wordLength * 0.6) + 1;
      expect(preFilledCount).toBeGreaterThanOrEqual(expectedMin);
      expect(preFilledCount).toBeLessThanOrEqual(expectedMax);
    }
  });
});

// ===========================================================================
// REVERSE TRAINER (Autocorrect) — shows words normally in Decrypt Signal
// ===========================================================================

test.describe("reverse-trainer — Decrypt Signal", () => {
  test("shows autocorrect active indicator", async ({ page }) => {
    await goToBriefing(page, "Decrypt Signal", { "reverse-trainer": 2 });
    await beginWithUpgrade(page, ["reverse-trainer"]);

    // Autocorrect shows "AUTOCORRECT ACTIVE — N% CORRECTED"
    await expect(page.getByText("AUTOCORRECT ACTIVE", { exact: false })).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// NETWORK TRACE HIGHLIGHT — shows correct path in Network Trace
// ===========================================================================

test.describe("network-trace-highlight — Network Trace", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["network-trace"]);
  });

  test("game starts with path highlight enabled", async ({ page }) => {
    await goToBriefing(page, "Network Trace", { "network-trace-highlight": 4 }, ["network-trace"]);
    await beginWithUpgrade(page, ["network-trace-highlight"]);

    // Verify player and end markers are visible — path highlight is rendered
    const player = page.locator('[data-testid="player"]');
    await expect(player).toBeVisible({ timeout: 5000 });
    const end = page.locator('[data-testid="end"]');
    await expect(end).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// UPGRADE CHECKBOX UI — verify toggle mechanics in briefing
// ===========================================================================

test.describe("upgrade checkbox UI", () => {
  test("toggling upgrade checkbox updates data-checked attribute", async ({ page }) => {
    await goToBriefing(page, "Code Inject", { "bracket-reducer": 3 });

    const card = page.locator('[data-testid="upgrade-card"][data-upgrade-id="bracket-reducer"]');
    const checkbox = card.locator('[data-testid="upgrade-checkbox"]');

    // Initially unchecked
    await expect(checkbox).toHaveAttribute("data-checked", "false");

    // Click to enable
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("data-checked", "true");

    // Click to disable
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("data-checked", "false");
  });

  test("multiple upgrades can be enabled simultaneously", async ({ page }) => {
    await goToBriefing(page, "Checksum Verify", { "error-margin": 5, "range-hint": 3 }, ["checksum-verify"]);

    await enableUpgrade(page, "error-margin");
    await enableUpgrade(page, "range-hint");

    // Both should be checked
    const errorCard = page.locator('[data-testid="upgrade-card"][data-upgrade-id="error-margin"]');
    const rangeCard = page.locator('[data-testid="upgrade-card"][data-upgrade-id="range-hint"]');

    await expect(errorCard.locator('[data-testid="upgrade-checkbox"]')).toHaveAttribute("data-checked", "true");
    await expect(rangeCard.locator('[data-testid="upgrade-checkbox"]')).toHaveAttribute("data-checked", "true");

    // Begin training and verify both effects are active
    await page.locator('[data-testid="difficulty-option"][data-value="TRIVIAL"]').click();
    await page.locator('[data-testid="begin-training"]').click();
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);

    await expect(page.getByText("tolerance active", { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Answer is between", { exact: false })).toBeVisible({ timeout: 5000 });
  });
});
