import type { StateCreator } from "zustand";
import type { PowerUpEffect, PowerUpInstance } from "@/types/game";
import type { RunShopItem, MetaUpgrade } from "@/types/shop";
import { RUN_SHOP_POOL } from "@/data/power-ups";
import { META_UPGRADE_POOL } from "@/data/meta-upgrades";
import { getRunShopPrice } from "@/data/balancing";
import type { RunSlice } from "./run-slice";
import type { MetaSlice } from "./meta-slice";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunShopOffer extends RunShopItem {
  /** Scaled price for the current floor. */
  price: number;
  purchased: boolean;
}

export interface ShopSlice {
  // State
  runShopOffers: RunShopOffer[];
  metaShopItems: MetaUpgrade[];

  // Actions
  generateRunShop: (floor: number) => void;
  buyRunShopItem: (index: number) => boolean;
  generateMetaShop: () => void;
}

type FullStore = RunSlice & MetaSlice & ShopSlice;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createShopSlice: StateCreator<FullStore, [], [], ShopSlice> = (
  set,
  get,
) => ({
  runShopOffers: [],
  metaShopItems: [],

  generateRunShop: (floor: number) => {
    const state = get();

    // Pick 3-4 random items from the pool
    const count = 3 + (Math.random() < 0.5 ? 1 : 0);
    const shuffled = shuffle(RUN_SHOP_POOL);
    let picked = shuffled.slice(0, count);

    // 3g. Cache Primed: guarantee at least one heal item in shop
    const cachePrimedTier = state.purchasedUpgrades["cache-primed"] ?? 0;
    if (cachePrimedTier > 0) {
      const hasHeal = picked.some((item) => item.effect.type === "heal");
      if (!hasHeal) {
        const healItems = RUN_SHOP_POOL.filter((item) => item.effect.type === "heal");
        if (healItems.length > 0) {
          const randomHeal = healItems[Math.floor(Math.random() * healItems.length)];
          // Replace the last item with a heal item
          picked = [...picked.slice(0, -1), randomHeal];
        }
      }
    }

    const offers: RunShopOffer[] = picked.map((item) => ({
      ...item,
      price: getRunShopPrice(item.basePrice, floor),
      purchased: false,
    }));

    set({ runShopOffers: offers });
  },

  buyRunShopItem: (index: number) => {
    const state = get();
    const offer = state.runShopOffers[index];
    if (!offer || offer.purchased) return false;
    if (state.credits < offer.price) return false;

    // Check no-stacking: reject if same item type already in inventory
    if (state.inventory.some((p) => p.type === offer.id)) return false;

    // Create a PowerUpInstance from the shop item
    const powerUp: PowerUpInstance = {
      id: `${offer.id}-${Date.now()}`,
      type: offer.id,
      name: offer.name,
      description: offer.description,
      effect: {
        type: offer.effect.type as PowerUpEffect["type"],
        value: offer.effect.value,
        minigame: offer.effect.minigame,
      },
    };

    // Deduct credits
    const newCredits = state.credits - offer.price;

    // Mark offer as purchased
    const newOffers = state.runShopOffers.map((o, i) =>
      i === index ? { ...o, purchased: true } : o,
    );

    // Immediate-effect items are consumed on purchase (not added to inventory)
    const effectType = powerUp.effect.type;
    if (effectType === "heal") {
      // Apply healing immediately — don't add to inventory
      set({
        credits: newCredits,
        runShopOffers: newOffers,
      });
      state.heal(powerUp.effect.value);
      return true;
    }

    // Add power-up to inventory for non-immediate effects
    set({
      credits: newCredits,
      runShopOffers: newOffers,
      inventory: [...state.inventory, powerUp],
    });

    return true;
  },

  generateMetaShop: () => {
    // Meta shop shows all upgrades, not a random subset
    set({ metaShopItems: [...META_UPGRADE_POOL] });
  },
});
