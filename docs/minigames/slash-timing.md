# Slash Timing (`slash-timing`)

## Player Guide

A large central indicator cycles through three phases: GUARD (cyan), PREPARE (orange), and ATTACK (green). You must press Space (or tap on mobile) only during the green ATTACK phase. Pressing during GUARD or PREPARE causes immediate failure. If you miss the ATTACK window entirely, the cycle restarts from GUARD and you get another chance. The overall timer is always running -- if it expires, you fail.

## Mechanic

**Phase cycle:**

1. **GUARD** -- duration is randomized between `guardMinDuration` and `guardMaxDuration`. Player must NOT press.
2. **PREPARE** -- fixed duration of `prepareDuration`. Visual warning (orange pulse). Player must NOT press.
3. **ATTACK** -- window of `attackWindow` ms. Player must press during this window.

If the player does not press during ATTACK, the cycle loops back to GUARD with a new random guard duration.

**Resolution:**
- Press during ATTACK phase: **immediate success** via `complete(true)`.
- Press during GUARD or PREPARE: **immediate failure** via `fail()`.
- Timer expiration: **failure** (handled by `useMinigame` hook).

**Scoring:** Binary pass/fail. Speed bonus from remaining timer fraction.

## Difficulty Scaling

| Parameter | d=0 | d=0.5 | d=1.0 | Formula |
|-----------|-----|-------|-------|---------|
| Attack window (ms) | 800 | 550 | 300 | `800 - d * 500` |
| Prepare duration (ms) | 500 | 350 | 200 | `500 - d * 300` |
| Guard min duration (ms) | 1000 | 800 | 600 | `1000 - d * 400` |
| Guard max duration (ms) | 2000 | 1600 | 1200 | `2000 - d * 800` |

The attack window is further modified by window-extend bonuses:
`effectiveAttackWindow = baseAttackWindow * (1 + windowExtendBonus)`

Where `windowExtendBonus` is the sum of all `window-extend` effect values from active power-ups.

## Power-Up Support

| Power-Up | Source | Effect Type | Behaviour |
|----------|--------|-------------|-----------|
| **Slash Window** (`slash-window`) | Meta upgrade | `window-extend` | Attack window widened by 25% (`value: 0.25`). |
| **Delay Injector** (`delay-injector`) | Meta upgrade (global) | `global-time-bonus` | Time limit multiplied by `1.03^tier`. |
| **Difficulty Reducer** (`difficulty-reducer`) | Meta upgrade (global) | `difficulty-reduction` | Effective difficulty multiplied by `0.95^tier`. |

Only the meta Slash Window remains: `effectiveAttackWindow = base * (1 + 0.25) = base * 1.25`.

## Controls

### Desktop

- **Space** -- strike (press during the green ATTACK phase).

### Mobile

- **Tap anywhere** on the central indicator area to strike.

## Base Time Limit

**8 seconds.**

Scaling formula: `round(8 * (1 - difficulty * 0.4) * floorScale * 1.03^timerExtTier)`

Where `floorScale = max(0.4, 1 - (floor - 15) * 0.02)` for floors > 15, otherwise 1.

Additional timing modifiers that affect the effective timer:
- **Time Siphon** (run shop): +0.2 s per consecutive win (floor-scoped, resets on fail).
- **Cascade Clock** (meta upgrade): +2% of base timer per consecutive win (cap per tier, resets on fail, persists across floors).
- **Deadline Override** (run shop): injects +1 s when timer drops below 5% (single use).
- **Time-bonus** power-ups: flat seconds added by `useMinigame` hook on mount.

## Code Reference

**Component path:** `src/components/minigames/SlashTiming.tsx`

**Key functions:**
- `startGuard()` -- initiates the GUARD -> PREPARE -> ATTACK -> (loop) cycle using nested `setTimeout` chains.
- `handleSpace()` -- reads `phaseRef.current` and resolves success or failure.
- `getGuardDuration()` -- returns random value in `[guardMinDuration, guardMaxDuration]`.

**State variables:**
- `phase: "guard" | "prepare" | "attack"` -- current cycle phase.
- `phaseRef: Ref<Phase>` -- mutable ref for synchronous reads inside callbacks.
- `resolvedRef: Ref<boolean>` -- prevents double-resolution.
- `timeoutRef: Ref<Timeout>` -- holds the current phase transition timeout for cleanup.
- `windowExtendBonus: number` -- computed sum of all window-extend effects.

## Tuning Guide

| What to change | Where | Notes |
|----------------|-------|-------|
| Attack window range | Lines 37, 39: `800 - d * 500` and `* (1 + bonus)` | Decrease 800 or increase 500 for harder base |
| Prepare duration range | Line 40: `500 - d * 300` | Shorter prepare = less warning |
| Guard duration range | Lines 41-42 | Narrower range = more predictable timing |
| Meta window-extend value | `meta-upgrades.ts` `slash-window`, `value: 0.25` | Percentage added to attack window |
| Meta window-extend value | `meta-upgrades.ts` `slash-window`, `value: 0.25` | Percentage added to attack window |
| Phase visuals | `phaseConfig` object (lines 130-161) | Colors, labels, icons, animations per phase |
