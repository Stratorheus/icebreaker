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
  /** Set to a milestone floor number (5/10/15/20) to trigger the overlay; 0 = no milestone. */
  milestoneFloor: number;

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

    // max-hp-boost: +10 / +20 / +30 maxHp
    const maxHpBonusByTier = [10, 20, 30];
    const maxHpBoostTier = tier("max-hp-boost");
    const maxHpBonus = maxHpBoostTier > 0
      ? (maxHpBonusByTier[maxHpBoostTier - 1] ?? 30)
      : 0;

    // Minigame unlock bonus: +5 max HP per unlocked minigame beyond starting set
    const unlockHpBonus = Math.max(0, unlockedMinigames.length - STARTING_MINIGAMES.length) * 5;

    const actualMaxHp = 100 + maxHpBonus + unlockHpBonus;

    // overclocked: start with 110 HP (the +10 bonus stacks with max-hp-boost;
    // result is capped at actualMaxHp so you never start over the ceiling)
    const startHp = tier("overclocked") > 0
      ? Math.min(110, actualMaxHp)
      : actualMaxHp;

    // head-start: +50 starting credits
    const startCredits = tier("head-start") > 0 ? 50 : 0;

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
    });
  },

  completeMinigame: (result: MinigameResult) => {
    const state = get();
    const difficulty = getDifficulty(state.floor);
    const earned = getCredits(result.timeMs, difficulty);
    const isLastMinigame =
      state.currentMinigameIndex >= state.floorMinigames.length - 1;

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
    const baseDamage = getDamage(state.floor);

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

    set({
      floor: nextFloor,
      currentMinigameIndex: 0,
      floorMinigames,
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

  setStatus: (status: GameStatus) => {
    set({ status });
  },

  setTrainingMinigame: (type: MinigameType | null) => {
    set({ trainingMinigame: type });
  },

  quitRun: () => {
    const state = get();
    // Full data reward (no penalty) — getDataReward(floor) + any milestone bonuses already awarded
    const dataReward = getDataReward(state.floor);
    if (dataReward > 0) {
      state.addData(dataReward);
    }

    // Update stats
    const playTimeMs = Date.now() - state.runStartTime;
    const stats = state.stats;
    state.updateStats({
      totalRuns: stats.totalRuns + 1,
      bestFloor: Math.max(stats.bestFloor, state.floor),
      totalMinigamesPlayed: stats.totalMinigamesPlayed + state.minigamesPlayedThisRun,
      totalMinigamesWon: stats.totalMinigamesWon + state.minigamesWonThisRun,
      totalCreditsEarned: stats.totalCreditsEarned + state.runScore,
      totalDataEarned: stats.totalDataEarned + dataReward,
      totalPlayTimeMs: stats.totalPlayTimeMs + playTimeMs,
    });

    set({ status: "menu" });
  },

  endRun: () => {
    set({ status: "dead" });
  },
});
