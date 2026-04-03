import { useMemo, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { Hexagon } from "lucide-react";
import { CyberButton } from "@/components/ui/CyberButton";
import { CLI_PROMPT } from "@/lib/constants";
import {
  CHECKPOINT_INTERVAL,
  CHECKPOINT_UNLOCK_THRESHOLD,
  getEffectiveDifficulty,
  getDifficultyLabel,
  getFloorBonusCredits,
  getMinigamesPerFloor,
} from "@/data/balancing";

/**
 * Main menu screen — entry point of the game.
 *
 * Shows the logo, best floor, data balance, and navigation buttons.
 */
export function MainMenu() {
  const startRun = useGameStore((s) => s.startRun);
  const generateRunShop = useGameStore((s) => s.generateRunShop);
  const setStatus = useGameStore((s) => s.setStatus);
  const stats = useGameStore((s) => s.stats);
  const data = useGameStore((s) => s.data);
  const checkpointReaches = useGameStore((s) => s.checkpointReaches);
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);

  const [showFloorPicker, setShowFloorPicker] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(1);

  const diffReducerTier = purchasedUpgrades["difficulty-reducer"] ?? 0;

  const { unlockedCheckpoints, lockedCheckpoints } = useMemo(() => {
    const unlocked = [1];
    const locked: { floor: number; reaches: number }[] = [];
    const maxShow = Math.max(stats.bestFloor + 10, 20);
    for (let f = CHECKPOINT_INTERVAL; f <= maxShow; f += CHECKPOINT_INTERVAL) {
      const reaches = checkpointReaches[f] ?? 0;
      if (reaches >= CHECKPOINT_UNLOCK_THRESHOLD) {
        unlocked.push(f);
      } else if (reaches > 0) {
        locked.push({ floor: f, reaches });
      }
    }
    return { unlockedCheckpoints: unlocked, lockedCheckpoints: locked };
  }, [checkpointReaches, stats.bestFloor]);

  const handleStartRun = () => {
    if (unlockedCheckpoints.length > 1) {
      setShowFloorPicker(true);
    } else {
      startRun();
      generateRunShop(1);
    }
  };

  return (
    <div data-testid="main-menu" className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-2 select-none">
        <h1 className="text-5xl sm:text-8xl font-heading tracking-tight leading-none glitch-text">
          <span className="text-cyber-cyan">ICE</span>
          <span className="text-cyber-magenta">BREAKER</span>
        </h1>
      </div>

      {/* Subtitle */}
      <p className="text-white/40 text-sm tracking-[0.3em] uppercase mb-12 glitch-subtle">
        {CLI_PROMPT}NEURAL INTRUSION SYSTEM
      </p>

      {/* Stats display */}
      <div className="flex gap-6 mb-10 text-sm uppercase tracking-widest">
        <span className="text-cyber-cyan glitch-subtle">
          BEST: FLOOR {stats.bestFloor}
        </span>
        <span className="glitch-subtle flex items-center gap-1.5 font-bold text-currency-data">
          <Hexagon size={16} /> {data}
        </span>
      </div>

      {showFloorPicker ? (
        /* Floor select picker */
        <div className="w-full max-w-md space-y-2">
          <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-2 glitch-subtle">
            {CLI_PROMPT}SELECT STARTING FLOOR
          </p>

          {/* Unlocked checkpoints */}
          {unlockedCheckpoints.map((floor) => {
            const diff = getEffectiveDifficulty(floor, diffReducerTier);
            const diffLabel = getDifficultyLabel(diff);
            const bonusCR = getFloorBonusCredits(floor);
            const minigames = getMinigamesPerFloor(floor, diffReducerTier);
            const isSelected = selectedFloor === floor;

            return (
              <button key={floor} onClick={() => setSelectedFloor(floor)}
                className={`w-full text-left px-4 py-3 border font-mono text-sm transition-all
                  ${isSelected
                    ? "border-cyber-cyan/50 bg-cyber-cyan/10 text-cyber-cyan"
                    : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">FLOOR {floor}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-70">{diffLabel}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] opacity-50">
                  <span>{minigames} protocols</span>
                  {bonusCR > 0 && <span>+{bonusCR} CR bonus</span>}
                </div>
              </button>
            );
          })}

          {/* Locked checkpoints with progress */}
          {lockedCheckpoints.map(({ floor, reaches }) => (
            <div key={floor} className="w-full px-4 py-2 border border-white/5 text-white/20 font-mono text-sm">
              <span>FLOOR {floor}</span>
              <span className="float-right text-[10px]">{reaches}/{CHECKPOINT_UNLOCK_THRESHOLD} REACHED</span>
            </div>
          ))}

          {/* Begin run button */}
          <div className="flex items-center justify-between mt-4">
            <CyberButton variant="muted" onClick={() => setShowFloorPicker(false)} className="w-auto">
              BACK
            </CyberButton>
            <CyberButton variant="primary" onClick={() => {
              startRun(selectedFloor);
              generateRunShop(selectedFloor);
            }} className="w-auto">
              BEGIN RUN
            </CyberButton>
          </div>

          {/* Floor bonus info */}
          {selectedFloor > 1 && (
            <p className="text-center text-currency-credits text-[10px] font-mono mt-2">
              FLOOR BONUS: +{getFloorBonusCredits(selectedFloor)} CR
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Menu buttons */}
          <div className="flex flex-col gap-3 w-64">
            <CyberButton variant="primary" prompt onClick={handleStartRun}>
              START RUN
            </CyberButton>
            <CyberButton prompt onClick={() => setStatus("meta-shop")}>
              META SHOP
            </CyberButton>
            <CyberButton prompt onClick={() => setStatus("training")}>
              TRAINING
            </CyberButton>
            <CyberButton prompt onClick={() => setStatus("codex")}>
              CODEX
            </CyberButton>
            <CyberButton prompt onClick={() => setStatus("stats")}>
              STATS
            </CyberButton>
            <CyberButton prompt onClick={() => setStatus("about")}>
              ABOUT
            </CyberButton>
            <CyberButton prompt onClick={() => setStatus("support")} className="border-cyber-magenta/20 text-cyber-magenta/60 hover:bg-cyber-magenta/10 hover:border-cyber-magenta/40 hover:text-cyber-magenta/90">
              ♥ SUPPORT
            </CyberButton>
          </div>

          {/* Reset */}
          <div className="mt-12 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Reset ALL progress? This cannot be undone.")) {
                  localStorage.removeItem("icebreaker-meta");
                  window.location.reload();
                }
              }}
              className="text-white/15 text-[10px] uppercase tracking-widest hover:text-cyber-magenta/60 transition-colors cursor-pointer"
            >
              [RESET PROGRESS]
            </button>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-8 mb-4 text-center text-white/20 text-[10px] uppercase tracking-widest font-mono">
        <a
          href="https://skorupa.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors"
        >
          skorupa.dev
        </a>
        <span className="mx-1.5">&middot;</span>
        <a
          href="https://github.com/Stratorheus/icebreaker"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}

