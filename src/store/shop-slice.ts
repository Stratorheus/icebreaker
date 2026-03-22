import type { StateCreator } from "zustand";
import type { PowerUpEffect, PowerUpInstance } from "@/types/game";
import type { RunShopItem, MetaUpgrade } from "@/types/shop";
import { RUN_SHOP_POOL } from "@/data/power-ups";
import { META_UPGRADE_POOL } from "@/data/upgrades/registry";
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
    // (cache-primed removed — heal guarantee reduced shop variety and decision space)
    const picked = shuffled.slice(0, count);

    const itemsBought = state.itemsBoughtThisRun ?? 0;
    const offers: RunShopOffer[] = picked.map((item) => ({
      ...item,
      price: Math.round(getRunShopPrice(item.basePrice, floor) * (1 + itemsBought * 0.05)),
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
      // Multi-use power-ups: stacked damage reduction gets 2 uses
      ...(offer.effect.type === "damage-reduction-stacked" ? { remainingUses: 2 } : {}),
    };

    // Deduct credits
    const newCredits = state.credits - offer.price;

    // Mark offer as purchased
    const newOffers = state.runShopOffers.map((o, i) =>
      i === index ? { ...o, purchased: true } : o,
    );

    const newItemsBought = (state.itemsBoughtThisRun ?? 0) + 1;

    // Immediate-effect items are consumed on purchase (not added to inventory)
    const effectType = powerUp.effect.type;
    if (effectType === "heal") {
      // Apply healing immediately — don't add to inventory
      set({
        credits: newCredits,
        runShopOffers: newOffers,
        itemsBoughtThisRun: newItemsBought,
      });
      state.heal(powerUp.effect.value);
      return true;
    }

    // Add power-up to inventory for non-immediate effects
    set({
      credits: newCredits,
      runShopOffers: newOffers,
      inventory: [...state.inventory, powerUp],
      itemsBoughtThisRun: newItemsBought,
    });

    return true;
  },

  generateMetaShop: () => {
    // Meta shop shows all upgrades, not a random subset
    set({ metaShopItems: [...META_UPGRADE_POOL] });
  },
});
