import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createRunSlice, type RunSlice } from "./run-slice";
import {
  createMetaSlice,
  META_PERSIST_KEYS,
  type MetaSlice,
} from "./meta-slice";
import { createShopSlice, type ShopSlice } from "./shop-slice";

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
    },
  ),
);

// Expose store on window for E2E testing (Playwright store manipulation)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__GAME_STORE__ = useGameStore;
}
