// ---------------------------------------------------------------------------
// ResultFlash — shared SUCCESS / FAILED display
// ---------------------------------------------------------------------------

interface ResultFlashProps {
  success: boolean;
  subtitle?: string;
  children?: React.ReactNode;
}

/**
 * Large heading flash shown after a minigame round completes.
 *
 * - SUCCESS → cyan heading
 * - FAILED  → magenta heading
 *
 * `subtitle` provides the contextual line below (e.g. "BREACH COMPLETE").
 * `children` allows extra content (e.g. earned credits in run mode).
 */
export function ResultFlash({ success, subtitle, children }: ResultFlashProps) {
  return (
    <div className="text-center select-none">
      <h2
        className={`text-5xl sm:text-7xl font-heading uppercase tracking-wider glitch-text ${
          success ? "text-cyber-cyan" : "text-cyber-magenta"
        }`}
      >
        {success ? "SUCCESS" : "FAILED"}
      </h2>
      {children}
      {subtitle && (
        <p className="mt-2 text-white/30 text-sm uppercase tracking-widest glitch-subtle">
          {subtitle}
        </p>
      )}
    </div>
  );
}
