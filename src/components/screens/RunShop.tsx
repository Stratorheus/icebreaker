import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/game-store";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  time: "border-cyber-cyan/30 text-cyber-cyan",
  defense: "border-blue-400/30 text-blue-400",
  skip: "border-yellow-400/30 text-yellow-400",
  healing: "border-green-400/30 text-green-400",
  vision: "border-purple-400/30 text-purple-400",
  assist: "border-cyber-magenta/30 text-cyber-magenta",
};

/**
 * Run shop screen — appears between floors.
 *
 * Players spend run-local credits on power-ups before continuing
 * to the next floor.
 */
export function RunShop() {
  const floor = useGameStore((s) => s.floor);
  const credits = useGameStore((s) => s.credits);
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

  return (
    <div className="min-h-screen flex flex-col items-center pt-14 pb-8 px-4">
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan mb-1">
        SUPPLY CACHE
      </h1>
      <p className="text-white/30 text-xs uppercase tracking-widest mb-2">
        {">"}_&nbsp;FLOOR {floor} CLEARED
      </p>

      {/* Credits */}
      <div className="text-cyber-magenta font-bold text-lg mb-8 tabular-nums">
        {"\u2B26"} {credits.toLocaleString()} CR
      </div>

      {/* Shop items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-10">
        {runShopOffers.map((offer, index) => {
          const canAfford = credits >= offer.price;
          const available = !offer.purchased && canAfford;
          const categoryStyle =
            CATEGORY_COLORS[offer.category] ?? "border-white/20 text-white/60";

          return (
            <div
              key={offer.id}
              className={cn(
                "border p-4 flex flex-col gap-2 transition-colors duration-150",
                offer.purchased
                  ? "border-white/5 opacity-40"
                  : categoryStyle,
              )}
            >
              {/* Header: name + category */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider">
                  {offer.name}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/30">
                  {offer.category}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-white/50 leading-relaxed">
                {offer.description}
              </p>

              {/* Price + buy button */}
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-cyber-magenta text-sm font-bold tabular-nums">
                  {offer.price} CR
                </span>
                <button
                  type="button"
                  onClick={() => buyRunShopItem(index)}
                  disabled={!available}
                  className={cn(
                    "px-4 py-1 text-xs uppercase tracking-widest font-mono border transition-colors duration-150",
                    "cursor-pointer select-none",
                    available
                      ? "border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10"
                      : "border-white/10 text-white/20 cursor-not-allowed",
                  )}
                >
                  {offer.purchased ? "SOLD" : "BUY"}
                </button>
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
