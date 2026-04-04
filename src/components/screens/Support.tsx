import { useGameStore } from "@/store/game-store";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { KOFI_URL } from "@/lib/constants";

export function Support() {
  const setStatus = useGameStore((s) => s.setStatus);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-16">
      {/* Fixed back button at bottom center */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
        <button
          type="button"
          onClick={() => setStatus("menu")}
          className="px-5 py-2 text-[10px] font-mono uppercase tracking-widest text-white/50 hover:text-cyber-cyan border border-white/10 hover:border-cyber-cyan/40 bg-cyber-bg transition-colors cursor-pointer"
        >
          [ BACK TO MENU ]
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-md mb-8 text-center">
        <ScreenHeader
          subtitle="OPERATOR SUPPORT"
          title="FUND THE OP"
        />
      </div>

      {/* Message */}
      <div className="w-full max-w-md text-center mb-8">
        <p className="text-white/50 text-sm leading-relaxed">
          Enjoyed breaching the ICE? Help fund the next intrusion module.
        </p>
        <p className="text-white/30 text-xs mt-2">
          Every contribution keeps the servers running and new protocols in development.
        </p>
      </div>

      {/* Ko-fi CTA */}
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="
          inline-block px-8 py-4
          text-sm font-mono uppercase tracking-widest
          border-2 border-cyber-magenta/50 text-cyber-magenta
          hover:bg-cyber-magenta/10 hover:border-cyber-magenta/80
          transition-colors cursor-pointer select-none
          glitch-text
        "
      >
        ♥ SUPPORT ON KO-FI
      </a>
    </div>
  );
}
