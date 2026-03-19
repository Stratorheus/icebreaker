import type { StateCreator } from "zustand";
import type { GameStatus, MinigameType, PowerUpInstance } from "@/types/game";
import { STARTING_MINIGAMES } from "@/types/game";
import type { MinigameResult } from "@/types/minigame";
import { getCredits, getDamage, getDataReward, getDifficulty, getMilestoneBonus, getMinigamesPerFloor } from "@/data/balancing";
import { applyShield } from "@/lib/power-up-effects";
import { META_UPGRADE_POOL } from "@/data/meta-upgrades";
import { RUN_SHOP_POOL } from "@/data/power-ups";
import type { PowerUpEffect } from "@/types/game";
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
  /** Extra seconds added to every minigame timer on floor 1 (from Pre-Loaded meta upgrade). */
  bonusTimeSecs: number;
  /** Set to a milestone floor number (every 5th floor) to trigger the overlay; 0 = no milestone. */
  milestoneFloor: number;
  /** Tracks the status before entering pause, so we can resume to the correct screen. */
  previousStatus: GameStatus | null;
  /** Number of run-shop items bought this run (for price scaling). */
  itemsBoughtThisRun: number;
  /** True when the player voluntarily quit the run (shows different death screen). */
  quitVoluntarily: boolean;

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
  setTrainingMinigame: (type: MinigameType | null) => void;
  endRun: () => void;
}

type FullStore = RunSlice & MetaSlice & ShopSlice;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick `count` random items from `pool` (with replacement allowed across picks). */
function pickRandom<T>(pool: T[], count: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[Math.floor(Math.random() * pool.length)]);
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
  bonusTimeSecs: 0,
  milestoneFloor: 0,
  previousStatus: null,
  itemsBoughtThisRun: 0,
  quitVoluntarily: false,
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

    // overclocked: add +10/+15/+20 bonus HP (raises both max and starting HP)
    const overclockedTier = tier("overclocked");
    const overclockedBonusByTier = [10, 15, 20];
    const overclockedBonus = overclockedTier > 0
      ? (overclockedBonusByTier[overclockedTier - 1] ?? 20)
      : 0;

    const actualMaxHp = 100 + hpBoostBonus + unlockHpBonus + overclockedBonus;
    const startHp = actualMaxHp;

    // Base starting credits: every player gets 25 CR so floor-1 vendor is usable
    // head-start: +50 bonus credits on top of base
    const startCredits = 25 + (tier("head-start") > 0 ? 50 : 0);

    // pre-loaded: +1 s on every timer during floor 1
    const preLoadedUpgrade = META_UPGRADE_POOL.find((u) => u.id === "pre-loaded");
    const bonusTimeSecs = tier("pre-loaded") > 0 && preLoadedUpgrade
      ? (preLoadedUpgrade.effects[0]?.value ?? 1)
      : 0;

    // quick-boot / dual-core: start with 1 or 2 random power-ups
    // dual-core overrides quick-boot (requires it, gives 2)
    const powerUpCount = tier("dual-core") > 0 ? 2 : tier("quick-boot") > 0 ? 1 : 0;
    const startInventory: PowerUpInstance[] = [];
    if (powerUpCount > 0) {
      const shuffledPool = [...RUN_SHOP_POOL].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(powerUpCount, shuffledPool.length); i++) {
        const item = shuffledPool[i];
        startInventory.push({
          id: `start-powerup-${item.id}-${Date.now()}-${i}`,
          type: item.id,
          name: item.name,
          description: item.description,
          effect: {
            type: item.effect.type as PowerUpEffect["type"],
            value: item.effect.value,
            minigame: item.effect.minigame,
          },
        });
      }
    }

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
      bonusTimeSecs,
      milestoneFloor: 0,
      itemsBoughtThisRun: 0,
      quitVoluntarily: false,
    });
  },

  completeMinigame: (result: MinigameResult) => {
    const state = get();
    const difficulty = getDifficulty(state.floor);

    // 1b. Credit Multiplier meta upgrade: +10/20/30% credits
    const creditTier = state.purchasedUpgrades["credit-multiplier"] ?? 0;
    const creditMultiplier = 1 + creditTier * 0.1;

    // Minigame unlock bonus: +5% global credits per unlocked minigame beyond starting 5
    const unlockBonus = Math.max(0, state.unlockedMinigames.length - STARTING_MINIGAMES.length) * 0.05;
    const totalCreditMultiplier = creditMultiplier * (1 + unlockBonus);

    const baseCredits = getCredits(result.timeMs, difficulty);

    // 1e. Speed Tax meta upgrade: flat bonus per tier on top of credits
    const speedTaxTier = state.purchasedUpgrades["speed-tax"] ?? 0;
    const speedBonus = speedTaxTier > 0 ? Math.round(baseCredits * speedTaxTier * 0.05) : 0;

    const earned = Math.round(baseCredits * totalCreditMultiplier) + speedBonus;

    // Per-minigame data drip: small data reward per win, scales with floor
    const minigameDataDrip = Math.round(state.floor * 0.5);
    if (minigameDataDrip > 0) {
      state.addData(minigameDataDrip);
    }

    const isLastMinigame =
      state.currentMinigameIndex >= state.floorMinigames.length - 1;

    // Apply heal-on-success power-ups (e.g. Nano Repair)
    let healAmount = 0;
    for (const pu of state.inventory) {
      if (pu.effect.type === "heal-on-success") {
        healAmount += pu.effect.value;
      }
    }
    const newHp = healAmount > 0
      ? Math.min(state.maxHp, state.hp + healAmount)
      : state.hp;

    // When floor is complete, check if it's a milestone floor
    let nextStatus = state.status;
    let milestoneFloor = 0;
    if (isLastMinigame) {
      const isMilestone = getMilestoneBonus(state.floor) > 0;
      if (isMilestone) {
        // Award milestone bonus data immediately
        state.addData(getMilestoneBonus(state.floor));
        nextStatus = "milestone";
        milestoneFloor = state.floor;
      } else {
        nextStatus = "shop";
      }
    }

    set({
      hp: newHp,
      credits: state.credits + earned,
      runScore: state.runScore + earned,
      minigamesWonThisRun: state.minigamesWonThisRun + 1,
      minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
      currentMinigameIndex: isLastMinigame
        ? state.currentMinigameIndex
        : state.currentMinigameIndex + 1,
      status: nextStatus,
      milestoneFloor,
    });
  },

  failMinigame: () => {
    const state = get();
    const rawDamage = getDamage(state.floor);

    // 1a. Thicker Armor meta upgrade: reduce base damage by 10/20/30%
    const armorTier = state.purchasedUpgrades["thicker-armor"] ?? 0;
    const armorReduction = armorTier > 0 ? [0.1, 0.2, 0.3][armorTier - 1] : 0;
    const baseDamage = Math.round(rawDamage * (1 - armorReduction));

    // Apply any shield / damage-reduction power-up from inventory
    const { damage, consumed } = applyShield(state.inventory, baseDamage);

    // Remove consumed power-up from inventory
    const inventory = consumed
      ? state.inventory.filter((p) => p.id !== consumed)
      : state.inventory;

    const newHp = Math.max(0, state.hp - damage);

    // Track whether any real damage was taken this floor/run
    const tookDamage = damage > 0;

    if (newHp <= 0) {
      set({
        hp: 0,
        inventory,
        floorDamageTaken: tookDamage ? true : state.floorDamageTaken,
        runDamageTaken: tookDamage ? true : state.runDamageTaken,
        minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
        status: "dead",
      });
      return;
    }

    // On fail: DON'T advance the index — re-roll the current slot with a new
    // random minigame so the player must still complete N total minigames.
    const newFloorMinigames = [...state.floorMinigames];
    const pool = state.unlockedMinigames;
    newFloorMinigames[state.currentMinigameIndex] =
      pool[Math.floor(Math.random() * pool.length)];

    set({
      hp: newHp,
      inventory,
      floorDamageTaken: tookDamage ? true : state.floorDamageTaken,
      runDamageTaken: tookDamage ? true : state.runDamageTaken,
      minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
      floorMinigames: newFloorMinigames,
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

    // Consume floor-scoped power-ups (e.g. heal-on-success)
    const inventory = state.inventory.filter(
      (p) => p.effect.type !== "heal-on-success",
    );

    set({
      floor: nextFloor,
      currentMinigameIndex: 0,
      floorMinigames,
      inventory,
      floorDamageTaken: false,
      powerUpsUsedThisFloor: false,
      status: "playing",
      milestoneFloor: 0,
      runShopOffers: [], // clear so next shop generates fresh
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

  quitRun: () => {
    // Set quitVoluntarily and go to "dead" — DeathScreen reads the flag
    // to skip death penalty and show "RUN TERMINATED" instead.
    set({ quitVoluntarily: true, status: "dead" });
  },

  endRun: () => {
    set({ status: "dead" });
  },
});
