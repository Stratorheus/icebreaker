import { describe, it, expect } from "vitest";
import { META_UPGRADE_POOL } from "@/data/upgrades/registry";
import { MINIGAME_REGISTRY, UNLOCKABLE_MINIGAMES } from "@/data/minigames/registry";
import type { MinigameType } from "@/types/game";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_MINIGAME_TYPES = new Set<string>(Object.keys(MINIGAME_REGISTRY));

// Licenses = category "minigame-unlock"
const licenses = META_UPGRADE_POOL.filter((u) => u.category === "minigame-unlock");

// Game-specific upgrades
const gameSpecific = META_UPGRADE_POOL.filter((u) => u.category === "game-specific");

// Tiered upgrades: maxTier > 1 and NOT stackable
const tieredUpgrades = META_UPGRADE_POOL.filter((u) => u.maxTier > 1 && !u.stackable);

// Dynamic-priced licenses
const dynamicLicenses = licenses.filter((u) => (u as unknown as Record<string, unknown>).dynamicPrice === true);

// ---------------------------------------------------------------------------
// No duplicate IDs across the whole pool
// ---------------------------------------------------------------------------

describe("META_UPGRADE_POOL — no duplicate IDs", () => {
  it("has no duplicate upgrade IDs", () => {
    const ids = META_UPGRADE_POOL.map((u) => u.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Every upgrade has at least 1 effect
// ---------------------------------------------------------------------------

describe("META_UPGRADE_POOL — every upgrade has ≥1 effect", () => {
  it.each(META_UPGRADE_POOL.map((u) => u.id))(
    "upgrade '%s' has at least one effect",
    (id) => {
      const upgrade = META_UPGRADE_POOL.find((u) => u.id === id)!;
      expect(upgrade.effects.length).toBeGreaterThan(0);
    },
  );
});

// ---------------------------------------------------------------------------
// Game-specific upgrades reference valid MinigameType in their effects
// ---------------------------------------------------------------------------

describe("game-specific upgrades — effects reference valid MinigameType", () => {
  it("each game-specific upgrade has at least one effect with a valid minigame field", () => {
    for (const upgrade of gameSpecific) {
      for (const effect of upgrade.effects) {
        expect(effect.minigame).toBeDefined();
        expect(ALL_MINIGAME_TYPES.has(effect.minigame as string)).toBe(true);
      }
    }
  });

  it.each(gameSpecific.map((u) => u.id))(
    "game-specific upgrade '%s': every effect.minigame is a valid MinigameType",
    (id) => {
      const upgrade = gameSpecific.find((u) => u.id === id)!;
      for (const effect of upgrade.effects) {
        expect(ALL_MINIGAME_TYPES.has(effect.minigame as string)).toBe(true);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Unlock licenses reference unlockable (non-starting) minigames
// ---------------------------------------------------------------------------

describe("minigame-unlock licenses — target non-starting minigames", () => {
  const unlockableSet = new Set<MinigameType>(UNLOCKABLE_MINIGAMES);

  it("every license effect targets an unlockable minigame", () => {
    for (const license of licenses) {
      for (const effect of license.effects) {
        expect(effect.type).toBe("unlock-minigame");
        expect(unlockableSet.has(effect.minigame as MinigameType)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// wire-cutting-toolkit licenseId override is preserved
// ---------------------------------------------------------------------------

describe("wire-cutting-toolkit license ID override", () => {
  it("wire-cutting config has licenseId='wire-cutting-toolkit'", () => {
    expect(MINIGAME_REGISTRY["wire-cutting"].licenseId).toBe("wire-cutting-toolkit");
  });

  it("META_UPGRADE_POOL contains 'wire-cutting-toolkit' (not 'wire-cutting-license')", () => {
    const ids = META_UPGRADE_POOL.map((u) => u.id);
    expect(ids).toContain("wire-cutting-toolkit");
    expect(ids).not.toContain("wire-cutting-license");
  });
});

// ---------------------------------------------------------------------------
// Tiered upgrades: effects.length === maxTier
// ---------------------------------------------------------------------------

describe("tiered upgrades — effects count matches maxTier", () => {
  it.each(tieredUpgrades.map((u) => u.id))(
    "tiered upgrade '%s' has effects.length === maxTier",
    (id) => {
      const upgrade = tieredUpgrades.find((u) => u.id === id)!;
      expect(upgrade.effects.length).toBe(upgrade.maxTier);
    },
  );
});

// ---------------------------------------------------------------------------
// All prices arrays have length === maxTier (for non-stackable upgrades)
// ---------------------------------------------------------------------------

describe("non-stackable upgrades — prices array length matches maxTier", () => {
  const nonStackable = META_UPGRADE_POOL.filter((u) => !u.stackable);

  it.each(nonStackable.map((u) => u.id))(
    "upgrade '%s' has prices.length === maxTier",
    (id) => {
      const upgrade = nonStackable.find((u) => u.id === id)!;
      expect(upgrade.prices.length).toBe(upgrade.maxTier);
    },
  );
});

// ---------------------------------------------------------------------------
// Dynamic-priced licenses have prices: [0] and dynamicPrice: true
// ---------------------------------------------------------------------------

describe("dynamic-priced licenses", () => {
  it("at least one license has dynamicPrice: true", () => {
    expect(dynamicLicenses.length).toBeGreaterThan(0);
  });

  it.each(dynamicLicenses.map((u) => u.id))(
    "dynamic license '%s' has prices: [0] and dynamicPrice: true",
    (id) => {
      const upgrade = dynamicLicenses.find((u) => u.id === id)!;
      expect(upgrade.prices).toEqual([0]);
      expect((upgrade as unknown as Record<string, unknown>)["dynamicPrice"]).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// defrag is dynamic (sanity check for the above)
// ---------------------------------------------------------------------------

describe("defrag license — known dynamic-priced entry", () => {
  it("defrag has unlockPrice='dynamic' in registry", () => {
    expect(MINIGAME_REGISTRY["defrag"].unlockPrice).toBe("dynamic");
  });

  it("defrag-license exists in META_UPGRADE_POOL with prices: [0]", () => {
    const defragLicense = META_UPGRADE_POOL.find((u) => u.id === "defrag-license");
    expect(defragLicense).toBeDefined();
    expect(defragLicense!.prices).toEqual([0]);
  });
});
