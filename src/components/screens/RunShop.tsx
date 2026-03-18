import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/game-store";
import { cn } from "@/lib/utils";
import { awardNewAchievements } from "@/hooks/use-achievement-check";
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
// Component
// ---------------------------------------------------------------------------

/**
 * Run shop screen — appears between floors.
 *
 * Players spend run-local credits on power-ups before continuing
 * to the next floor.
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

  return (
    <div className="min-h-screen flex flex-col items-center pt-14 pb-8 px-4">
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan mb-1">
        VENDOR NODE
      </h1>
      <p className="text-white/30 text-xs uppercase tracking-widest mb-4">
        {">"}_&nbsp;FLOOR {floor} CLEARED
      </p>

      {/* Status bar: HP + Credits */}
      <div className="flex items-center gap-6 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs uppercase tracking-widest">
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
          <span className="text-white/40 text-xs uppercase tracking-widest">
            CR
          </span>
          <span className="text-cyber-magenta font-bold text-lg tabular-nums">
            {"\u2B26"} {credits.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Shop items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-10">
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
        "
      >
        {">"}_&nbsp;CONTINUE TO FLOOR {floor + 1}
      </button>
    </div>
  );
}
