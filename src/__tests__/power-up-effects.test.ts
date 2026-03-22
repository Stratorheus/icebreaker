import { describe, it, expect } from "vitest";
import { applyShield, checkSkip, getMetaBonus } from "@/lib/power-up-effects";
import type { PowerUpInstance } from "@/types/game";

// ---------------------------------------------------------------------------
// Helpers for constructing test power-up instances
// ---------------------------------------------------------------------------

function makeShield(id = "pu-shield"): PowerUpInstance {
  return {
    id,
    type: "firewall-patch",
    name: "Firewall Patch",
    description: "Full damage block.",
    effect: { type: "shield", value: 0 },
  };
}

function makeDamageReductionStacked(
  id = "pu-stacked",
  value = 0.5,
  remainingUses = 3,
): PowerUpInstance {
  return {
    id,
    type: "redundancy-layer",
    name: "Redundancy Layer",
    description: "Partial reduction, multi-use.",
    effect: { type: "damage-reduction-stacked", value },
    remainingUses,
  };
}

function makeDamageReduction(id = "pu-reducer", value = 0.6): PowerUpInstance {
  return {
    id,
    type: "damage-reducer",
    name: "Damage Reducer",
    description: "Single-use partial reduction.",
    effect: { type: "damage-reduction", value },
  };
}

function makeSkipFloor(id = "pu-warp", value = 0.15): PowerUpInstance {
  return {
    id,
    type: "warp-gate",
    name: "Warp Gate",
    description: "Skip entire floor at 15% rewards.",
    effect: { type: "skip-floor", value },
  };
}

function makeSkipSilent(id = "pu-null"): PowerUpInstance {
  return {
    id,
    type: "null-route",
    name: "Null Route",
    description: "Auto-pass with full rewards.",
    effect: { type: "skip-silent", value: 1 },
  };
}

function makeSkip(id = "pu-backdoor"): PowerUpInstance {
  return {
    id,
    type: "backdoor",
    name: "Backdoor",
    description: "Skip without rewards.",
    effect: { type: "skip", value: 0 },
  };
}

// ---------------------------------------------------------------------------
// applyShield
// ---------------------------------------------------------------------------

describe("applyShield — no shield in inventory", () => {
  it("returns full damage with all nulls when inventory is empty", () => {
    const result = applyShield([], 50);
    expect(result).toEqual({ damage: 50, consumed: null, decremented: null });
  });

  it("returns full damage with irrelevant power-ups in inventory", () => {
    const unrelated: PowerUpInstance = {
      id: "pu-time",
      type: "time-boost",
      name: "Time Boost",
      description: "Extra time.",
      effect: { type: "time-bonus", value: 5 },
    };
    const result = applyShield([unrelated], 30);
    expect(result).toEqual({ damage: 30, consumed: null, decremented: null });
  });
});

describe("applyShield — full shield (priority 1)", () => {
  it("blocks all damage and consumes the shield", () => {
    const shield = makeShield();
    const result = applyShield([shield], 80);
    expect(result.damage).toBe(0);
    expect(result.consumed).toBe("pu-shield");
    expect(result.decremented).toBeNull();
  });

  it("shield takes priority over damage-reduction-stacked", () => {
    const shield = makeShield();
    const stacked = makeDamageReductionStacked();
    const result = applyShield([shield, stacked], 100);
    expect(result.damage).toBe(0);
    expect(result.consumed).toBe("pu-shield");
  });

  it("shield takes priority over damage-reduction", () => {
    const shield = makeShield();
    const reducer = makeDamageReduction();
    const result = applyShield([shield, reducer], 100);
    expect(result.damage).toBe(0);
    expect(result.consumed).toBe("pu-shield");
  });
});

describe("applyShield — damage-reduction-stacked (priority 2)", () => {
  it("reduces damage by factor and decrements uses when > 1 remaining", () => {
    const stacked = makeDamageReductionStacked("pu-stacked", 0.5, 3);
    const result = applyShield([stacked], 100);
    expect(result.damage).toBe(50);
    expect(result.consumed).toBeNull();
    expect(result.decremented).toBe("pu-stacked");
  });

  it("reduces damage and consumes when only 1 use remaining", () => {
    const stacked = makeDamageReductionStacked("pu-stacked", 0.5, 1);
    const result = applyShield([stacked], 100);
    expect(result.damage).toBe(50);
    expect(result.consumed).toBe("pu-stacked");
    expect(result.decremented).toBeNull();
  });

  it("damage is clamped to minimum 0 for negative base", () => {
    const stacked = makeDamageReductionStacked("pu-stacked", 0.5, 2);
    const result = applyShield([stacked], -10);
    expect(result.damage).toBe(0);
  });

  it("takes priority over damage-reduction when no shield present", () => {
    const stacked = makeDamageReductionStacked();
    const reducer = makeDamageReduction();
    const result = applyShield([stacked, reducer], 100);
    expect(result.decremented).toBe("pu-stacked");
  });
});

describe("applyShield — damage-reduction (priority 3)", () => {
  it("reduces damage by factor and consumes", () => {
    const reducer = makeDamageReduction("pu-reducer", 0.6);
    const result = applyShield([reducer], 100);
    expect(result.damage).toBe(60);
    expect(result.consumed).toBe("pu-reducer");
    expect(result.decremented).toBeNull();
  });

  it("clamps damage to minimum 0", () => {
    const reducer = makeDamageReduction("pu-reducer", 0);
    const result = applyShield([reducer], 100);
    expect(result.damage).toBe(0);
    expect(result.consumed).toBe("pu-reducer");
  });
});

// ---------------------------------------------------------------------------
// checkSkip
// ---------------------------------------------------------------------------

describe("checkSkip — no skip in inventory", () => {
  it("returns skip=false with full reward fraction", () => {
    const result = checkSkip([]);
    expect(result).toEqual({
      skip: false,
      consumeId: null,
      asSilentSuccess: false,
      skipFloor: false,
      rewardFraction: 1,
    });
  });

  it("returns skip=false when only non-skip items present", () => {
    const shield = makeShield();
    const result = checkSkip([shield]);
    expect(result.skip).toBe(false);
  });
});

describe("checkSkip — skip-floor / Warp Gate (priority 1)", () => {
  it("sets skipFloor=true with 15% reward fraction", () => {
    const warp = makeSkipFloor("pu-warp", 0.15);
    const result = checkSkip([warp]);
    expect(result.skip).toBe(true);
    expect(result.consumeId).toBe("pu-warp");
    expect(result.asSilentSuccess).toBe(true);
    expect(result.skipFloor).toBe(true);
    expect(result.rewardFraction).toBe(0.15);
  });

  it("takes priority over skip-silent", () => {
    const warp = makeSkipFloor();
    const nullRoute = makeSkipSilent();
    const result = checkSkip([warp, nullRoute]);
    expect(result.skipFloor).toBe(true);
    expect(result.consumeId).toBe("pu-warp");
  });

  it("takes priority over skip (backdoor)", () => {
    const warp = makeSkipFloor();
    const backdoor = makeSkip();
    const result = checkSkip([warp, backdoor]);
    expect(result.skipFloor).toBe(true);
  });
});

describe("checkSkip — skip-silent / Null Route (priority 2)", () => {
  it("sets skip=true, skipFloor=false, rewardFraction=1", () => {
    const nullRoute = makeSkipSilent();
    const result = checkSkip([nullRoute]);
    expect(result.skip).toBe(true);
    expect(result.consumeId).toBe("pu-null");
    expect(result.asSilentSuccess).toBe(true);
    expect(result.skipFloor).toBe(false);
    expect(result.rewardFraction).toBe(1);
  });

  it("takes priority over skip (backdoor)", () => {
    const nullRoute = makeSkipSilent();
    const backdoor = makeSkip();
    const result = checkSkip([nullRoute, backdoor]);
    expect(result.consumeId).toBe("pu-null");
    expect(result.rewardFraction).toBe(1);
  });
});

describe("checkSkip — skip / Backdoor (priority 3)", () => {
  it("sets skip=true, skipFloor=false, rewardFraction=0", () => {
    const backdoor = makeSkip();
    const result = checkSkip([backdoor]);
    expect(result.skip).toBe(true);
    expect(result.consumeId).toBe("pu-backdoor");
    expect(result.asSilentSuccess).toBe(true);
    expect(result.skipFloor).toBe(false);
    expect(result.rewardFraction).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMetaBonus
// ---------------------------------------------------------------------------

describe("getMetaBonus", () => {
  it("returns 0 for an upgrade not in the purchased map", () => {
    expect(getMetaBonus({}, "difficulty-reducer")).toBe(0);
  });

  it("returns the tier value for a purchased upgrade", () => {
    const purchased = { "difficulty-reducer": 3, "data-siphon": 1 };
    expect(getMetaBonus(purchased, "difficulty-reducer")).toBe(3);
    expect(getMetaBonus(purchased, "data-siphon")).toBe(1);
  });

  it("returns 0 for a different key even when map is non-empty", () => {
    const purchased = { "some-upgrade": 5 };
    expect(getMetaBonus(purchased, "other-upgrade")).toBe(0);
  });
});
