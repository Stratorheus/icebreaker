import { useMemo } from "react";
import { useGameStore } from "@/store/game-store";
import { META_UPGRADE_POOL } from "@/data/meta-upgrades";
import { cn } from "@/lib/utils";
import type { MetaUpgrade } from "@/types/shop";

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
    label: "MINIGAME LICENSES",
    description: "Unlock new minigames for future runs",
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
    description: "Minigame-specific advantages and assists",
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
  "stat",
  "starting-bonus",
  "minigame-unlock",
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

  const grouped = useMemo(() => groupByCategory(META_UPGRADE_POOL), []);

  const handlePurchase = (upgrade: MetaUpgrade) => {
    const currentTier = purchasedUpgrades[upgrade.id] ?? 0;
    if (currentTier >= upgrade.maxTier) return;

    const price = upgrade.prices[currentTier];
    if (price === undefined) return;

    const success = spendData(price);
    if (!success) return;

    purchaseUpgrade(upgrade.id);

    // If this is a minigame unlock, unlock and go to training
    if (upgrade.category === "minigame-unlock") {
      const effect = upgrade.effects[currentTier];
      if (effect?.minigame) {
        unlockMinigame(effect.minigame);
        setStatus("training");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 pb-12 px-4">
      {/* Header */}
      <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan mb-1">
        UPGRADE TERMINAL
      </h1>
      <p className="text-white/30 text-xs uppercase tracking-widest mb-6">
        {">"}_&nbsp;DATA MARKET // PERSISTENT UPGRADES
      </p>

      {/* Data balance */}
      <div className="flex items-center gap-2 mb-10 px-6 py-3 border border-cyber-magenta/30 bg-cyber-magenta/5">
        <span className="text-white/50 text-xs uppercase tracking-widest">
          DATA BALANCE
        </span>
        <span className="text-cyber-magenta font-bold text-xl tabular-nums">
          {"\u25C6"} {data.toLocaleString()}
        </span>
      </div>

      {/* Category sections */}
      <div className="w-full max-w-4xl space-y-10">
        {CATEGORY_ORDER.map((cat) => {
          const config = CATEGORIES[cat];
          const upgrades = grouped.get(cat);
          if (!upgrades || upgrades.length === 0) return null;

          return (
            <section key={cat}>
              {/* Category header */}
              <div className="mb-4 border-b border-white/10 pb-2">
                <h2
                  className={cn(
                    "text-sm font-bold uppercase tracking-[0.2em]",
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
                    onPurchase={() => handlePurchase(upgrade)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Back button */}
      <button
        type="button"
        onClick={() => setStatus("menu")}
        className="
          mt-12 py-3 px-10
          text-sm uppercase tracking-widest font-mono
          border border-white/20 text-white/50
          hover:bg-white/5 hover:text-white/80 hover:border-white/40
          transition-colors duration-150
          cursor-pointer select-none
        "
      >
        {">"}_&nbsp;BACK TO MENU
      </button>
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
  onPurchase,
}: {
  upgrade: MetaUpgrade;
  currentTier: number;
  dataBalance: number;
  prereqMet: boolean;
  config: CategoryConfig;
  onPurchase: () => void;
}) {
  const isMaxed = currentTier >= upgrade.maxTier;
  const nextPrice = isMaxed ? null : upgrade.prices[currentTier];
  const canAfford = nextPrice !== null && dataBalance >= nextPrice;
  const canPurchase = !isMaxed && canAfford && prereqMet;
  const isMinigameUnlock = upgrade.category === "minigame-unlock";

  // Effect preview: show current or next tier effect description
  const effectPreview = useMemo(() => {
    if (isMaxed) {
      const eff = upgrade.effects[currentTier - 1];
      return eff ? formatEffect(eff) : null;
    }
    const eff = upgrade.effects[currentTier];
    return eff ? formatEffect(eff) : null;
  }, [upgrade.effects, currentTier, isMaxed]);

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
          "text-sm font-bold uppercase tracking-wider",
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
          {isMaxed ? "Active" : "Next"}: {effectPreview}
        </p>
      )}

      {/* Bottom row: tier + price + button */}
      <div className="flex items-center justify-between mt-auto pt-2">
        {/* Tier indicator (only if maxTier > 1) */}
        <div className="flex items-center gap-3">
          {upgrade.maxTier > 1 && (
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
                "text-xs font-bold tabular-nums",
                canAfford ? "text-cyber-magenta" : "text-white/20",
              )}
            >
              {"\u25C6"} {nextPrice}
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

function formatEffect(effect: { type: string; value: number }): string {
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
      return `+${effect.value}s time limit`;
    case "start-random-powerup":
      return `${effect.value} random power-up(s)`;
    case "start-hp":
      return `Start with ${effect.value} HP`;
    case "start-credits":
      return `+${effect.value} starting credits`;
    case "floor1-time-bonus":
      return `+${effect.value}s floor 1 timers`;
    case "guaranteed-heal-shop":
      return "Guaranteed heal in floor 1 shop";
    case "unlock-minigame":
      return "Unlocks minigame";
    default:
      return effect.type.replace(/-/g, " ");
  }
}
