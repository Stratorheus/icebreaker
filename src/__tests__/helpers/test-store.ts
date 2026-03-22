import { create } from "zustand";
import { createRunSlice } from "@/store/run-slice";
import { createMetaSlice } from "@/store/meta-slice";
import { createShopSlice } from "@/store/shop-slice";
import type { GameStore } from "@/store/game-store";

export function createTestStore() {
  return create<GameStore>()((...a) => ({
    ...createRunSlice(...a),
    ...createMetaSlice(...a),
    ...createShopSlice(...a),
  }));
}
