import { describe, it, expect } from "vitest";
import {
  MINIGAME_REGISTRY,
  MINIGAME_COMPONENTS,
  BASE_TIME_LIMITS,
  STARTING_MINIGAMES,
  UNLOCKABLE_MINIGAMES,
  ALL_MINIGAMES,
  getMinigameDisplayName,
  getMinigameBriefing,
  buildMetaPowerUps,
} from "@/data/minigames/registry";
import type { MinigameType } from "@/types/game";

// All 15 expected minigame types
const ALL_EXPECTED_TYPES: MinigameType[] = [
  "slash-timing",
  "close-brackets",
  "type-backward",
  "match-arrows",
  "find-symbol",
  "mine-sweep",
  "wire-cutting",
  "cipher-crack",
  "defrag",
  "network-trace",
  "signal-echo",
  "checksum-verify",
  "port-scan",
  "subnet-scan",
  "cipher-crack-v2",
];

// ---------------------------------------------------------------------------
// MINIGAME_REGISTRY completeness
// ---------------------------------------------------------------------------

describe("MINIGAME_REGISTRY completeness", () => {
  it("has exactly 15 entries", () => {
    expect(Object.keys(MINIGAME_REGISTRY)).toHaveLength(15);
  });

  it.each(ALL_EXPECTED_TYPES)("has an entry for '%s'", (type) => {
    expect(MINIGAME_REGISTRY[type]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Required config fields
// ---------------------------------------------------------------------------

describe("MINIGAME_REGISTRY config fields", () => {
  it.each(ALL_EXPECTED_TYPES)("config '%s' has correct id", (type) => {
    expect(MINIGAME_REGISTRY[type].id).toBe(type);
  });

  it.each(ALL_EXPECTED_TYPES)("config '%s' has a non-empty displayName", (type) => {
    expect(MINIGAME_REGISTRY[type].displayName).toBeTruthy();
    expect(typeof MINIGAME_REGISTRY[type].displayName).toBe("string");
  });

  it.each(ALL_EXPECTED_TYPES)("config '%s' has a component", (type) => {
    expect(MINIGAME_REGISTRY[type].component).toBeDefined();
    expect(typeof MINIGAME_REGISTRY[type].component).toBe("function");
  });

  it.each(ALL_EXPECTED_TYPES)("config '%s' has a positive baseTimeLimit", (type) => {
    expect(MINIGAME_REGISTRY[type].baseTimeLimit).toBeGreaterThan(0);
  });

  it.each(ALL_EXPECTED_TYPES)("config '%s' has briefing with rules, controls, tips, hint", (type) => {
    const briefing = MINIGAME_REGISTRY[type].briefing;
    expect(briefing).toBeDefined();
    expect(Array.isArray(briefing.rules)).toBe(true);
    expect(briefing.rules.length).toBeGreaterThan(0);
    expect(briefing.controls.desktop).toBeTruthy();
    expect(briefing.controls.touch).toBeTruthy();
    expect(Array.isArray(briefing.tips)).toBe(true);
    expect(briefing.hint.desktop).toBeTruthy();
    expect(briefing.hint.touch).toBeTruthy();
  });

  it.each(ALL_EXPECTED_TYPES)("config '%s' has metaUpgrades array", (type) => {
    expect(Array.isArray(MINIGAME_REGISTRY[type].metaUpgrades)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Derived constants
// ---------------------------------------------------------------------------

describe("MINIGAME_COMPONENTS", () => {
  it("has an entry for every minigame type", () => {
    expect(Object.keys(MINIGAME_COMPONENTS)).toHaveLength(15);
  });

  it.each(ALL_EXPECTED_TYPES)("has a component function for '%s'", (type) => {
    expect(typeof MINIGAME_COMPONENTS[type]).toBe("function");
  });
});

describe("BASE_TIME_LIMITS", () => {
  it("has an entry for every minigame type", () => {
    expect(Object.keys(BASE_TIME_LIMITS)).toHaveLength(15);
  });

  it.each(ALL_EXPECTED_TYPES)("matches registry baseTimeLimit for '%s'", (type) => {
    expect(BASE_TIME_LIMITS[type]).toBe(MINIGAME_REGISTRY[type].baseTimeLimit);
  });
});

describe("STARTING_MINIGAMES + UNLOCKABLE_MINIGAMES", () => {
  it("union covers all 15 minigames", () => {
    const all = [...STARTING_MINIGAMES, ...UNLOCKABLE_MINIGAMES].sort();
    expect(all).toHaveLength(15);
    expect(all).toEqual([...ALL_MINIGAMES].sort());
  });

  it("no overlap between starting and unlockable", () => {
    const startingSet = new Set(STARTING_MINIGAMES);
    const overlap = UNLOCKABLE_MINIGAMES.filter((t) => startingSet.has(t));
    expect(overlap).toHaveLength(0);
  });

  it("ALL_MINIGAMES has 15 entries", () => {
    expect(ALL_MINIGAMES).toHaveLength(15);
  });

  it("slash-timing is a starting minigame", () => {
    expect(STARTING_MINIGAMES).toContain("slash-timing");
  });

  it("defrag is an unlockable minigame", () => {
    expect(UNLOCKABLE_MINIGAMES).toContain("defrag");
  });
});

// ---------------------------------------------------------------------------
// No duplicate metaUpgrade IDs across all configs
// ---------------------------------------------------------------------------

describe("metaUpgrade ID uniqueness", () => {
  it("has no duplicate metaUpgrade IDs across all minigame configs", () => {
    const allIds: string[] = [];
    for (const type of ALL_EXPECTED_TYPES) {
      for (const upgrade of MINIGAME_REGISTRY[type].metaUpgrades) {
        allIds.push(upgrade.id);
      }
    }
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});

// ---------------------------------------------------------------------------
// Lookup functions
// ---------------------------------------------------------------------------

describe("getMinigameDisplayName", () => {
  it("returns the correct display name for slash-timing", () => {
    expect(getMinigameDisplayName("slash-timing")).toBe("Slash Timing");
  });

  it("returns a non-empty string for all types", () => {
    for (const type of ALL_EXPECTED_TYPES) {
      expect(getMinigameDisplayName(type)).toBeTruthy();
    }
  });
});

describe("getMinigameBriefing", () => {
  it("returns the briefing object for a minigame", () => {
    const briefing = getMinigameBriefing("slash-timing");
    expect(briefing).toBe(MINIGAME_REGISTRY["slash-timing"].briefing);
  });
});

// ---------------------------------------------------------------------------
// buildMetaPowerUps
// ---------------------------------------------------------------------------

describe("buildMetaPowerUps", () => {
  it("returns empty array when no upgrades purchased (all tiers 0)", () => {
    const result = buildMetaPowerUps({}, "slash-timing");
    expect(result).toHaveLength(0);
  });

  it("returns empty array when purchasedUpgrades has 0 tier for all upgrades", () => {
    const purchased = { "slash-window": 0 };
    const result = buildMetaPowerUps(purchased, "slash-timing");
    expect(result).toHaveLength(0);
  });

  it("returns a power-up when an upgrade is purchased at tier 1", () => {
    const purchased = { "slash-window": 1 };
    const result = buildMetaPowerUps(purchased, "slash-timing");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("meta-slash-window");
    expect(result[0].type).toBe("meta-slash-window");
    expect(result[0].name).toBe("Slash Window");
  });

  it("uses the correct effect for the purchased tier", () => {
    // mine-radar has 4 tiers; tier 2 should have value 0.50
    const purchased = { "mine-radar": 2 };
    const result = buildMetaPowerUps(purchased, "defrag");
    expect(result).toHaveLength(1);
    expect(result[0].effect.value).toBe(0.50);
    expect(result[0].effect.type).toBe("minigame-specific");
    expect(result[0].effect.minigame).toBe("defrag");
  });

  it("uses the last effect when tier exceeds effects array length", () => {
    // mine-radar has 4 effects; purchasing at tier 4 (max) should give last effect (value=1.0)
    const purchased = { "mine-radar": 4 };
    const result = buildMetaPowerUps(purchased, "defrag");
    expect(result[0].effect.value).toBe(1.0);
  });

  it("returns only purchased upgrades, not all config upgrades", () => {
    // checksum-verify has error-margin AND range-hint; only purchase one
    const purchased = { "error-margin": 3 };
    const result = buildMetaPowerUps(purchased, "checksum-verify");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("meta-error-margin");
  });

  it("returns multiple power-ups when multiple upgrades purchased", () => {
    // checksum-verify has error-margin AND range-hint
    const purchased = { "error-margin": 1, "range-hint": 2 };
    const result = buildMetaPowerUps(purchased, "checksum-verify");
    expect(result).toHaveLength(2);
    const ids = result.map((p) => p.id);
    expect(ids).toContain("meta-error-margin");
    expect(ids).toContain("meta-range-hint");
  });

  it("overrides mode: skips upgrades not in activeIds", () => {
    const overrides = {
      activeIds: new Set<string>(["slash-window"]),
      tierMap: { "slash-window": 1 },
    };
    const result = buildMetaPowerUps({}, "slash-timing", overrides);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("meta-slash-window");
  });

  it("overrides mode: uses tierMap tier instead of purchasedUpgrades", () => {
    // mine-radar: tier 3 from overrides → value should be 0.75
    const overrides = {
      activeIds: new Set<string>(["mine-radar"]),
      tierMap: { "mine-radar": 3 },
    };
    const result = buildMetaPowerUps({}, "defrag", overrides);
    expect(result).toHaveLength(1);
    expect(result[0].effect.value).toBe(0.75);
  });

  it("overrides mode: excludes upgrades not in activeIds even if in tierMap", () => {
    const overrides = {
      activeIds: new Set<string>(), // nothing active
      tierMap: { "slash-window": 1 },
    };
    const result = buildMetaPowerUps({}, "slash-timing", overrides);
    expect(result).toHaveLength(0);
  });
});
