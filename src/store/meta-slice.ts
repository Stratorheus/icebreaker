import type { StateCreator } from "zustand";
import type { MinigameType, PlayerStats } from "@/types/game";
import { STARTING_MINIGAMES } from "@/data/minigames/registry";
import type { RunSlice } from "./run-slice";
import type { ShopSlice } from "./shop-slice";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetaSlice {
  // State
  data: number;
  unlockedMinigames: MinigameType[];
  purchasedUpgrades: Record<string, number>;
  achievements: string[];
  stats: PlayerStats;
  seenBriefings: MinigameType[];

  // Actions
  addData: (amount: number) => void;
  spendData: (amount: number) => boolean;
  unlockMinigame: (type: MinigameType) => void;
  purchaseUpgrade: (id: string) => void;
  unlockAchievement: (id: string) => void;
  markBriefingSeen: (type: MinigameType) => void;
  updateStats: (partial: Partial<PlayerStats>) => void;
  /** Update win streak + cumulative wins for a minigame result. */
  recordMinigameResult: (type: MinigameType, won: boolean) => void;
  getUpgradeTier: (id: string) => number;
}

type FullStore = RunSlice & MetaSlice & ShopSlice;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialStats: PlayerStats = {
  totalRuns: 0,
  bestFloor: 0,
  totalMinigamesPlayed: 0,
  totalMinigamesWon: 0,
  totalCreditsEarned: 0,
  totalDataEarned: 0,
  totalPlayTimeMs: 0,
  minigameWinStreaks: {},
  minigameWinsTotal: {},
};

export const initialMetaState = {
  data: 0,
  unlockedMinigames: [...STARTING_MINIGAMES],
  purchasedUpgrades: {} as Record<string, number>,
  achievements: [] as string[],
  stats: { ...initialStats },
  seenBriefings: [] as MinigameType[],
};

// ---------------------------------------------------------------------------
// Keys that should be persisted (used by partialize in game-store)
// ---------------------------------------------------------------------------

export const META_PERSIST_KEYS = [
  "data",
  "unlockedMinigames",
  "purchasedUpgrades",
  "achievements",
  "stats",
  "seenBriefings",
] as const;

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createMetaSlice: StateCreator<FullStore, [], [], MetaSlice> = (
  set,
  get,
) => ({
  ...initialMetaState,

  addData: (amount: number) => {
    set((state) => ({ data: state.data + amount }));
  },

  spendData: (amount: number) => {
    const state = get();
    if (state.data < amount) return false;
    set({ data: state.data - amount });
    return true;
  },

  unlockMinigame: (type: MinigameType) => {
    const state = get();
    if (state.unlockedMinigames.includes(type)) return;
    set({ unlockedMinigames: [...state.unlockedMinigames, type] });
  },

  purchaseUpgrade: (id: string) => {
    const state = get();
    const currentTier = state.purchasedUpgrades[id] ?? 0;
    set({
      purchasedUpgrades: {
        ...state.purchasedUpgrades,
        [id]: currentTier + 1,
      },
    });
  },

  unlockAchievement: (id: string) => {
    const state = get();
    if (state.achievements.includes(id)) return;
    set({ achievements: [...state.achievements, id] });
  },

  markBriefingSeen: (type: MinigameType) => {
    const state = get();
    if (state.seenBriefings.includes(type)) return;
    set({ seenBriefings: [...state.seenBriefings, type] });
  },

  updateStats: (partial: Partial<PlayerStats>) => {
    const state = get();
    set({ stats: { ...state.stats, ...partial } });
  },

  recordMinigameResult: (type: MinigameType, won: boolean) => {
    const state = get();
    const currentStreak = state.stats.minigameWinStreaks[type] ?? 0;
    const currentTotal = state.stats.minigameWinsTotal[type] ?? 0;
    set({
      stats: {
        ...state.stats,
        minigameWinStreaks: {
          ...state.stats.minigameWinStreaks,
          [type]: won ? currentStreak + 1 : 0,
        },
        minigameWinsTotal: {
          ...state.stats.minigameWinsTotal,
          [type]: won ? currentTotal + 1 : currentTotal,
        },
      },
    });
  },

  getUpgradeTier: (id: string) => {
    return get().purchasedUpgrades[id] ?? 0;
  },
});
