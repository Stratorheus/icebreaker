import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createRunSlice, type RunSlice } from "./run-slice";
import {
  createMetaSlice,
  META_PERSIST_KEYS,
  type MetaSlice,
} from "./meta-slice";
import { createShopSlice, type ShopSlice } from "./shop-slice";
import { STARTING_MINIGAMES } from "@/data/minigames/registry";
import type { MinigameType } from "@/types/game";

// ---------------------------------------------------------------------------
// Combined store type
// ---------------------------------------------------------------------------

export type GameStore = RunSlice & MetaSlice & ShopSlice;

// ---------------------------------------------------------------------------
// Store creation
//
// Only meta-slice state is persisted to localStorage.
// Run state resets every run. Shop state regenerates.
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>()(
  persist(
    (...a) => ({
      ...createRunSlice(...a),
      ...createMetaSlice(...a),
      ...createShopSlice(...a),
    }),
    {
      name: "icebreaker-meta",
      partialize: (state) => {
        const persisted: Record<string, unknown> = {};
        for (const key of META_PERSIST_KEYS) {
          persisted[key] = state[key];
        }
        return persisted;
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Record<string, unknown>) };
        // Guarantee starting minigames are always present after hydration.
        // Prevents data loss if localStorage is corrupted, manually edited,
        // or if a new starting minigame is added in an update.
        const saved = (merged as unknown as { unlockedMinigames: MinigameType[] }).unlockedMinigames ?? [];
        const guaranteed = [...new Set([...STARTING_MINIGAMES, ...saved])];
        (merged as unknown as { unlockedMinigames: MinigameType[] }).unlockedMinigames = guaranteed;
        return merged as GameStore;
      },
    },
  ),
);

// Expose store on window for E2E testing (Playwright store manipulation)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__GAME_STORE__ = useGameStore;
}
