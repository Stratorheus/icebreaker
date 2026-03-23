# Process Kill Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin Wire Cutting minigame to "Process Kill" — matrix rain streams replacing wire bars, all naming updated.

**Architecture:** Pure visual reskin + text rename. Component rendering changes (wire bars → CSS-animated matrix rain columns). Config/briefing/achievement text updated. Internal IDs unchanged for save compatibility. No mechanic changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, CSS @keyframes animations

**Spec:** `docs/superpowers/specs/2026-03-23-process-kill-redesign.md`

---

## File Structure

```
MODIFY:
  src/components/minigames/WireCutting.tsx    ← visual rendering + text strings
  src/data/minigames/wire-cutting.ts          ← displayName, briefing, upgrade name/desc
  src/data/achievements.ts                    ← wire-ace display text
  docs/minigames/wire-cutting.md              ← documentation
  e2e/minigames/wire-cutting.spec.ts          ← test selectors + display name
  e2e/power-up-variants.spec.ts               ← wire-labels test section
  e2e/minigame-unlock.spec.ts                 ← "Wire Cutting" in hasText
```

---

## Task 1: Update config — displayName, briefing, upgrade

**Files:**
- Modify: `src/data/minigames/wire-cutting.ts`

- [ ] **Step 1:** Read `src/data/minigames/wire-cutting.ts` fully. Update:

```ts
displayName: "Process Kill",
```

- [ ] **Step 2:** Update briefing strings. Replace all "wire"/"cut" references:
- rules: "cut" → "terminate", "wire" → "process"
- controls desktop: "Press number keys (1-9) to terminate processes" (or similar — read current text first)
- controls touch: same pattern
- tips: replace "wire" → "process", "cut" → "terminate"
- hint: same replacements

- [ ] **Step 3:** Update metaUpgrades entry:
```ts
name: "Stream Monitor",
description: "Dims non-target processes and highlights the next process to terminate.",
```

- [ ] **Step 4:** Verify: `npx tsc --noEmit`

- [ ] **Step 5:** Commit: `feat: Process Kill — config rename (displayName, briefing, upgrade)`

---

## Task 2: Update component — matrix rain visuals

**Files:**
- Modify: `src/components/minigames/WireCutting.tsx`

This is the main visual change. Read the FULL component first, then apply changes.

- [ ] **Step 1:** Read `src/components/minigames/WireCutting.tsx` completely.

- [ ] **Step 2:** Update text strings in the component:
- Progress text: `"CUT {n} OF {m} WIRES ({total} total)"` → `"TERMINATED {n} OF {m} PROCESSES ({total} total)"`
- `buildRules()` function: all rule text strings:
  - `"Cut"` → `"Terminate"`
  - `"DO NOT CUT"` → `"DO NOT TERMINATE"`
  - `"cut"` → `"terminate"` in any other patterns
- Keyboard hint text (bottom of component):
  - `"Press the wire number to cut"` → `"Press the process number to terminate"`
  - `"Tap a wire to cut"` → `"Tap a process to terminate"`
- Any other hardcoded "wire"/"cut" text in the render

- [ ] **Step 3:** Replace wire bar rendering with matrix rain streams.

Current wire rendering is a colored div (120px tall bar) with a number below. Replace with:

Each stream element (the div that wraps each wire):
```
- Outer container: width 32px, no side borders
- Top border: 2px solid at 45% stream color opacity
- Bottom border: 2px solid at 25% stream color opacity
- Height: 140px
- overflow: hidden, position: relative
- Inside: 3 absolutely-positioned "rain columns" at left offsets 0, 6, 12px
  - Each column: ~9 span elements with random hex text (2 chars each)
  - CSS animation: @keyframes fall — translateY(-14px) to translateY(140px)
  - Duration: 1.6-3.0s randomized per character
  - Opacity curve: 0→0.8→0.5→0 (3-stop)
  - Color: stream color (from COLOR_CSS map)
```

Killed stream (when `isCut` is true):
```
- Add a CSS class that sets animation-play-state: paused
- Characters turn rgba(255,255,255,0.12)
- Borders turn rgba(255,255,255,0.06) / 0.04
- Number and name labels grey out
- Remove the diagonal "cut line" SVG — just freeze + grey
```

Next target (when `hasWireOrderHint && i === nextWireIndex`):
```
- box-shadow: 0 0 18px {stream color} on the stream box
- Other streams get opacity: 0.35 (existing isDimmed behavior)
- Keyboard hint <kbd> for next target: use dynamic stream color instead of hardcoded cyber-green
```

Hover state:
```
- Top/bottom borders brighten to rgba(255,255,255,0.4) / 0.3
```

- [ ] **Step 4:** Add `useEffect` for character mutation interval:
```ts
useEffect(() => {
  const interval = setInterval(() => {
    // Randomly change ~12% of visible rain characters every 150ms
    // Only mutate characters in non-killed streams
  }, 150);
  return () => clearInterval(interval);
}, []);
```

Use refs to store rain character elements, mutate textContent directly (avoid re-render).

- [ ] **Step 5:** Update `data-testid="wire"` → `data-testid="stream"` on stream elements. Keep `data-index` and `data-next` unchanged.

- [ ] **Step 6:** Verify: `npx tsc --noEmit` + `npm run build`

- [ ] **Step 7:** Commit: `feat: Process Kill — matrix rain stream visuals`

---

## Task 3: Update achievements + docs

**Files:**
- Modify: `src/data/achievements.ts`
- Modify: `docs/minigames/wire-cutting.md`

- [ ] **Step 1:** In `src/data/achievements.ts`, find `wire-ace` achievement. Update:
```ts
name: "Process Killer",
description: "Win Process Kill 6 times in a row.",
```
Keep `id: "wire-ace"` unchanged.

- [ ] **Step 2:** In `docs/minigames/wire-cutting.md`, replace all:
- "Wire Cutting" → "Process Kill"
- "wire" → "process" / "stream" (context-dependent)
- "cut" → "terminate"
- "Wire Guide" → "Stream Monitor"

- [ ] **Step 3:** Verify: `npx tsc --noEmit`

- [ ] **Step 4:** Commit: `feat: Process Kill — achievement + docs rename`

---

## Task 4: Update E2E tests

**Files:**
- Modify: `e2e/minigames/wire-cutting.spec.ts`
- Modify: `e2e/power-up-variants.spec.ts`
- Modify: `e2e/minigame-unlock.spec.ts`

- [ ] **Step 1:** In `e2e/minigames/wire-cutting.spec.ts`:
- Update display name: `"Wire Cutting"` → `"Process Kill"` in `openTraining` calls
- Update selectors: `[data-testid="wire"]` → `[data-testid="stream"]`
- Keep `[data-next="true"]` / `[data-next="false"]` unchanged
- Update test description strings

- [ ] **Step 2:** In `e2e/power-up-variants.spec.ts`:
- Find the `wire-labels` test section
- Update display name in `goToBriefing`: `"Wire Cutting"` → `"Process Kill"`
- Update selectors: `[data-testid="wire"]` → `[data-testid="stream"]`
- Update test description if it says "Wire Cutting"

- [ ] **Step 3:** In `e2e/minigame-unlock.spec.ts`:
- Search for `"Wire Cutting"` in `hasText` locators → `"Process Kill"`

- [ ] **Step 4:** Run unit tests: `npm test` — all 434 pass

- [ ] **Step 5:** Verify build: `npm run build`

- [ ] **Step 6:** Run E2E tests: `npx playwright test` — all pass (if dev server available; otherwise verify on PR pipeline)

- [ ] **Step 7:** Commit: `feat: Process Kill — E2E test selector + name updates`

---

## Task 5: Manual verification + final commit

- [ ] **Step 1:** Run `npm run build` — clean

- [ ] **Step 2:** Run `npm test` — 434 pass

- [ ] **Step 3:** Visual check list (if dev server available):
- Training → pick Process Kill → briefing shows "TERMINATION RULES"
- Play → see matrix rain streams with colored hex characters
- Terminate correct process → stream freezes + greys out
- Progress shows "TERMINATED X OF Y PROCESSES"
- Meta Shop → "Stream Monitor" upgrade name + description
- Codex → briefing shows updated text

- [ ] **Step 4:** Commit: `feat: Process Kill redesign complete`

---

## Task Dependency Graph

```
Task 1 (config rename)
  → Task 2 (visual rendering — main work)
  → Task 3 (achievements + docs)
  → Task 4 (E2E tests)
    → Task 5 (verification)
```

Tasks 1, 2, 3 can start independently. Task 4 depends on Task 2 (selector rename). Task 5 is last. Recommended order: 1 → 2 → 3 → 4 → 5 (sequential, simplest).
