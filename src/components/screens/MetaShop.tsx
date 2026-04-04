import { useEffect, useMemo } from "react";
import { useGameStore } from "@/store/game-store";
import { META_UPGRADE_POOL } from "@/data/upgrades/registry";
import { STARTING_MINIGAMES } from "@/data/minigames/registry";
import { cn } from "@/lib/utils";
import type { MetaUpgrade } from "@/types/shop";
import { Hexagon } from "lucide-react";

import { CLI_PROMPT } from "@/lib/constants";
import { evaluateAndAwardAchievements } from "@/hooks/use-achievement-check";
import { showHintOnce } from "@/lib/hints";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

interface CategoryConfig {
  label: string;
  description: string;
  colors: {
    border: string;
    text: string;
    bg: string;
    badge: string;
    glow: string;
  };
}

const CATEGORIES: Record<MetaUpgrade["category"], CategoryConfig> = {
  stat: {
    label: "STAT UPGRADES",
    description: "Permanent boosts that persist across runs",
    colors: {
      border: "border-cyber-cyan/40",
      text: "text-cyber-cyan",
      bg: "bg-cyber-cyan/5",
      badge: "bg-cyber-cyan/15 text-cyber-cyan",
      glow: "shadow-[0_0_12px_rgba(0,255,255,0.15)]",
    },
  },
  "starting-bonus": {
    label: "STARTING BONUSES",
    description: "Advantages applied at the start of each run",
    colors: {
      border: "border-cyber-green/40",
      text: "text-cyber-green",
      bg: "bg-cyber-green/5",
      badge: "bg-cyber-green/15 text-cyber-green",
      glow: "shadow-[0_0_12px_rgba(0,255,65,0.15)]",
    },
  },
  "minigame-unlock": {
    label: "PROTOCOL LICENSES",
    description: "Unlock new protocols — expands the pool, reduces repetition, grants +5 max HP per unlock, and increases credit earnings by +5% per unlock",
    colors: {
      border: "border-cyber-magenta/40",
      text: "text-cyber-magenta",
      bg: "bg-cyber-magenta/5",
      badge: "bg-cyber-magenta/15 text-cyber-magenta",
      glow: "shadow-[0_0_12px_rgba(255,0,102,0.15)]",
    },
  },
  "game-specific": {
    label: "GAME MODULES",
    description: "Protocol-specific advantages and assists",
    colors: {
      border: "border-cyber-orange/40",
      text: "text-cyber-orange",
      bg: "bg-cyber-orange/5",
      badge: "bg-cyber-orange/15 text-cyber-orange",
      glow: "shadow-[0_0_12px_rgba(255,102,0,0.15)]",
    },
  },
};

const CATEGORY_ORDER: MetaUpgrade["category"][] = [
  "minigame-unlock",
  "stat",
  "starting-bonus",
  "game-specific",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build tier indicator: ●●○ for tier 2 of 3 */
function TierIndicator({
  current,
  max,
  colorClass,
}: {
  current: number;
  max: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-1" aria-label={`Tier ${current} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn(
            "text-sm leading-none",
            i < current ? colorClass : "text-white/15",
          )}
        >
          {i < current ? "\u25CF" : "\u25CB"}
        </span>
      ))}
    </div>
  );
}

/** Group upgrades by category, preserving CATEGORY_ORDER */
function groupByCategory(upgrades: MetaUpgrade[]) {
  const grouped = new Map<MetaUpgrade["category"], MetaUpgrade[]>();
  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, []);
  }
  for (const u of upgrades) {
    grouped.get(u.category)?.push(u);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// MetaShop component
// ---------------------------------------------------------------------------

export function MetaShop() {
  const data = useGameStore((s) => s.data);
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);
  const spendData = useGameStore((s) => s.spendData);
  const purchaseUpgrade = useGameStore((s) => s.purchaseUpgrade);
  const unlockMinigame = useGameStore((s) => s.unlockMinigame);
  const setStatus = useGameStore((s) => s.setStatus);
  const trainingMinigame = useGameStore((s) => s.trainingMinigame);
  const setTrainingMinigame = useGameStore((s) => s.setTrainingMinigame);
  const setTrainingOrigin = useGameStore((s) => s.setTrainingOrigin);
  const unlockedMinigames = useGameStore((s) => s.unlockedMinigames);

  useEffect(() => {
    showHintOnce("hint-meta-shop", "TIP: Unlock new PROTOCOLS here to add them to your run rotation.");
  }, []);

  const handleBack = () => {
    if (trainingMinigame) {
      setStatus("training"); // return to training briefing
    } else {
      setStatus("menu");
    }
  };

  const grouped = useMemo(() => groupByCategory(META_UPGRADE_POOL), []);

  // Total purchases across all upgrades (sum of all tiers bought)
  const totalPurchasesMade = useMemo(() => {
    return Object.values(purchasedUpgrades).reduce((sum, tier) => sum + tier, 0);
  }, [purchasedUpgrades]);

  // How many minigame unlocks the player currently owns (beyond the 5 starting games)
  const unlocksOwned = unlockedMinigames.length - STARTING_MINIGAMES.length;

  /** Compute scaled price: basePrice * (1 + totalPurchasesMade * 0.15) */
  const getScaledPrice = (basePrice: number) => {
    return Math.round(basePrice * (1 + totalPurchasesMade * 0.15));
  };

  /** Get the price for a stackable upgrade: base * (1 + timesPurchased * 0.5) */
  const getStackablePrice = (upgrade: MetaUpgrade) => {
    const timesPurchased = purchasedUpgrades[upgrade.id] ?? 0;
    const basePrice = upgrade.prices[0] ?? 100;
    return Math.round(basePrice * (1 + timesPurchased * 0.5));
  };

  /**
   * Dynamic unlock pricing: 200 + (unlocksOwned) * 100, with global price multiplier on top.
   * Used for new minigame unlocks that have prices: [0] (sentinel for dynamic pricing).
   */
  const getUnlockPrice = () => {
    const base = 200 + unlocksOwned * 100;
    return getScaledPrice(base);
  };

  const handlePurchase = (upgrade: MetaUpgrade) => {
    const currentTier = purchasedUpgrades[upgrade.id] ?? 0;
    if (currentTier >= upgrade.maxTier) return;

    let price: number;
    if (upgrade.stackable) {
      price = getStackablePrice(upgrade);
    } else if (upgrade.category === "minigame-unlock" && upgrade.prices[currentTier] === 0) {
      // Dynamic unlock pricing for new minigames
      price = getUnlockPrice();
    } else {
      const basePrice = upgrade.prices[currentTier];
      if (basePrice === undefined) return;
      price = getScaledPrice(basePrice);
    }

    const success = spendData(price);
    if (!success) return;

    purchaseUpgrade(upgrade.id, upgrade.maxTier);

    // If this is a minigame unlock, unlock and go to training
    if (upgrade.category === "minigame-unlock") {
      const effect = upgrade.effects[currentTier];
      if (effect?.minigame) {
        unlockMinigame(effect.minigame);
        evaluateAndAwardAchievements();
        setTrainingMinigame(effect.minigame);
        setTrainingOrigin("meta-shop");
        setStatus("training");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 pb-12 px-4">
      {/* Header */}
      <h1 className="text-3xl sm:text-4xl font-heading uppercase tracking-wider text-cyber-cyan mb-1 glitch-text">
        UPGRADE TERMINAL
      </h1>
      <p className="text-white/30 text-xs uppercase tracking-widest mb-6 glitch-subtle">
        {CLI_PROMPT}DATA MARKET // PERSISTENT UPGRADES
      </p>

      {/* Fixed back button at bottom center */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
        <button
          type="button"
          onClick={handleBack}
          className="px-5 py-2 text-[10px] font-mono uppercase tracking-widest text-white/50 hover:text-cyber-cyan border border-white/10 hover:border-cyber-cyan/40 bg-cyber-bg transition-colors cursor-pointer"
        >
          {trainingMinigame ? "[ BACK TO TRAINING ]" : "[ BACK TO MENU ]"}
        </button>
      </div>

      {/* Data balance + price multiplier */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="flex items-center gap-2 px-6 py-3 border border-cyber-magenta/30 bg-cyber-magenta/5">
          <span className="text-white/50 text-xs uppercase tracking-widest glitch-subtle">
            DATA BALANCE
          </span>
          <span className="font-bold text-xl tabular-nums flex items-center gap-1.5 text-currency-data">
            <Hexagon size={16} /> {data.toLocaleString()}
          </span>
        </div>
        {totalPurchasesMade > 0 && (
          <p className="text-white/25 text-[10px] uppercase tracking-widest">
            PRICE MULTIPLIER: {(1 + totalPurchasesMade * 0.15).toFixed(1)}x
            <span className="text-white/15 ml-2">
              (NON-STACKABLE ONLY // {totalPurchasesMade} UPGRADE{totalPurchasesMade !== 1 ? "S" : ""} PURCHASED)
            </span>
          </p>
        )}
      </div>

      {/* Category sections */}
      <div className="w-full max-w-4xl space-y-10">
        {CATEGORY_ORDER.map((cat) => {
          const config = CATEGORIES[cat];
          let upgrades = grouped.get(cat);
          if (!upgrades || upgrades.length === 0) return null;

          // Filter game-specific upgrades: only show modules for unlocked minigames
          if (cat === "game-specific") {
            const unlockedSet = new Set(unlockedMinigames);
            upgrades = upgrades.filter((u) => {
              const mg = u.effects[0]?.minigame;
              return !mg || unlockedSet.has(mg);
            });
            if (upgrades.length === 0) return null;
          }

          return (
            <section key={cat}>
              {/* Category header */}
              <div className="mb-4 border-b border-white/10 pb-2">
                <h2
                  className={cn(
                    "text-sm font-bold uppercase tracking-[0.2em] glitch-text",
                    config.colors.text,
                  )}
                >
                  {config.label}
                </h2>
                <p className="text-white/25 text-[10px] uppercase tracking-widest mt-0.5">
                  {config.description}
                </p>
              </div>

              {/* Upgrade cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upgrades.map((upgrade) => (
                  <UpgradeCard
                    key={upgrade.id}
                    upgrade={upgrade}
                    currentTier={purchasedUpgrades[upgrade.id] ?? 0}
                    dataBalance={data}
                    prereqMet={
                      !upgrade.requires ||
                      (purchasedUpgrades[upgrade.requires] ?? 0) > 0
                    }
                    config={config}
                    getScaledPrice={getScaledPrice}
                    getStackablePrice={getStackablePrice}
                    getUnlockPrice={getUnlockPrice}
                    onPurchase={() => handlePurchase(upgrade)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Upgrade card
// ---------------------------------------------------------------------------

function UpgradeCard({
  upgrade,
  currentTier,
  dataBalance,
  prereqMet,
  config,
  getScaledPrice,
  getStackablePrice,
  getUnlockPrice,
  onPurchase,
}: {
  upgrade: MetaUpgrade;
  currentTier: number;
  dataBalance: number;
  prereqMet: boolean;
  config: CategoryConfig;
  getScaledPrice: (basePrice: number) => number;
  getStackablePrice: (upgrade: MetaUpgrade) => number;
  getUnlockPrice: () => number;
  onPurchase: () => void;
}) {
  const isStackable = upgrade.stackable === true;
  const isMaxed = !isStackable && currentTier >= upgrade.maxTier;

  // Calculate price
  let nextPrice: number | null;
  if (isStackable) {
    nextPrice = getStackablePrice(upgrade);
  } else if (isMaxed) {
    nextPrice = null;
  } else if (upgrade.category === "minigame-unlock" && upgrade.prices[currentTier] === 0) {
    // Dynamic unlock pricing for new minigames
    nextPrice = getUnlockPrice();
  } else {
    const basePrice = upgrade.prices[currentTier];
    nextPrice = basePrice !== null && basePrice !== undefined ? getScaledPrice(basePrice) : null;
  }

  const canAfford = nextPrice !== null && dataBalance >= nextPrice;
  const canPurchase = !isMaxed && canAfford && prereqMet;
  const isMinigameUnlock = upgrade.category === "minigame-unlock";

  // Effect preview: show current or next tier effect description
  const effectPreview = useMemo(() => {
    if (isStackable) {
      // For stackable, always show the per-purchase effect
      const eff = upgrade.effects[0];
      return eff ? formatEffect(eff) : null;
    }
    if (isMaxed) {
      const eff = upgrade.effects[currentTier - 1];
      return eff ? formatEffect(eff) : null;
    }
    const eff = upgrade.effects[currentTier];
    return eff ? formatEffect(eff) : null;
  }, [upgrade.effects, currentTier, isMaxed, isStackable]);

  return (
    <div
      className={cn(
        "relative border p-4 flex flex-col gap-2 transition-all duration-200",
        isMaxed
          ? "border-white/10 bg-white/[0.02]"
          : cn(config.colors.border, config.colors.bg),
        isMaxed && config.colors.glow.replace("0.15", "0.05"),
      )}
    >
      {/* Maxed badge */}
      {isMaxed && (
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              "text-[9px] uppercase tracking-widest px-2 py-0.5 font-bold",
              config.colors.badge,
            )}
          >
            MAXED
          </span>
        </div>
      )}

      {/* Name */}
      <h3
        className={cn(
          "text-sm font-heading uppercase tracking-wider",
          isMaxed ? "text-white/30" : config.colors.text,
        )}
      >
        {upgrade.name}
      </h3>

      {/* Description */}
      <p
        className={cn(
          "text-[11px] leading-relaxed",
          isMaxed ? "text-white/20" : "text-white/50",
        )}
      >
        {upgrade.description}
      </p>

      {/* Prerequisite notice */}
      {!prereqMet && upgrade.requires && (
        <p className="text-[10px] text-cyber-orange/70 uppercase tracking-wider">
          Requires: {findUpgradeName(upgrade.requires)}
        </p>
      )}

      {/* Effect preview */}
      {effectPreview && (
        <p
          className={cn(
            "text-[10px] uppercase tracking-wider",
            isMaxed ? "text-white/20" : "text-white/35",
          )}
        >
          {isStackable ? `Per purchase` : isMaxed ? "Active" : "Next"}: {effectPreview}
        </p>
      )}

      {/* Bottom row: tier/count + price + button */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-3">
          {/* Stackable: show purchase count */}
          {isStackable && (
            <span className={cn("text-xs font-bold tabular-nums", config.colors.text)}>
              x{currentTier}
            </span>
          )}

          {/* Tier indicator (only for non-stackable with maxTier > 1) */}
          {!isStackable && upgrade.maxTier > 1 && (
            <TierIndicator
              current={currentTier}
              max={upgrade.maxTier}
              colorClass={isMaxed ? "text-white/30" : config.colors.text}
            />
          )}

          {/* Price */}
          {!isMaxed && nextPrice !== null && (
            <span
              className={cn(
                "text-xs font-bold tabular-nums flex items-center gap-1",
                canAfford ? "" : "text-white/20",
              )}
              style={canAfford ? { color: "var(--color-currency-data)" } : undefined}
            >
              <Hexagon size={10} /> {nextPrice}
            </span>
          )}
        </div>

        {/* Purchase button */}
        {isMaxed ? (
          <span className="px-3 py-1 text-[10px] uppercase tracking-widest font-mono text-white/20 border border-white/10">
            OWNED
          </span>
        ) : (
          <button
            type="button"
            onClick={onPurchase}
            disabled={!canPurchase}
            className={cn(
              "px-3 py-1 text-[10px] uppercase tracking-widest font-mono border transition-colors duration-150",
              "cursor-pointer select-none",
              canPurchase
                ? isMinigameUnlock
                  ? "border-cyber-magenta/50 text-cyber-magenta hover:bg-cyber-magenta/10 hover:border-cyber-magenta/80 active:bg-cyber-magenta/20"
                  : cn(
                      config.colors.border,
                      config.colors.text,
                      "hover:bg-white/5 active:bg-white/10",
                    )
                : "border-white/10 text-white/20 cursor-not-allowed",
            )}
          >
            {isMinigameUnlock ? "UNLOCK" : "PURCHASE"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function findUpgradeName(id: string): string {
  return META_UPGRADE_POOL.find((u) => u.id === id)?.name ?? id;
}

function formatEffect(effect: { type: string; value: number; minigame?: string }): string {
  switch (effect.type) {
    case "damage-reduction":
      return `${Math.round(effect.value * 100)}% damage reduction`;
    case "credit-bonus":
      return `+${Math.round(effect.value * 100)}% credits`;
    case "data-bonus":
      return `+${Math.round(effect.value * 100)}% data`;
    case "max-hp":
      return `+${effect.value} max HP`;
    case "speed-bonus-multiplier":
      return `+${Math.round(effect.value * 100)}% speed bonus`;
    case "global-time-bonus":
      return `+3% time limit (multiplicative)`;
    case "difficulty-reduction":
      return "pushes max difficulty 2 floors further";
    // (start-random-powerup removed — quick-boot and dual-core were removed)
    case "start-hp":
      return `+${effect.value} bonus starting HP`;
    case "start-credits":
      return `+${effect.value} starting credits`;
    // (guaranteed-heal-shop removed — cache-primed was removed)
    case "unlock-minigame":
      return "Unlocks protocol (+5 max HP, +5% credits)";
    case "death-penalty-reduction":
      return `-${(effect.value * 100).toFixed(1).replace(/\.0$/, "")}% death penalty`;
    case "cascade-clock":
      return `+2% base timer per win (cap ${Math.round(effect.value * 100)}%)`;
    case "floor-regen":
      return "+2% max HP regen per floor (stackable)";
    case "minigame-specific":
      return formatMinigameSpecific(effect.value, effect.minigame);
    case "peek-ahead":
      return `${Math.round(effect.value * 100)}% of arrows pre-revealed`;
    case "preview":
      return `\u00b1${effect.value} answer range (fixed)`;
    case "hint":
      // For hint effects with fractional values, show as percentage
      if (effect.value < 1) return `${Math.round(effect.value * 100)}% pre-filled`;
      return "active";
    case "window-extend":
      return `+${Math.round(effect.value * 100)}% wider window`;
    case "bracket-flash":
      return "shows next expected bracket";
    case "wire-color-labels":
      return "highlights next wire";
    case "extra-hint":
      return "extra hint letter";
    case "shop-slots":
      return `${effect.value} vendor slots`;
    default:
      return effect.type.replace(/-/g, " ");
  }
}

/** Format minigame-specific effect values with descriptive text */
function formatMinigameSpecific(value: number, minigame?: string): string {
  switch (minigame) {
    case "defrag":
      return `${Math.round(value * 100)}% of timer`;
    case "close-brackets":
      return `removes ${value} bracket type${value > 1 ? "s" : ""}`;
    case "mine-sweep":
      return `${Math.round(value * 100)}% sectors visible`;
    case "type-backward":
      return `${Math.round(value * 100)}% words shown normally`;
    case "network-trace":
      return `${Math.round(value * 100)}% of timer`;
    case "signal-echo":
      return `${Math.round(value * 100)}% slower replay`;
    case "checksum-verify":
      return "intermediate result hint";
    case "port-scan":
      return `${value}x flash repeat`;
    case "subnet-scan":
      return "expanded IP range shown";
    case "cipher-crack":
      return `${Math.round(value * 100)}% pre-filled`;
    case "cipher-crack-v2":
      return "shift offset highlighted";
    default:
      return value < 1 ? `${Math.round(value * 100)}%` : `${value}`;
  }
}
