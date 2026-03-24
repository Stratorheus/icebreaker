import { CLI_PROMPT } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScreenHeaderProps {
  subtitle: string;
  title: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shared screen header with CLI prompt subtitle, glitch title, and
 * optional description line. Used across Codex, Stats, Training,
 * MetaShop, RunShop, etc.
 */
export function ScreenHeader({ subtitle, title, description }: ScreenHeaderProps) {
  return (
    <>
      <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-1 glitch-flicker">
        {CLI_PROMPT}{subtitle}
      </p>
      <h1 className="text-3xl sm:text-4xl font-heading uppercase tracking-wider text-cyber-cyan glitch-text">
        {title}
      </h1>
      {description && (
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1 glitch-subtle">
          {description}
        </p>
      )}
    </>
  );
}
