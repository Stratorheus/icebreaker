import type { StateCreator } from "zustand";
import type { MinigameType, PlayerStats } from "@/types/game";
import { STARTING_MINIGAMES } from "@/data/minigames/registry";
import { ACHIEVEMENT_POOL } from "@/data/achievements";
import { track } from "@/lib/analytics";
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
  revealedAchievements: string[];
  stats: PlayerStats;
  seenBriefings: MinigameType[];
  /** How many times each checkpoint floor has been reached (for floor-select unlock gating). */
  checkpointReaches: Record<number, number>;
  onboardingComplete: boolean;
  hintsShown: Record<string, boolean>;

  // Actions
  addData: (amount: number) => void;
  spendData: (amount: number) => boolean;
  unlockMinigame: (type: MinigameType) => void;
  purchaseUpgrade: (id: string, maxTier?: number) => void;
  unlockAchievement: (id: string) => void;
  revealAchievement: (id: string) => void;
  markBriefingSeen: (type: MinigameType) => void;
  updateStats: (partial: Partial<PlayerStats>) => void;
  /** Update win streak + cumulative wins for a minigame result. */
  recordMinigameResult: (type: MinigameType, won: boolean) => void;
  getUpgradeTier: (id: string) => number;
  incrementCheckpointReach: (floor: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  markHintShown: (id: string) => void;
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

const initialMetaState = {
  data: 0,
  unlockedMinigames: [...STARTING_MINIGAMES],
  purchasedUpgrades: {} as Record<string, number>,
  achievements: [] as string[],
  revealedAchievements: [] as string[],
  stats: { ...initialStats },
  seenBriefings: [] as MinigameType[],
  checkpointReaches: {} as Record<number, number>,
  onboardingComplete: false,
  hintsShown: {} as Record<string, boolean>,
};

// ---------------------------------------------------------------------------
// Keys that should be persisted (used by partialize in game-store)
// ---------------------------------------------------------------------------

export const META_PERSIST_KEYS = [
  "data",
  "unlockedMinigames",
  "purchasedUpgrades",
  "achievements",
  "revealedAchievements",
  "stats",
  "seenBriefings",
  "checkpointReaches",
  "onboardingComplete",
  "hintsShown",
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

  purchaseUpgrade: (id: string, maxTier?: number) => {
    const state = get();
    const currentTier = state.purchasedUpgrades[id] ?? 0;
    if (maxTier !== undefined && currentTier >= maxTier) return;
    const nextTier = currentTier + 1;
    set({
      purchasedUpgrades: {
        ...state.purchasedUpgrades,
        [id]: nextTier,
      },
    });

    track("meta_purchase", { id, tier: nextTier });
  },

  unlockAchievement: (id: string) => {
    const state = get();
    if (state.achievements.includes(id)) return;
    set({ achievements: [...state.achievements, id] });

    const achievement = ACHIEVEMENT_POOL.find((a) => a.id === id);
    track("achievement_unlocked", { id, category: achievement?.category });
  },

  revealAchievement: (id: string) => {
    const state = get();
    if (state.revealedAchievements.includes(id)) return;
    set({ revealedAchievements: [...state.revealedAchievements, id] });
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

  incrementCheckpointReach: (floor: number) => {
    const state = get();
    const current = state.checkpointReaches[floor] ?? 0;
    set({ checkpointReaches: { ...state.checkpointReaches, [floor]: current + 1 } });
  },

  completeOnboarding: () => {
    set({ onboardingComplete: true });
  },

  resetOnboarding: () => {
    set({ onboardingComplete: false, hintsShown: {} });
  },

  markHintShown: (id: string) => {
    const state = get();
    set({ hintsShown: { ...state.hintsShown, [id]: true } });
  },
});
