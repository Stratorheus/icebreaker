import { useGameStore } from "@/store/game-store";
import { Hexagon } from "lucide-react";

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

  const handleStartRun = () => {
    startRun();
    generateRunShop(1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-2 select-none">
        <h1 className="text-6xl sm:text-8xl font-bold tracking-tighter leading-none glitch-text">
          <span className="text-cyber-cyan">ICE</span>
          <span className="text-cyber-magenta">BREAKER</span>
        </h1>
      </div>

      {/* Subtitle */}
      <p className="text-white/40 text-sm tracking-[0.3em] uppercase mb-12 glitch-subtle">
        {">"}_&nbsp;NEURAL INTRUSION SYSTEM
      </p>

      {/* Stats display */}
      <div className="flex gap-6 mb-10 text-sm uppercase tracking-widest">
        <span className="text-cyber-cyan glitch-subtle">
          BEST: FLOOR {stats.bestFloor}
        </span>
        <span className="glitch-subtle flex items-center gap-1.5 font-bold" style={{ color: "var(--color-currency-data)" }}>
          <Hexagon size={16} /> {data}
        </span>
      </div>

      {/* Menu buttons */}
      <div className="flex flex-col gap-3 w-64">
        <MenuButton onClick={handleStartRun} primary>
          {">"}_&nbsp;START RUN
        </MenuButton>
        <MenuButton onClick={() => setStatus("meta-shop")}>
          {">"}_&nbsp;META SHOP
        </MenuButton>
        <MenuButton onClick={() => setStatus("training")}>
          {">"}_&nbsp;TRAINING
        </MenuButton>
        <MenuButton onClick={() => setStatus("codex")}>
          {">"}_&nbsp;CODEX
        </MenuButton>
        <MenuButton onClick={() => setStatus("stats")}>
          {">"}_&nbsp;STATS
        </MenuButton>
      </div>

      {/* Reset + Version */}
      <div className="mt-12 flex flex-col items-center gap-2">
        <p className="text-white/20 text-[10px] uppercase tracking-widest glitch-flicker">
          {`v${__APP_VERSION__}`} // PROTOTYPE
        </p>
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

      {/* Footer */}
      <div className="mt-8 mb-4 text-center text-white/20 text-[10px] uppercase tracking-widest font-mono">
        <span>Made by{" "}
          <a
            href="https://skorupa.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors"
          >
            Martin Skorupa
          </a>
        </span>
        <span className="mx-1.5">&middot;</span>
        <a
          href="https://linkedin.com/in/martin-skorupa"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors"
        >
          LinkedIn
        </a>
        <span className="mx-1.5">&middot;</span>
        <span>Inspired by{" "}
          <a
            href="https://store.steampowered.com/app/1812820/Bitburner/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 underline underline-offset-2 hover:text-white/50 transition-colors"
          >
            Bitburner
          </a>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal button component
// ---------------------------------------------------------------------------

function MenuButton({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full py-3 px-4
        text-left text-sm uppercase tracking-widest font-mono
        border transition-colors duration-150
        cursor-pointer select-none
        ${
          primary
            ? "border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10 hover:border-cyber-cyan/70"
            : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white/90 hover:border-white/30"
        }
      `}
    >
      {children}
    </button>
  );
}
