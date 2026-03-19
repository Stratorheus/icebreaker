import { useEffect, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { Codex } from "@/components/screens/Codex";
import { Stats } from "@/components/screens/Stats";

// ---------------------------------------------------------------------------
// Pause sub-screen type
// ---------------------------------------------------------------------------

type PauseView = "menu" | "codex" | "stats";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Pause menu — accessible during a run via the HUD pause button or Escape.
 *
 * Shows: CODEX, STATS, RESUME, QUIT RUN.
 * Does NOT show META SHOP or START RUN (that would be cheating).
 * Codex and Stats render in-place and their back buttons return here.
 */
export function PauseMenu() {
  const setStatus = useGameStore((s) => s.setStatus);
  const quitRun = useGameStore((s) => s.quitRun);
  const floor = useGameStore((s) => s.floor);
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);

  const [view, setView] = useState<PauseView>("menu");
  const [confirmQuit, setConfirmQuit] = useState(false);

  // Escape key returns to game from pause menu (or back from sub-view)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== "menu") {
          setView("menu");
        } else {
          setStatus("playing");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, setStatus]);

  // Sub-views: Codex and Stats with overridden back behavior
  if (view === "codex") {
    return <PauseSubView onBack={() => setView("menu")}><CodexInPause onBack={() => setView("menu")} /></PauseSubView>;
  }
  if (view === "stats") {
    return <PauseSubView onBack={() => setView("menu")}><StatsInPause onBack={() => setView("menu")} /></PauseSubView>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-bold uppercase tracking-wider text-cyber-cyan mb-2">
        PAUSED
      </h1>
      <p className="text-white/30 text-sm tracking-[0.2em] uppercase mb-8">
        {">"}_&nbsp;SYSTEM SUSPENDED
      </p>

      {/* Run info */}
      <div className="flex gap-6 mb-10 text-xs uppercase tracking-widest">
        <span className="text-cyber-cyan/60">
          FLOOR {floor}
        </span>
        <span className="text-cyber-green/60">
          HP {hp}/{maxHp}
        </span>
      </div>

      {/* Menu buttons */}
      <div className="flex flex-col gap-3 w-64">
        <PauseButton onClick={() => setStatus("playing")} primary>
          {">"}_&nbsp;RESUME
        </PauseButton>
        <PauseButton onClick={() => setView("codex")}>
          {">"}_&nbsp;CODEX
        </PauseButton>
        <PauseButton onClick={() => setView("stats")}>
          {">"}_&nbsp;STATS
        </PauseButton>

        {/* Quit run with confirmation */}
        {!confirmQuit ? (
          <PauseButton onClick={() => setConfirmQuit(true)} danger>
            {">"}_&nbsp;QUIT RUN
          </PauseButton>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-cyber-orange text-xs uppercase tracking-widest text-center mb-1">
              QUIT? Full data reward — no penalty.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={quitRun}
                className="
                  flex-1 py-2 px-4
                  text-xs uppercase tracking-widest font-mono
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
                  flex-1 py-2 px-4
                  text-xs uppercase tracking-widest font-mono
                  border border-white/20 text-white/50
                  hover:bg-white/5
                  transition-colors duration-150
                  cursor-pointer select-none
                "
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-10 text-white/15 text-[10px] uppercase tracking-widest">
        PRESS ESC TO RESUME
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal button component
// ---------------------------------------------------------------------------

function PauseButton({
  children,
  onClick,
  primary = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
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
            : danger
              ? "border-cyber-magenta/30 text-cyber-magenta/70 hover:bg-cyber-magenta/10 hover:border-cyber-magenta/50"
              : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white/90 hover:border-white/30"
        }
      `}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Wrapper for sub-views (Codex/Stats rendered inside pause context)
// ---------------------------------------------------------------------------

function PauseSubView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Codex/Stats wrappers that override the "back" button behavior
// ---------------------------------------------------------------------------

function CodexInPause({ onBack }: { onBack: () => void }) {
  // Render the full Codex but override the setStatus call
  // We re-implement a simplified version that calls onBack
  const unlockedMinigames = useGameStore((s) => s.unlockedMinigames);

  // We can't easily override Codex's internal setStatus, so we render
  // the Codex component but intercept navigation. Instead, we'll use the
  // Codex directly and add a back-to-pause overlay approach.
  // Simpler: just render Codex and override via a wrapper.
  return <CodexWithBack onBack={onBack} />;
}

function StatsInPause({ onBack }: { onBack: () => void }) {
  return <StatsWithBack onBack={onBack} />;
}

/**
 * Codex screen with custom back button behavior (returns to pause menu
 * instead of main menu).
 */
function CodexWithBack({ onBack }: { onBack: () => void }) {
  // We need to replicate Codex but with a different back handler.
  // Import and render Codex, then provide an overlay back button.
  // Actually the simplest approach: render the Codex component but add
  // a fixed back button that overrides.
  return (
    <div className="relative">
      <Codex />
      {/* Override the Codex's back button with our own fixed one */}
      <div className="fixed bottom-4 left-4 z-50">
        <button
          type="button"
          onClick={onBack}
          className="
            py-2 px-6
            text-sm uppercase tracking-widest font-mono
            border border-cyber-cyan/40 text-cyber-cyan
            bg-cyber-bg/90 backdrop-blur-sm
            hover:bg-cyber-cyan/10 hover:border-cyber-cyan/70
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {">"}_&nbsp;BACK TO PAUSE
        </button>
      </div>
    </div>
  );
}

function StatsWithBack({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative">
      <Stats />
      <div className="fixed bottom-4 left-4 z-50">
        <button
          type="button"
          onClick={onBack}
          className="
            py-2 px-6
            text-sm uppercase tracking-widest font-mono
            border border-cyber-cyan/40 text-cyber-cyan
            bg-cyber-bg/90 backdrop-blur-sm
            hover:bg-cyber-cyan/10 hover:border-cyber-cyan/70
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {">"}_&nbsp;BACK TO PAUSE
        </button>
      </div>
    </div>
  );
}
