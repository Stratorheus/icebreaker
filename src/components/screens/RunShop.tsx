import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { cn } from "@/lib/utils";
import { awardNewAchievements } from "@/hooks/use-achievement-check";
import { getDataReward } from "@/data/balancing";
import {
  Clock,
  Zap,
  Timer,
  PauseCircle,
  Shield,
  ShieldHalf,
  Layers,
  SkipForward,
  DoorOpen,
  RouteOff,
  HeartPulse,
  RefreshCw,
  Activity,
  Eye,
  Lightbulb,
  Map,
  Sword,
  Code,
  Compass,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { Codex } from "@/components/screens/Codex";
import { Stats } from "@/components/screens/Stats";

// ---------------------------------------------------------------------------
// Icon map: kebab-case string -> Lucide component
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  clock: Clock,
  zap: Zap,
  timer: Timer,
  "pause-circle": PauseCircle,
  shield: Shield,
  "shield-half": ShieldHalf,
  layers: Layers,
  "skip-forward": SkipForward,
  "door-open": DoorOpen,
  "route-off": RouteOff,
  "heart-pulse": HeartPulse,
  "refresh-cw": RefreshCw,
  activity: Activity,
  eye: Eye,
  lightbulb: Lightbulb,
  map: Map,
  sword: Sword,
  code: Code,
  compass: Compass,
  radio: Radio,
};

// ---------------------------------------------------------------------------
// Category color scheme (matches task spec)
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<
  string,
  { border: string; text: string; bg: string; badge: string }
> = {
  time: {
    border: "border-cyan-400/40",
    text: "text-cyan-400",
    bg: "bg-cyan-400/5",
    badge: "bg-cyan-400/15 text-cyan-400",
  },
  defense: {
    border: "border-orange-400/40",
    text: "text-orange-400",
    bg: "bg-orange-400/5",
    badge: "bg-orange-400/15 text-orange-400",
  },
  skip: {
    border: "border-cyber-magenta/40",
    text: "text-cyber-magenta",
    bg: "bg-cyber-magenta/5",
    badge: "bg-cyber-magenta/15 text-cyber-magenta",
  },
  healing: {
    border: "border-green-400/40",
    text: "text-green-400",
    bg: "bg-green-400/5",
    badge: "bg-green-400/15 text-green-400",
  },
  vision: {
    border: "border-purple-400/40",
    text: "text-purple-400",
    bg: "bg-purple-400/5",
    badge: "bg-purple-400/15 text-purple-400",
  },
  assist: {
    border: "border-blue-400/40",
    text: "text-blue-400",
    bg: "bg-blue-400/5",
    badge: "bg-blue-400/15 text-blue-400",
  },
};

const FALLBACK_COLORS = {
  border: "border-white/20",
  text: "text-white/60",
  bg: "bg-white/5",
  badge: "bg-white/10 text-white/60",
};

// ---------------------------------------------------------------------------
// Sub-view type for vendor node navigation
// ---------------------------------------------------------------------------

type VendorView = "shop" | "codex" | "stats";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Run shop screen — appears between floors.
 *
 * Players spend run-local credits on power-ups before continuing
 * to the next floor. Also provides access to CODEX, STATS, and QUIT RUN
 * (pause menu is no longer available during gameplay).
 */
export function RunShop() {
  const floor = useGameStore((s) => s.floor);
  const credits = useGameStore((s) => s.credits);
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);
  const inventory = useGameStore((s) => s.inventory);
  const runShopOffers = useGameStore((s) => s.runShopOffers);
  const generateRunShop = useGameStore((s) => s.generateRunShop);
  const buyRunShopItem = useGameStore((s) => s.buyRunShopItem);
  const advanceFloor = useGameStore((s) => s.advanceFloor);
  const addCredits = useGameStore((s) => s.addCredits);
  const quitRun = useGameStore((s) => s.quitRun);
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);

  const [view, setView] = useState<VendorView>("shop");
  const [confirmQuit, setConfirmQuit] = useState(false);

  // Generate shop if it hasn't been generated yet
  const generatedRef = useRef(false);
  useEffect(() => {
    if (generatedRef.current) return;
    if (runShopOffers.length === 0) {
      generatedRef.current = true;
      generateRunShop(floor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check floor-related achievements once when shop first mounts
  const achievementCheckedRef = useRef(false);
  useEffect(() => {
    if (achievementCheckedRef.current) return;
    achievementCheckedRef.current = true;
    // Floor was just cleared — evaluate floor-reached, floor-no-damage,
    // floor-no-powerups, and speed-run conditions.
    awardNewAchievements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reroll price: 20 + floor * 10
  const rerollPrice = Math.round(20 + floor * 10);
  const canReroll = credits >= rerollPrice;

  const handleReroll = () => {
    if (!canReroll) return;
    addCredits(-rerollPrice);
    generateRunShop(floor);
  };

  // Compute data reward preview for quit button
  const dataTier = purchasedUpgrades["data-siphon"] ?? 0;
  const dataMultiplier = 1 + dataTier * 0.1;
  const dataReward = Math.round(getDataReward(floor) * dataMultiplier);

  // Sub-views: Codex and Stats with back button returning to shop
  if (view === "codex") {
    return <Codex onBack={() => setView("shop")} />;
  }
  if (view === "stats") {
    return <Stats onBack={() => setView("shop")} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center pt-14 pb-8 px-4">
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan mb-1 glitch-text">
        VENDOR NODE
      </h1>
      <p className="text-white/30 text-xs uppercase tracking-widest mb-4 glitch-subtle">
        {">"}_&nbsp;FLOOR {floor} CLEARED
      </p>

      {/* Status bar: HP + Credits */}
      <div className="flex items-center gap-6 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs uppercase tracking-widest glitch-subtle">
            HP
          </span>
          <span
            className={cn(
              "font-bold text-lg tabular-nums",
              hp <= maxHp * 0.3
                ? "text-red-400"
                : hp <= maxHp * 0.6
                  ? "text-yellow-400"
                  : "text-cyber-green",
            )}
          >
            {hp}/{maxHp}
          </span>
        </div>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs uppercase tracking-widest glitch-subtle">
            CR
          </span>
          <span className="text-cyber-magenta font-bold text-lg tabular-nums">
            {"\u2B26"} {credits.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Shop items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-6">
        {runShopOffers.map((offer, index) => {
          const canAfford = credits >= offer.price;
          const alreadyOwned = inventory.some((p) => p.type === offer.id);
          const available = !offer.purchased && !alreadyOwned && canAfford;
          const colors = CATEGORY_COLORS[offer.category] ?? FALLBACK_COLORS;
          const IconComponent = ICON_MAP[offer.icon];

          return (
            <div
              key={offer.id}
              className={cn(
                "relative border p-4 flex flex-col gap-2 transition-colors duration-150",
                offer.purchased
                  ? "border-white/5 bg-white/[0.02]"
                  : cn(colors.border, colors.bg),
              )}
            >
              {/* Purchased overlay */}
              {offer.purchased && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                  <span className="text-white/30 text-sm font-bold uppercase tracking-[0.3em]">
                    ACQUIRED
                  </span>
                </div>
              )}

              {/* Header: icon + name + category badge */}
              <div className="flex items-center gap-3">
                {/* Icon */}
                {IconComponent && (
                  <div
                    className={cn(
                      "shrink-0 w-9 h-9 flex items-center justify-center border",
                      offer.purchased
                        ? "border-white/10 text-white/20"
                        : cn(colors.border, colors.text),
                    )}
                  >
                    <IconComponent size={18} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-bold uppercase tracking-wider truncate",
                        offer.purchased ? "text-white/30" : colors.text,
                      )}
                    >
                      {offer.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-sm font-bold",
                        offer.purchased
                          ? "bg-white/5 text-white/20"
                          : colors.badge,
                      )}
                    >
                      {offer.category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  offer.purchased ? "text-white/20" : "text-white/50",
                )}
              >
                {offer.description}
              </p>

              {/* Price + buy button */}
              <div className="flex items-center justify-between mt-auto pt-2">
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    offer.purchased ? "text-white/20" : "text-cyber-magenta",
                  )}
                >
                  {"\u2B26"} {offer.price} CR
                </span>

                {alreadyOwned && !offer.purchased ? (
                  <span className="px-4 py-1 text-[10px] uppercase tracking-widest font-mono text-white/25 border border-white/10">
                    OWNED
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => buyRunShopItem(index)}
                    disabled={!available}
                    className={cn(
                      "px-4 py-1 text-xs uppercase tracking-widest font-mono border transition-colors duration-150",
                      "cursor-pointer select-none",
                      available
                        ? cn(
                            colors.border,
                            colors.text,
                            "hover:bg-white/5 active:bg-white/10",
                          )
                        : "border-white/10 text-white/20 cursor-not-allowed",
                    )}
                  >
                    {offer.purchased ? "SOLD" : "BUY"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reroll button */}
      <button
        type="button"
        onClick={handleReroll}
        disabled={!canReroll}
        className={cn(
          "mb-8 py-2 px-6 text-xs uppercase tracking-widest font-mono border transition-colors duration-150 cursor-pointer select-none",
          canReroll
            ? "border-cyber-orange/40 text-cyber-orange hover:bg-cyber-orange/10 hover:border-cyber-orange/70"
            : "border-white/10 text-white/20 cursor-not-allowed",
        )}
      >
        {">"}_&nbsp;REROLL STOCK ({"\u2B26"} {rerollPrice} CR)
      </button>

      {/* Continue button */}
      <button
        type="button"
        onClick={advanceFloor}
        className="
          py-3 px-10
          text-sm uppercase tracking-widest font-mono
          border border-cyber-cyan/40 text-cyber-cyan
          hover:bg-cyber-cyan/10 hover:border-cyber-cyan/70
          transition-colors duration-150
          cursor-pointer select-none
          mb-6
        "
      >
        {">"}_&nbsp;CONTINUE TO FLOOR {floor + 1}
      </button>

      {/* Utility buttons: Codex, Stats, Quit */}
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={() => setView("codex")}
          className="
            py-2 px-4
            text-[10px] uppercase tracking-widest font-mono
            border border-white/15 text-white/40
            hover:bg-white/5 hover:text-white/70 hover:border-white/30
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          CODEX
        </button>
        <button
          type="button"
          onClick={() => setView("stats")}
          className="
            py-2 px-4
            text-[10px] uppercase tracking-widest font-mono
            border border-white/15 text-white/40
            hover:bg-white/5 hover:text-white/70 hover:border-white/30
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          STATS
        </button>

        {/* Quit run with confirmation */}
        {!confirmQuit ? (
          <button
            type="button"
            onClick={() => setConfirmQuit(true)}
            className="
              py-2 px-4
              text-[10px] uppercase tracking-widest font-mono
              border border-cyber-magenta/30 text-cyber-magenta/70
              hover:bg-cyber-magenta/10 hover:border-cyber-magenta/50
              transition-colors duration-150
              cursor-pointer select-none
            "
          >
            QUIT RUN (+{dataReward} {"\u25C6"})
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-cyber-orange text-[10px] uppercase tracking-widest">
              QUIT?
            </span>
            <button
              type="button"
              onClick={quitRun}
              className="
                py-2 px-3
                text-[10px] uppercase tracking-widest font-mono
                border border-cyber-magenta/50 text-cyber-magenta
                hover:bg-cyber-magenta/10
                transition-colors duration-150
                cursor-pointer select-none
              "
            >
              CONFIRM
            </button>
            <button
              type="button"
              onClick={() => setConfirmQuit(false)}
              className="
                py-2 px-3
                text-[10px] uppercase tracking-widest font-mono
                border border-white/20 text-white/50
                hover:bg-white/5
                transition-colors duration-150
                cursor-pointer select-none
              "
            >
              CANCEL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
