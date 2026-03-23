import type { StateCreator } from "zustand";
import type { GameStatus, MinigameType, PowerUpInstance, TrainingOrigin } from "@/types/game";
import { STARTING_MINIGAMES } from "@/data/minigames/registry";
import type { MinigameResult } from "@/types/minigame";
import { getDataDrip, getEffectiveCredits, getEffectiveDamage, getEffectiveDifficulty, getMilestoneBonus, getMinigamesPerFloor, getStartingCredits } from "@/data/balancing";
import { applyShield } from "@/lib/power-up-effects";
import { META_UPGRADE_POOL } from "@/data/upgrades/registry";
import type { MetaSlice } from "./meta-slice";
import type { ShopSlice } from "./shop-slice";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunSlice {
  // State
  hp: number;
  maxHp: number;
  floor: number;
  currentMinigameIndex: number;
  floorMinigames: MinigameType[];
  inventory: PowerUpInstance[];
  credits: number;
  runScore: number;
  status: GameStatus;
  runStartTime: number;
  floorDamageTaken: boolean;
  runDamageTaken: boolean;
  minigamesWonThisRun: number;
  minigamesPlayedThisRun: number;
  powerUpsUsedThisFloor: boolean;
  trainingMinigame: MinigameType | null;
  trainingOrigin: TrainingOrigin;
  /** Set to a milestone floor number (every 5th floor) to trigger the overlay; 0 = no milestone. */
  milestoneFloor: number;
  /** Tracks the status before entering pause, so we can resume to the correct screen. */
  previousStatus: GameStatus | null;
  /** Number of run-shop items bought this run (for price scaling). */
  itemsBoughtThisRun: number;
  /** True when the player voluntarily quit the run (shows different death screen). */
  quitVoluntarily: boolean;
  /** Snapshot of persistent data balance at run start (for "data earned this run" display). */
  dataAtRunStart: number;
  /** Milestone data accumulated during the run (awarded on death/quit, subject to penalty). */
  milestoneDataThisRun: number;
  /** Per-minigame data drip accumulated during the run (awarded on death/quit). */
  dataDripThisRun: number;
  /** Credits earned through gameplay (minigame wins, skips). Excludes Head Start bonus. */
  creditsEarnedThisRun: number;
  /** Time Siphon bonus: accumulated +0.2 s per consecutive win. Resets on fail and advanceFloor. */
  timeSiphonBonus: number;
  /** Cascade Clock: accumulated % of base timer from consecutive wins. Resets on fail only. */
  cascadeClockPct: number;
  /** Number of consecutive floors cleared without taking damage. */
  consecutiveFloorsNoDamage: number;
  /** Timestamps (Date.now()) recorded each time a floor is completed (advanceFloor). */
  floorCompletionTimestamps: number[];

  // Actions
  startRun: () => void;
  completeMinigame: (result: MinigameResult) => void;
  failMinigame: () => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addCredits: (amount: number) => void;
  addPowerUp: (item: PowerUpInstance) => boolean;
  usePowerUp: (id: string) => void;
  advanceFloor: () => void;
  dismissMilestone: () => void;
  quitRun: () => void;
  pauseRun: () => void;
  resumeRun: () => void;
  setStatus: (status: GameStatus) => void;
  skipRemainingFloor: (rewardFraction: number) => void;
  setTrainingMinigame: (type: MinigameType | null) => void;
  setTrainingOrigin: (origin: TrainingOrigin) => void;
  endRun: () => void;
}

type FullStore = RunSlice & MetaSlice & ShopSlice;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick `count` random items from `pool` (with replacement allowed across picks).
 *  No item appears more than 2 times consecutively. */
function pickRandom<T>(pool: T[], count: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  // Post-process: no 3+ consecutive identical entries
  if (pool.length > 1) {
    for (let i = 2; i < result.length; i++) {
      if (result[i] === result[i - 1] && result[i] === result[i - 2]) {
        const alternatives = pool.filter((x) => x !== result[i]);
        if (alternatives.length > 0) {
          result[i] = alternatives[Math.floor(Math.random() * alternatives.length)];
        }
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Initial state (exported for reuse in tests / resets)
// ---------------------------------------------------------------------------

export const initialRunState: Omit<RunSlice, keyof RunSliceActions> = {
  hp: 100,
  maxHp: 100,
  floor: 1,
  currentMinigameIndex: 0,
  floorMinigames: [],
  inventory: [],
  credits: 0,
  runScore: 0,
  status: "menu",
  runStartTime: 0,
  floorDamageTaken: false,
  runDamageTaken: false,
  minigamesWonThisRun: 0,
  minigamesPlayedThisRun: 0,
  powerUpsUsedThisFloor: false,
  trainingMinigame: null,
  trainingOrigin: null,
  milestoneFloor: 0,
  previousStatus: null,
  itemsBoughtThisRun: 0,
  quitVoluntarily: false,
  dataAtRunStart: 0,
  milestoneDataThisRun: 0,
  dataDripThisRun: 0,
  creditsEarnedThisRun: 0,
  timeSiphonBonus: 0,
  cascadeClockPct: 0,
  consecutiveFloorsNoDamage: 0,
  floorCompletionTimestamps: [],
};

// Helper type: extract only action keys
type RunSliceActions = {
  [K in keyof RunSlice as RunSlice[K] extends (...args: never[]) => unknown
    ? K
    : never]: RunSlice[K];
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createRunSlice: StateCreator<FullStore, [], [], RunSlice> = (
  set,
  get,
) => ({
  ...initialRunState,

  startRun: () => {
    const { unlockedMinigames, purchasedUpgrades } = get();
    const count = getMinigamesPerFloor(1);
    const floorMinigames = pickRandom(unlockedMinigames, count);

    // ── Apply meta upgrades ──────────────────────────────────────────────────

    // Helper: get tier for an upgrade (0 = not purchased)
    const tier = (id: string) => purchasedUpgrades[id] ?? 0;

    // hp-boost (stackable): +5 max HP per purchase
    const hpBoostTier = tier("hp-boost");
    const hpBoostBonus = hpBoostTier * 5;

    // Minigame unlock bonus: +5 max HP per unlocked minigame beyond starting set
    const unlockHpBonus = Math.max(0, unlockedMinigames.length - STARTING_MINIGAMES.length) * 5;

    // overclocked: add +5/+10/+15/+20/+25 bonus HP (raises both max and starting HP)
    const overclockedTier = tier("overclocked");
    const overclockedBonusByTier = [5, 10, 15, 20, 25];
    const overclockedBonus = overclockedTier > 0
      ? (overclockedBonusByTier[overclockedTier - 1] ?? 25)
      : 0;

    const actualMaxHp = 100 + hpBoostBonus + unlockHpBonus + overclockedBonus;
    const startHp = actualMaxHp;

    // Base starting credits (25 CR) + head-start meta upgrade bonus (5 tiers: +50/+125/+300/+600/+1000)
    // Centralized in balancing.ts: getStartingCredits(tier)
    const startCredits = getStartingCredits(tier("head-start"));

    // Starting inventory is empty — quick-boot and dual-core were removed
    const startInventory: PowerUpInstance[] = [];

    set({
      hp: Math.min(startHp, actualMaxHp),
      maxHp: actualMaxHp,
      floor: 1,
      currentMinigameIndex: 0,
      floorMinigames,
      inventory: startInventory,
      credits: startCredits,
      runScore: 0,
      status: "playing",
      runStartTime: Date.now(),
      floorDamageTaken: false,
      runDamageTaken: false,
      minigamesWonThisRun: 0,
      minigamesPlayedThisRun: 0,
      powerUpsUsedThisFloor: false,
      milestoneFloor: 0,
      itemsBoughtThisRun: 0,
      quitVoluntarily: false,
      dataAtRunStart: get().data,
      milestoneDataThisRun: 0,
      dataDripThisRun: 0,
      timeSiphonBonus: 0,
      cascadeClockPct: 0,
      consecutiveFloorsNoDamage: 0,
      floorCompletionTimestamps: [],
    });
  },

  completeMinigame: (result: MinigameResult) => {
    const state = get();
    const difficulty = getEffectiveDifficulty(state.floor, state.purchasedUpgrades["difficulty-reducer"] ?? 0);

    // Minigame unlock bonus: +5% global credits per unlocked minigame beyond starting 5
    const unlockBonus = Math.max(0, state.unlockedMinigames.length - STARTING_MINIGAMES.length) * 0.05;

    const rewardFraction = result.rewardFraction ?? 1;

    const rawEarned = getEffectiveCredits(
      result.timeMs,
      difficulty,
      state.purchasedUpgrades["credit-multiplier"] ?? 0,
      state.purchasedUpgrades["speed-tax"] ?? 0,
      unlockBonus,
    );
    const earned = Math.round(rawEarned * rewardFraction);

    // Per-minigame data drip: reward per win, scales with floor
    // Accumulated locally (not added to persistent store until run ends)
    const minigameDataDrip = Math.round(getDataDrip(state.floor) * rewardFraction);

    const isLastMinigame =
      state.currentMinigameIndex >= state.floorMinigames.length - 1;

    // Apply heal-on-success power-ups (e.g. Nano Repair)
    let healAmount = 0;
    for (const pu of state.inventory) {
      if (pu.effect.type === "heal-on-success") {
        healAmount += pu.effect.value;
      }
    }

    // Apply hp-leech power-ups (trigger on every completed protocol, win or fail)
    let leechAmount = 0;
    for (const pu of state.inventory) {
      if (pu.effect.type === "hp-leech") {
        leechAmount += pu.effect.value;
      }
    }

    const newHp = (healAmount + leechAmount) > 0
      ? Math.min(state.maxHp, state.hp + healAmount + leechAmount)
      : state.hp;

    // When floor is complete, check if it's a milestone floor
    let nextStatus = state.status;
    let milestoneFloor = 0;
    let milestoneDataThisRun = state.milestoneDataThisRun;
    if (isLastMinigame) {
      const rawMilestone = getMilestoneBonus(state.floor);
      if (rawMilestone > 0) {
        // Fix #10: reduce milestone if player already reached this floor before
        // First time reaching → full bonus; already reached → 25% bonus
        const milestoneScale = state.floor > state.stats.bestFloor ? 1.0 : 0.25;
        const milestoneReward = Math.round(rawMilestone * milestoneScale);
        // Fix #11: don't award immediately — accumulate for death/quit screen
        milestoneDataThisRun += milestoneReward;
        nextStatus = "milestone";
        milestoneFloor = state.floor;
      } else {
        nextStatus = "shop";
      }
    }

    // Time Siphon: each win adds +0.2 s bonus to the next protocol timer (floor-scoped)
    let timeSiphonBonus = state.timeSiphonBonus;
    const siphonPu = state.inventory.find((p) => p.effect.type === "time-siphon");
    if (siphonPu) {
      timeSiphonBonus += siphonPu.effect.value;
    }

    // Cascade Clock (meta upgrade): each consecutive win adds +2% of base timer, capped per tier
    let cascadeClockPct = state.cascadeClockPct;
    const cascadeTier = state.purchasedUpgrades["cascade-clock"] ?? 0;
    if (cascadeTier > 0) {
      const cascadeUpgrade = META_UPGRADE_POOL.find((u) => u.id === "cascade-clock");
      const tierCap = cascadeUpgrade?.effects[cascadeTier - 1]?.value ?? 0.10;
      cascadeClockPct = Math.min(tierCap, cascadeClockPct + 0.02);
    }

    set({
      hp: newHp,
      credits: state.credits + earned,
      creditsEarnedThisRun: state.creditsEarnedThisRun + earned,
      runScore: state.runScore + earned,
      minigamesWonThisRun: state.minigamesWonThisRun + 1,
      minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
      currentMinigameIndex: isLastMinigame
        ? state.currentMinigameIndex
        : state.currentMinigameIndex + 1,
      status: nextStatus,
      milestoneFloor,
      milestoneDataThisRun,
      dataDripThisRun: state.dataDripThisRun + minigameDataDrip,
      timeSiphonBonus,
      cascadeClockPct,
    });
  },

  failMinigame: () => {
    const state = get();
    const baseDamage = getEffectiveDamage(state.floor, state.purchasedUpgrades["thicker-armor"] ?? 0);

    // Apply the strongest shield / damage-reduction power-up
    const { damage, consumed, decremented } = applyShield(state.inventory, baseDamage);

    // Update inventory: remove consumed, decrement uses for multi-use
    let inventory = consumed
      ? state.inventory.filter((p) => p.id !== consumed)
      : state.inventory;
    if (decremented) {
      inventory = inventory.map((p) =>
        p.id === decremented
          ? { ...p, remainingUses: (p.remainingUses ?? 1) - 1 }
          : p,
      );
    }

    const newHpAfterDamage = Math.max(0, state.hp - damage);

    // Track whether any real damage was taken this floor/run
    const tookDamage = damage > 0;

    if (newHpAfterDamage <= 0) {
      set({
        hp: 0,
        inventory,
        floorDamageTaken: tookDamage ? true : state.floorDamageTaken,
        runDamageTaken: tookDamage ? true : state.runDamageTaken,
        minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
        status: "dead",
        // Time Siphon resets on fail; Cascade Clock resets on fail
        timeSiphonBonus: 0,
        cascadeClockPct: 0,
        consecutiveFloorsNoDamage: tookDamage ? 0 : state.consecutiveFloorsNoDamage,
      });
      return;
    }

    // HP Leech: apply after damage computation, only if player survived
    let leechAmount = 0;
    for (const pu of inventory) {
      if (pu.effect.type === "hp-leech") {
        leechAmount += pu.effect.value;
      }
    }
    const newHp = leechAmount > 0
      ? Math.min(state.maxHp, newHpAfterDamage + leechAmount)
      : newHpAfterDamage;

    // On fail: DON'T advance the index — re-roll the current slot with a new
    // random minigame so the player must still complete N total minigames.
    // Ensure the re-rolled game is different from the current one.
    const newFloorMinigames = [...state.floorMinigames];
    const pool = state.unlockedMinigames;
    const currentType = newFloorMinigames[state.currentMinigameIndex];
    const alternatives = pool.length > 1 ? pool.filter((m) => m !== currentType) : pool;
    newFloorMinigames[state.currentMinigameIndex] =
      alternatives[Math.floor(Math.random() * alternatives.length)];

    set({
      hp: newHp,
      inventory,
      floorDamageTaken: tookDamage ? true : state.floorDamageTaken,
      runDamageTaken: tookDamage ? true : state.runDamageTaken,
      minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
      floorMinigames: newFloorMinigames,
      // Time Siphon resets on fail; Cascade Clock resets on fail
      timeSiphonBonus: 0,
      cascadeClockPct: 0,
      consecutiveFloorsNoDamage: tookDamage ? 0 : state.consecutiveFloorsNoDamage,
    });
  },

  takeDamage: (amount: number) => {
    const state = get();
    set({
      hp: Math.max(0, state.hp - amount),
      floorDamageTaken: true,
      runDamageTaken: true,
    });
  },

  heal: (amount: number) => {
    const state = get();
    set({ hp: Math.min(state.maxHp, state.hp + amount) });
  },

  addCredits: (amount: number) => {
    set((state) => ({ credits: state.credits + amount }));
  },

  addPowerUp: (item: PowerUpInstance) => {
    const state = get();
    // No-stacking: reject if same type already exists
    if (state.inventory.some((p) => p.type === item.type)) {
      return false;
    }
    set({ inventory: [...state.inventory, item] });
    return true;
  },

  usePowerUp: (id: string) => {
    const state = get();
    set({
      inventory: state.inventory.filter((p) => p.id !== id),
      powerUpsUsedThisFloor: true,
    });
  },

  advanceFloor: () => {
    const state = get();
    const nextFloor = state.floor + 1;
    const count = getMinigamesPerFloor(nextFloor);
    const floorMinigames = pickRandom(state.unlockedMinigames, count);

    // Consume floor-scoped power-ups (heal-on-success, time-bonus, time-siphon, hp-leech)
    const inventory = state.inventory.filter(
      (p) =>
        p.effect.type !== "heal-on-success" &&
        p.effect.type !== "time-bonus" &&
        p.effect.type !== "time-siphon" &&
        p.effect.type !== "hp-leech",
    );

    // Emergency Patch (meta upgrade): regenerate 2% of maxHp per purchase tier at floor start
    const emergencyPatchTier = state.purchasedUpgrades["emergency-patch"] ?? 0;
    let newHp = state.hp;
    if (emergencyPatchTier > 0) {
      const regenAmount = Math.round(state.maxHp * 0.02 * emergencyPatchTier);
      newHp = Math.min(state.maxHp, state.hp + regenAmount);
    }

    // Track consecutive no-damage floors: increment if this floor had no damage
    const consecutiveFloorsNoDamage = state.floorDamageTaken
      ? 0
      : state.consecutiveFloorsNoDamage + 1;

    set({
      hp: newHp,
      floor: nextFloor,
      currentMinigameIndex: 0,
      floorMinigames,
      inventory,
      floorDamageTaken: false,
      powerUpsUsedThisFloor: false,
      status: "playing",
      milestoneFloor: 0,
      runShopOffers: [], // clear so next shop generates fresh
      // Time Siphon resets at floor advance (floor-scoped).
      // Cascade Clock does NOT reset here — it persists across floors.
      timeSiphonBonus: 0,
      consecutiveFloorsNoDamage,
      floorCompletionTimestamps: [...state.floorCompletionTimestamps, Date.now()],
    });
  },

  skipRemainingFloor: (rewardFraction: number) => {
    const state = get();
    const remaining = state.floorMinigames.length - state.currentMinigameIndex;

    // Calculate rewards for each remaining minigame at the given fraction
    const difficulty = getEffectiveDifficulty(state.floor, state.purchasedUpgrades["difficulty-reducer"] ?? 0);
    const unlockBonus = Math.max(0, state.unlockedMinigames.length - STARTING_MINIGAMES.length) * 0.05;

    // Skips don't get speed bonus — use Infinity to neutralize it
    const creditsPerGame = Math.round(
      getEffectiveCredits(
        Infinity,
        difficulty,
        state.purchasedUpgrades["credit-multiplier"] ?? 0,
        state.purchasedUpgrades["speed-tax"] ?? 0,
        unlockBonus,
      ) * rewardFraction,
    );
    const totalCredits = creditsPerGame * remaining;

    // Data drip at fraction
    const dripPerGame = Math.round(getDataDrip(state.floor) * rewardFraction);
    const totalDrip = dripPerGame * remaining;

    // Fix 3: Apply heal-on-success and hp-leech for skipped protocols
    let healPerGame = 0;
    for (const pu of state.inventory) {
      if (pu.effect.type === "heal-on-success") healPerGame += pu.effect.value;
      if (pu.effect.type === "hp-leech") healPerGame += pu.effect.value;
    }
    const totalHeal = healPerGame * remaining;
    const newHp = Math.min(state.maxHp, state.hp + totalHeal);

    // Fix 1: Clean up floor-scoped power-ups (same as advanceFloor)
    const inventory = state.inventory.filter(
      (p) =>
        p.effect.type !== "heal-on-success" &&
        p.effect.type !== "time-bonus" &&
        p.effect.type !== "time-siphon" &&
        p.effect.type !== "hp-leech",
    );

    // Check for milestone (floor completion)
    const rawMilestone = getMilestoneBonus(state.floor);
    let milestoneFloor = 0;
    let milestoneDataThisRun = state.milestoneDataThisRun;
    let nextStatus: GameStatus = "shop";

    if (rawMilestone > 0) {
      const milestoneScale = state.floor > state.stats.bestFloor ? 1.0 : 0.25;
      milestoneDataThisRun += Math.round(rawMilestone * milestoneScale);
      nextStatus = "milestone";
      milestoneFloor = state.floor;
    }

    set({
      hp: newHp,
      credits: state.credits + totalCredits,
      creditsEarnedThisRun: state.creditsEarnedThisRun + totalCredits,
      runScore: state.runScore + totalCredits,
      minigamesWonThisRun: state.minigamesWonThisRun + remaining,
      minigamesPlayedThisRun: state.minigamesPlayedThisRun + remaining,
      currentMinigameIndex: state.floorMinigames.length - 1, // mark all as done
      inventory,
      dataDripThisRun: state.dataDripThisRun + totalDrip,
      status: nextStatus,
      milestoneFloor,
      milestoneDataThisRun,
      // Fix 6: Reset Time Siphon bonus (floor-scoped)
      timeSiphonBonus: 0,
    });
  },

  dismissMilestone: () => {
    // After dismissing milestone overlay, proceed to vendor/shop screen
    set({ milestoneFloor: 0, status: "shop" });
  },

  pauseRun: () => {
    const state = get();
    set({ previousStatus: state.status, status: "paused" });
  },

  resumeRun: () => {
    const state = get();
    const target = state.previousStatus ?? "playing";
    set({ status: target, previousStatus: null });
  },

  setStatus: (status: GameStatus) => {
    set({ status });
  },

  setTrainingMinigame: (type: MinigameType | null) => {
    set({ trainingMinigame: type });
  },

  setTrainingOrigin: (origin: TrainingOrigin) => {
    set({ trainingOrigin: origin });
  },

  quitRun: () => {
    // Set quitVoluntarily and go to "dead" — DeathScreen reads the flag
    // to skip death penalty and show "RUN TERMINATED" instead.
    set({ quitVoluntarily: true, status: "dead" });
  },

  endRun: () => {
    set({ status: "dead" });
  },
});
