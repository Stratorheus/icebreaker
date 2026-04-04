import { useGameStore } from "@/store/game-store";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { CyberButton } from "@/components/ui/CyberButton";
import { KOFI_URL, GITHUB_REPO_URL } from "@/lib/constants";

// ---------------------------------------------------------------------------
// External link helper
// ---------------------------------------------------------------------------

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyber-cyan/60 hover:text-cyber-cyan transition-colors underline underline-offset-2"
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// About screen
// ---------------------------------------------------------------------------

export function About() {
  const setStatus = useGameStore((s) => s.setStatus);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-12 pb-16 overflow-y-auto">
      {/* Fixed back button at bottom center */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 bg-cyber-bg">
        <CyberButton variant="muted" prompt onClick={() => setStatus("menu")} className="w-auto">
          BACK TO MENU
        </CyberButton>
      </div>

      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <ScreenHeader
          subtitle="SYSTEM MANIFEST"
          title="ABOUT"
          description="ICEBREAKER — NEURAL INTRUSION SYSTEM"
        />
      </div>

      {/* Credits */}
      <section className="w-full max-w-2xl border border-white/10 bg-white/[0.02] p-4 mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4 glitch-subtle">
          CREDITS
        </h2>
        <div className="space-y-3 text-sm text-white/60">
          <p>
            Created by{" "}
            <ExtLink href="https://skorupa.dev">Martin Skorupa</ExtLink>
          </p>
          <p>
            Inspired by the hacking minigames in{" "}
            <ExtLink href="https://store.steampowered.com/app/1812820/Bitburner/">
              Bitburner
            </ExtLink>
          </p>
        </div>
      </section>

      {/* Links */}
      <section className="w-full max-w-2xl border border-white/10 bg-white/[0.02] p-4 mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4 glitch-subtle">
          LINKS
        </h2>
        <div className="space-y-2 text-sm">
          <p>
            <ExtLink href={GITHUB_REPO_URL}>GitHub Repository</ExtLink>
          </p>
          <p>
            <ExtLink href="https://linkedin.com/in/martin-skorupa">LinkedIn</ExtLink>
          </p>
          <p>
            <ExtLink href={KOFI_URL}>Support on Ko-fi</ExtLink>
          </p>
        </div>
      </section>

      {/* License + Font */}
      <section className="w-full max-w-2xl border border-white/10 bg-white/[0.02] p-4 mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4 glitch-subtle">
          LICENSES
        </h2>
        <div className="space-y-2 text-xs text-white/40">
          <p>Source code: MIT License</p>
          <p>
            Heading font:{" "}
            <ExtLink href="https://fonts.google.com/specimen/Audiowide">
              Audiowide
            </ExtLink>{" "}
            by Astigmatic — SIL Open Font License 1.1
          </p>
        </div>
      </section>

      {/* Version */}
      <div className="w-full max-w-2xl text-center mt-2 mb-8">
        <p className="text-white/20 text-[10px] uppercase tracking-widest glitch-flicker">
          {`v${__APP_VERSION__}`}
        </p>
      </div>
    </div>
  );
}
