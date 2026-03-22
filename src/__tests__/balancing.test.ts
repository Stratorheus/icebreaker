import { describe, it, expect } from "vitest";
import {
  getMinigamesPerFloor,
  getDataReward,
  getMilestoneBonus,
  getRunShopPrice,
  getTimeLimit,
  getEffectiveDifficulty,
  getEffectiveTimeLimit,
  getEffectiveDamage,
  getDataDrip,
  getCreditsSaved,
  getStartingCredits,
  getEffectiveDataReward,
  getDeathPenaltyPct,
  getEffectiveCredits,
} from "@/data/balancing";

// ---------------------------------------------------------------------------
// getMinigamesPerFloor
// ---------------------------------------------------------------------------
describe("getMinigamesPerFloor", () => {
  it("returns 1 on floor 0", () => {
    expect(getMinigamesPerFloor(0)).toBe(1);
  });

  it("scales linearly: floor 3 → 4", () => {
    expect(getMinigamesPerFloor(3)).toBe(4);
  });

  it("caps at 8 for floor 7", () => {
    expect(getMinigamesPerFloor(7)).toBe(8);
  });

  it("caps at 8 for floor 20 (high values)", () => {
    expect(getMinigamesPerFloor(20)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// getDataReward
// ---------------------------------------------------------------------------
describe("getDataReward", () => {
  it("returns 3 on floor 0", () => {
    expect(getDataReward(0)).toBe(3);
  });

  it("returns correct value on floor 1 (3 + 1*4 = 7)", () => {
    expect(getDataReward(1)).toBe(7);
  });

  it("returns correct value on floor 5 (3 + 5*4 = 23)", () => {
    expect(getDataReward(5)).toBe(23);
  });

  it("returns correct value on floor 10 (3 + 10*4 = 43)", () => {
    expect(getDataReward(10)).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// getMilestoneBonus
// ---------------------------------------------------------------------------
describe("getMilestoneBonus", () => {
  it("returns 0 for floor 0 (not eligible)", () => {
    expect(getMilestoneBonus(0)).toBe(0);
  });

  it("returns 0 for non-milestone floors", () => {
    expect(getMilestoneBonus(1)).toBe(0);
    expect(getMilestoneBonus(3)).toBe(0);
    expect(getMilestoneBonus(7)).toBe(0);
  });

  it("returns 25 for floor 5", () => {
    expect(getMilestoneBonus(5)).toBe(25);
  });

  it("returns 50 for floor 10", () => {
    expect(getMilestoneBonus(10)).toBe(50);
  });

  it("returns 75 for floor 15", () => {
    expect(getMilestoneBonus(15)).toBe(75);
  });

  it("returns 250 for floor 50", () => {
    expect(getMilestoneBonus(50)).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// getRunShopPrice
// ---------------------------------------------------------------------------
describe("getRunShopPrice", () => {
  it("returns basePrice unchanged on floor 0", () => {
    expect(getRunShopPrice(100, 0)).toBe(100);
  });

  it("scales correctly on floor 1: 100 * 1.25 * 1.01 = 126.25 → 126", () => {
    expect(getRunShopPrice(100, 1)).toBe(Math.round(100 * 1.25 * 1.01));
  });

  it("scales correctly on floor 4: quadratic term 4*4*0.01=0.16", () => {
    const expected = Math.round(100 * (1 + 4 * 0.25) * (1 + 16 * 0.01));
    expect(getRunShopPrice(100, 4)).toBe(expected);
  });

  it("scales a different basePrice correctly on floor 2", () => {
    const expected = Math.round(50 * (1 + 2 * 0.25) * (1 + 4 * 0.01));
    expect(getRunShopPrice(50, 2)).toBe(expected);
  });

  it("grows significantly at floor 10 (quadratic term 10*10*0.01=1.0 → doubles)", () => {
    const result = getRunShopPrice(100, 10);
    expect(result).toBeGreaterThan(300); // 100 * 3.5 * 2.0 = 700
  });
});

// ---------------------------------------------------------------------------
// getTimeLimit
// ---------------------------------------------------------------------------
describe("getTimeLimit", () => {
  it("returns full baseTime when difficulty=0 and no floor", () => {
    expect(getTimeLimit(30, 0)).toBe(30);
  });

  it("returns 60% of baseTime when difficulty=1", () => {
    expect(getTimeLimit(30, 1)).toBe(18); // 30 * (1 - 0.4) = 18
  });

  it("returns correct value for difficulty=0.5", () => {
    // 20 * (1 - 0.5*0.4) = 20 * 0.8 = 16
    expect(getTimeLimit(20, 0.5)).toBe(16);
  });

  it("applies no floor scale for floor <= 15", () => {
    expect(getTimeLimit(30, 0, 15)).toBe(30);
    expect(getTimeLimit(30, 0, 10)).toBe(30);
  });

  it("applies floor scale at floor 16: 1 - (16-15)*0.02 = 0.98", () => {
    expect(getTimeLimit(30, 0, 16)).toBe(Math.round(30 * 0.98));
  });

  it("applies floor scale at floor 20: 1 - (20-15)*0.02 = 0.90", () => {
    expect(getTimeLimit(30, 0, 20)).toBe(Math.round(30 * 0.90));
  });

  it("clamps floor scale to 0.4 minimum at floor 50", () => {
    // 1 - (50-15)*0.02 = 1 - 0.70 = 0.30 < 0.4, so clamped to 0.4
    expect(getTimeLimit(30, 0, 50)).toBe(Math.round(30 * 0.4));
  });

  it("floor=0 (falsy) applies no floor scale", () => {
    expect(getTimeLimit(30, 0, 0)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveDifficulty
// ---------------------------------------------------------------------------
describe("getEffectiveDifficulty", () => {
  it("returns base difficulty when tier=0 (no reducer)", () => {
    // getDifficulty(0) = min(0.1 + 0/15, 1.0) = 0.1
    expect(getEffectiveDifficulty(0, 0)).toBeCloseTo(0.1);
  });

  it("reduces difficulty by 5% per tier at floor 0", () => {
    const base = Math.min(0.1 + 0 / 15, 1.0);
    expect(getEffectiveDifficulty(0, 1)).toBeCloseTo(base * 0.95);
    expect(getEffectiveDifficulty(0, 2)).toBeCloseTo(base * Math.pow(0.95, 2));
  });

  it("caps difficulty at 1.0 for very high floors (before reduction)", () => {
    // getDifficulty(15) = min(0.1+1, 1.0) = 1.0
    expect(getEffectiveDifficulty(15, 0)).toBeCloseTo(1.0);
  });

  it("applies reducer multiplicatively", () => {
    const tier = 5;
    const base = Math.min(0.1 + 10 / 15, 1.0);
    expect(getEffectiveDifficulty(10, tier)).toBeCloseTo(base * Math.pow(0.95, tier));
  });
});

// ---------------------------------------------------------------------------
// getEffectiveTimeLimit
// ---------------------------------------------------------------------------
describe("getEffectiveTimeLimit", () => {
  it("returns base time when no bonuses", () => {
    // floor 0, difficulty 0 → getTimeLimit(30, 0, 0) = 30
    expect(getEffectiveTimeLimit(30, 0, 0, 0, 0, 0)).toBe(30);
  });

  it("adds flat timeSiphonBonus before multipliers", () => {
    // base=30, +5 siphon → 35, tier=0, pct=0 → 35
    expect(getEffectiveTimeLimit(30, 0, 0, 5, 0, 0)).toBe(35);
  });

  it("applies cascadeClockPct percentage", () => {
    // base=30, siphon=0, pct=0.1 → 30*1.1 = 33
    expect(getEffectiveTimeLimit(30, 0, 0, 0, 0.1, 0)).toBe(33);
  });

  it("applies delayInjectorTier compound growth", () => {
    // base=30, tier=1 → 30 * 1.03 = 30.9 → rounded 31
    expect(getEffectiveTimeLimit(30, 0, 0, 0, 0, 1)).toBe(Math.round(30 * 1.03));
  });

  it("stacks all three bonuses in correct order", () => {
    // base=getTimeLimit(20,0.5,0)=16, +4 siphon=20, pct=0.1 → 22, tier=2 → 22*1.03^2
    const base = getTimeLimit(20, 0.5, 0);
    const expected = Math.round((base + 4) * 1.1 * Math.pow(1.03, 2));
    expect(getEffectiveTimeLimit(20, 0.5, 0, 4, 0.1, 2)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveDamage
// ---------------------------------------------------------------------------
describe("getEffectiveDamage", () => {
  it("returns full damage at tier 0 (no armor)", () => {
    // getDamage(0) = 20 + 0*4 = 20, reduction=0 → 20
    expect(getEffectiveDamage(0, 0)).toBe(20);
  });

  it("applies 5% reduction at tier 1", () => {
    // getDamage(0) = 20, 20*(1-0.05) = 19
    expect(getEffectiveDamage(0, 1)).toBe(Math.round(20 * 0.95));
  });

  it("applies 25% reduction at tier 5 (max)", () => {
    // getDamage(5) = 20+20=40, 40*0.75=30
    expect(getEffectiveDamage(5, 5)).toBe(Math.round(40 * 0.75));
  });

  it("clamps armor tier at maximum (5)", () => {
    // Tier 6 should behave like tier 5 (clamp via Math.min)
    expect(getEffectiveDamage(0, 6)).toBe(getEffectiveDamage(0, 5));
  });

  it("scales with floor", () => {
    // floor 10: getDamage(10)=60, tier 0: 60
    expect(getEffectiveDamage(10, 0)).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// getDataDrip
// ---------------------------------------------------------------------------
describe("getDataDrip", () => {
  it("returns 1 on floor 0", () => {
    expect(getDataDrip(0)).toBe(1);
  });

  it("returns correct value on floor 1 (1 + 0.8 = 1.8 → 2)", () => {
    expect(getDataDrip(1)).toBe(2);
  });

  it("returns correct value on floor 5 (1 + 4.0 = 5.0 → 5)", () => {
    expect(getDataDrip(5)).toBe(5);
  });

  it("returns correct value on floor 10 (1 + 8.0 = 9.0 → 9)", () => {
    expect(getDataDrip(10)).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// getCreditsSaved
// ---------------------------------------------------------------------------
describe("getCreditsSaved", () => {
  it("returns 0 for 0 credits", () => {
    expect(getCreditsSaved(0)).toBe(0);
  });

  it("returns 8% (floor) for 100 credits → 8", () => {
    expect(getCreditsSaved(100)).toBe(8);
  });

  it("floors partial results (e.g., 50 credits → floor(4.0) = 4)", () => {
    expect(getCreditsSaved(50)).toBe(4);
  });

  it("floors partial results (e.g., 13 credits → floor(1.04) = 1)", () => {
    expect(getCreditsSaved(13)).toBe(Math.floor(13 * 0.08));
  });
});

// ---------------------------------------------------------------------------
// getStartingCredits
// ---------------------------------------------------------------------------
describe("getStartingCredits", () => {
  it("returns 25 at tier 0 (no head start)", () => {
    expect(getStartingCredits(0)).toBe(25);
  });

  it("returns 75 at tier 1 (25 + 50)", () => {
    expect(getStartingCredits(1)).toBe(75);
  });

  it("returns 150 at tier 2 (25 + 125)", () => {
    expect(getStartingCredits(2)).toBe(150);
  });

  it("returns 325 at tier 3 (25 + 300)", () => {
    expect(getStartingCredits(3)).toBe(325);
  });

  it("returns 625 at tier 4 (25 + 600)", () => {
    expect(getStartingCredits(4)).toBe(625);
  });

  it("returns 1025 at tier 5 (25 + 1000)", () => {
    expect(getStartingCredits(5)).toBe(1025);
  });

  it("clamps at tier 5 for higher tiers", () => {
    expect(getStartingCredits(99)).toBe(getStartingCredits(5));
  });
});

// ---------------------------------------------------------------------------
// getEffectiveDataReward
// ---------------------------------------------------------------------------
describe("getEffectiveDataReward", () => {
  it("returns base reward at tier 0", () => {
    expect(getEffectiveDataReward(0, 0)).toBe(getDataReward(0));
  });

  it("applies 3% compound bonus per tier", () => {
    const base = getDataReward(5);
    expect(getEffectiveDataReward(5, 1)).toBe(Math.round(base * 1.03));
    expect(getEffectiveDataReward(5, 3)).toBe(Math.round(base * Math.pow(1.03, 3)));
  });

  it("stacks correctly at high tier", () => {
    const base = getDataReward(10);
    expect(getEffectiveDataReward(10, 5)).toBe(Math.round(base * Math.pow(1.03, 5)));
  });
});

// ---------------------------------------------------------------------------
// getDeathPenaltyPct
// ---------------------------------------------------------------------------
describe("getDeathPenaltyPct", () => {
  it("returns 0 when quitting voluntarily regardless of tier", () => {
    expect(getDeathPenaltyPct(0, true)).toBe(0);
    expect(getDeathPenaltyPct(5, true)).toBe(0);
  });

  it("returns 25% at tier 0 (no data recovery)", () => {
    expect(getDeathPenaltyPct(0, false)).toBe(0.25);
  });

  it("reduces by 2.5% per tier", () => {
    expect(getDeathPenaltyPct(1, false)).toBeCloseTo(0.225);
    expect(getDeathPenaltyPct(2, false)).toBeCloseTo(0.20);
  });

  it("clamps to minimum of 10%", () => {
    // tier 6: 0.25 - 6*0.025 = 0.25 - 0.15 = 0.10 → exactly at minimum
    expect(getDeathPenaltyPct(6, false)).toBe(0.10);
    // tier 10: would be 0.25 - 0.25 = 0 but clamps to 0.10
    expect(getDeathPenaltyPct(10, false)).toBe(0.10);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveCredits
// ---------------------------------------------------------------------------
describe("getEffectiveCredits", () => {
  it("returns base credits with no bonuses (tier=0, speedTax=0, unlockBonus=0)", () => {
    // getCredits(5000, 0.5) = Math.round(20*(1+0.5) * (1 + max(0, 1-5000/10000)*0.5))
    // = Math.round(30 * (1 + 0.5*0.5)) = Math.round(30 * 1.25) = 38
    const result = getEffectiveCredits(5000, 0.5, 0, 0, 0);
    expect(result).toBe(38);
  });

  it("creditTier compounds at 3% per tier", () => {
    const base = getEffectiveCredits(5000, 0.5, 0, 0, 0);
    const withTier = getEffectiveCredits(5000, 0.5, 1, 0, 0);
    expect(withTier).toBe(Math.round(base * 1.03));
  });

  it("speedTaxTier adds 5% flat per tier before multipliers", () => {
    const withoutTax = getEffectiveCredits(5000, 0.5, 0, 0, 0);
    const withTax = getEffectiveCredits(5000, 0.5, 0, 1, 0);
    expect(withTax).toBeGreaterThan(withoutTax);
  });

  it("unlockBonus multiplies the final result", () => {
    const without = getEffectiveCredits(5000, 0.5, 0, 0, 0);
    const withBonus = getEffectiveCredits(5000, 0.5, 0, 0, 0.5);
    expect(withBonus).toBe(Math.round(without * 1.5));
  });

  it("returns higher credits at low timeMs (speed bonus)", () => {
    const slow = getEffectiveCredits(9000, 0.5, 0, 0, 0);
    const fast = getEffectiveCredits(1000, 0.5, 0, 0, 0);
    expect(fast).toBeGreaterThan(slow);
  });
});
