import type { StateCreator } from "zustand";
import type { GameStatus, MinigameType, PowerUpInstance } from "@/types/game";
import type { MinigameResult } from "@/types/minigame";
import { getCredits, getDamage, getMinigamesPerFloor } from "@/data/balancing";
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
  setStatus: (status: GameStatus) => void;
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
    const { unlockedMinigames } = get();
    const count = getMinigamesPerFloor(1);
    const floorMinigames = pickRandom(unlockedMinigames, count);

    set({
      hp: 100,
      maxHp: 100,
      floor: 1,
      currentMinigameIndex: 0,
      floorMinigames,
      inventory: [],
      credits: 0,
      runScore: 0,
      status: "playing",
      runStartTime: Date.now(),
      floorDamageTaken: false,
      runDamageTaken: false,
      minigamesWonThisRun: 0,
      minigamesPlayedThisRun: 0,
      powerUpsUsedThisFloor: false,
    });
  },

  completeMinigame: (result: MinigameResult) => {
    const state = get();
    const difficulty = state.floor / 20; // simplified, matches getDifficulty
    const earned = getCredits(result.timeMs, Math.min(difficulty, 1));
    const isLastMinigame =
      state.currentMinigameIndex >= state.floorMinigames.length - 1;

    set({
      credits: state.credits + earned,
      runScore: state.runScore + earned,
      minigamesWonThisRun: state.minigamesWonThisRun + 1,
      minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
      currentMinigameIndex: isLastMinigame
        ? state.currentMinigameIndex
        : state.currentMinigameIndex + 1,
      status: isLastMinigame ? "shop" : state.status,
    });
  },

  failMinigame: () => {
    const state = get();
    const damage = getDamage(state.floor);
    const newHp = Math.max(0, state.hp - damage);
    const isLastMinigame =
      state.currentMinigameIndex >= state.floorMinigames.length - 1;

    if (newHp <= 0) {
      set({
        hp: 0,
        floorDamageTaken: true,
        runDamageTaken: true,
        minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
        status: "dead",
      });
      return;
    }

    set({
      hp: newHp,
      floorDamageTaken: true,
      runDamageTaken: true,
      minigamesPlayedThisRun: state.minigamesPlayedThisRun + 1,
      currentMinigameIndex: isLastMinigame
        ? state.currentMinigameIndex
        : state.currentMinigameIndex + 1,
      status: isLastMinigame ? "shop" : state.status,
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
    });
  },

  setStatus: (status: GameStatus) => {
    set({ status });
  },

  endRun: () => {
    set({ status: "dead" });
  },
});
