import { useEffect, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { Codex } from "@/components/screens/Codex";
import { Stats } from "@/components/screens/Stats";
import { CyberButton } from "@/components/ui/CyberButton";
import { CLI_PROMPT } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Pause sub-screen type
// ---------------------------------------------------------------------------

type PauseView = "menu" | "codex" | "stats";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Pause menu -- accessible during a run via the HUD pause button or Escape.
 *
 * Shows: CODEX, STATS, RESUME, QUIT RUN.
 * Does NOT show META SHOP or START RUN (that would be cheating).
 * Codex and Stats render in-place with their back buttons returning here.
 */
export function PauseMenu() {
  const resumeRun = useGameStore((s) => s.resumeRun);
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
          resumeRun();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, resumeRun]);

  // Sub-views: Codex and Stats with back button returning to pause menu
  if (view === "codex") {
    return <Codex onBack={() => setView("menu")} />;
  }
  if (view === "stats") {
    return <Stats onBack={() => setView("menu")} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-heading uppercase tracking-wider text-cyber-cyan mb-2">
        PAUSED
      </h1>
      <p className="text-white/30 text-sm tracking-[0.2em] uppercase mb-8">
        {CLI_PROMPT}SYSTEM SUSPENDED
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
        <CyberButton variant="primary" prompt onClick={resumeRun}>
          RESUME
        </CyberButton>
        <CyberButton prompt onClick={() => setView("codex")}>
          CODEX
        </CyberButton>
        <CyberButton prompt onClick={() => setView("stats")}>
          STATS
        </CyberButton>

        {/* Quit run with confirmation */}
        {!confirmQuit ? (
          <CyberButton variant="danger" prompt onClick={() => setConfirmQuit(true)}>
            QUIT RUN
          </CyberButton>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-cyber-orange text-xs uppercase tracking-widest text-center mb-1">
              QUIT? Full data reward -- no penalty.
            </p>
            <div className="flex gap-2">
              <CyberButton
                variant="danger"
                className="flex-1 py-2 px-4 text-xs"
                onClick={quitRun}
              >
                CONFIRM
              </CyberButton>
              <CyberButton
                variant="muted"
                className="flex-1 py-2 px-4 text-xs"
                onClick={() => setConfirmQuit(false)}
              >
                CANCEL
              </CyberButton>
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

