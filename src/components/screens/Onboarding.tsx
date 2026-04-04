import { useCallback, useEffect, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

const STEPS = [
  "You're a hacker breaching corporate ICE. Each RUN is a gauntlet of timed hacking protocols. Fail one = you take damage. HP hits zero = run over.",
  "Survive floors to earn DATA. Spend DATA in the META SHOP — permanent upgrades, new protocols, and more. The further you go, the more you earn.",
  "Hit START RUN when you're ready. Good luck, operator.",
];

export function Onboarding() {
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);

  const advance = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  }, [step]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [advance]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 cursor-pointer select-none"
      onClick={advance}
    >
      <div className="w-full max-w-lg text-center mb-8">
        <ScreenHeader
          subtitle="OPERATOR INITIALIZATION"
          title="SYSTEM BRIEFING"
        />
      </div>

      <div className="w-full max-w-lg border border-white/10 bg-white/[0.02] p-6 mb-6">
        <p className="text-white/60 text-sm leading-relaxed font-mono">
          {STEPS[step]}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 transition-colors ${
              i === step ? "bg-cyber-cyan" : i < step ? "bg-cyber-cyan/30" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Action hint */}
      {step < STEPS.length - 1 ? (
        <p className="text-white/20 text-[10px] uppercase tracking-widest">
          Click or press Space to continue
        </p>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); completeOnboarding(); }}
          className="px-8 py-3 text-sm font-mono uppercase tracking-widest border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10 hover:border-cyber-cyan/70 transition-colors cursor-pointer"
        >
          [ BEGIN ]
        </button>
      )}
    </div>
  );
}
