import { useState } from "react";
import { toast } from "sonner";
import { useGameStore } from "@/store/game-store";
import type { MinigameType } from "@/types/game";
import { ALL_MINIGAMES, UNLOCKABLE_MINIGAMES, getMinigameBriefing, getMinigameDisplayName } from "@/data/minigames/registry";
import type { MinigameBriefing } from "@/data/minigames/types";
import { useTouchDevice } from "@/hooks/use-touch-device";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { CyberButton } from "@/components/ui/CyberButton";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UnlockedEntry({
  type,
  briefing,
  expanded,
  onToggle,
}: {
  type: MinigameType;
  briefing: MinigameBriefing;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isTouch = useTouchDevice();
  return (
    <div className="border border-white/10 bg-white/[0.02]">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between
          px-4 py-3
          text-left cursor-pointer select-none
          hover:bg-white/[0.03] transition-colors duration-100
        "
      >
        <div className="flex items-center gap-3">
          <span className="text-cyber-cyan text-[10px] select-none">{">"}</span>
          <span
            className="text-cyber-cyan text-sm font-heading uppercase tracking-wider glitch-text"
            style={{ "--glitch-delay": `${(type.charCodeAt(0) * 7 + type.charCodeAt(1) * 13) % 40 / 10}s` } as React.CSSProperties}
          >
            {getMinigameDisplayName(type).toUpperCase()}
          </span>
          <span className="text-white/20 text-[10px] uppercase tracking-widest hidden sm:inline">
            {type}
          </span>
        </div>
        <span className="text-white/30 text-xs select-none">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5">
          {/* Rules */}
          <section className="pt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2">
              PROTOCOL RULES
            </h3>
            <ul className="space-y-1.5">
              {briefing.rules.map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-white/60 leading-relaxed"
                >
                  <span className="text-cyber-cyan/50 shrink-0 select-none">{">"}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Controls */}
          <section className="border border-cyber-cyan/15 bg-cyber-cyan/[0.02] px-3 py-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyber-cyan/40 mb-1.5">
              CONTROLS
            </h3>
            <p className="text-cyber-cyan/80 text-sm font-mono">{isTouch ? briefing.controls.touch : briefing.controls.desktop}</p>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2">
              TACTICAL TIPS
            </h3>
            <ul className="space-y-1.5">
              {briefing.tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-white/40 leading-relaxed"
                >
                  <span className="text-cyber-magenta/50 shrink-0 select-none">◆</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function LockedEntry({ type }: { type: MinigameType }) {
  return (
    <div className="border border-white/5 bg-white/[0.01] px-4 py-3 flex items-center gap-3 opacity-40">
      <span className="text-white/20 text-[10px] select-none">{">"}</span>
      <span className="text-white/30 text-sm font-heading uppercase tracking-wider">???</span>
      <span className="text-white/15 text-[10px] uppercase tracking-widest ml-2">
        UNLOCK IN META SHOP
      </span>
      <span className="ml-auto text-white/15 text-[10px] uppercase tracking-widest hidden sm:inline">
        {type}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Codex screen
// ---------------------------------------------------------------------------

export function Codex({ onBack }: { onBack?: () => void } = {}) {
  const setStatus = useGameStore((s) => s.setStatus);
  const unlockedMinigames = useGameStore((s) => s.unlockedMinigames);
  const resetOnboarding = useGameStore((s) => s.resetOnboarding);
  const handleBack = onBack ?? (() => setStatus("menu"));

  const unlockedSet = new Set(unlockedMinigames);
  const unlockedCount = unlockedMinigames.length;
  const totalCount = ALL_MINIGAMES.length;

  // Track which entries are expanded (default: first unlocked entry open)
  const firstUnlocked = ALL_MINIGAMES.find((t) => unlockedSet.has(t));
  const [expanded, setExpanded] = useState<Set<MinigameType>>(
    new Set(firstUnlocked ? [firstUnlocked] : []),
  );

  const toggle = (type: MinigameType) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-12 pb-16 overflow-y-auto">
      {/* Fixed back button at bottom center */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 bg-cyber-bg">
        <CyberButton variant="muted" prompt onClick={handleBack} className="w-auto">
          {onBack ? "BACK TO VENDOR" : "BACK TO MENU"}
        </CyberButton>
      </div>
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <ScreenHeader
          subtitle="REFERENCE ARCHIVE"
          title="OPERATION MANUAL"
          description="CODEX — PROTOCOL REFERENCE"
        />
      </div>

      {/* Progress indicator */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white/30 text-[10px] uppercase tracking-widest glitch-subtle">
            PROTOCOLS LICENSED
          </span>
          <span className="text-cyber-cyan/60 text-xs font-mono tabular-nums">
            {unlockedCount} / {totalCount}
          </span>
        </div>
        <div className="h-1 w-full bg-white/10">
          <div
            className="h-full bg-cyber-cyan/50 transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Entries */}
      <div className="w-full max-w-2xl space-y-2 mb-8">
        {ALL_MINIGAMES.map((type) =>
          unlockedSet.has(type) ? (
            <UnlockedEntry
              key={type}
              type={type}
              briefing={getMinigameBriefing(type)}
              expanded={expanded.has(type)}
              onToggle={() => toggle(type)}
            />
          ) : UNLOCKABLE_MINIGAMES.includes(type) ? (
            <LockedEntry key={type} type={type} />
          ) : null,
        )}
      </div>

      {/* Unlock hint — only show if some are locked and not in pause context */}
      {unlockedCount < totalCount && !onBack && (
        <div className="w-full max-w-2xl border border-dashed border-white/10 px-4 py-3 mb-6 text-center">
          <p className="text-white/20 text-[10px] uppercase tracking-widest">
            Locked protocols can be purchased in the{" "}
            <button
              type="button"
              onClick={() => setStatus("meta-shop")}
              className="text-cyber-cyan/40 hover:text-cyber-cyan/70 transition-colors cursor-pointer underline underline-offset-2"
            >
              META SHOP
            </button>
          </p>
        </div>
      )}

      {/* Replay briefing — only from menu, not during a run */}
      {!onBack && (
        <div className="w-full max-w-2xl mb-8">
          <CyberButton
            variant="muted"
            prompt
            onClick={() => {
              resetOnboarding();
              toast("System briefing reset. It will replay when you return to the menu.", {
                duration: 4000,
                className: "font-mono text-xs uppercase tracking-wider",
              });
            }}
          >
            REPLAY SYSTEM BRIEFING
          </CyberButton>
        </div>
      )}

    </div>
  );
}
