// ---------------------------------------------------------------------------
// CountdownDisplay — shared countdown phase (3, 2, 1, GO)
// ---------------------------------------------------------------------------

interface CountdownDisplayProps {
  title: string;
  subtitle: string;
  value: number;
  children?: React.ReactNode;
}

/**
 * Renders the pre-minigame countdown:
 *
 * - `subtitle` — context line (e.g. "FLOOR 3 // PROTOCOL 2 OF 4" or "TRAINING — ROUND 5")
 * - `title`    — minigame display name (rendered in cyan heading)
 * - `value`    — countdown number; 0 renders "GO"
 * - `children` — extra info below the countdown number (run mode: +CR / -HP)
 */
export function CountdownDisplay({ title, subtitle, value, children }: CountdownDisplayProps) {
  return (
    <div className="text-center select-none">
      <p className="text-white/30 text-xs uppercase tracking-widest mb-4 glitch-subtle">
        {subtitle}
      </p>
      <h2 className="text-3xl sm:text-5xl font-heading uppercase tracking-wider text-cyber-cyan mb-8 glitch-text">
        {title}
      </h2>
      <p className="text-6xl sm:text-8xl font-bold text-white/80 tabular-nums glitch-flicker">
        {value > 0 ? value : "GO"}
      </p>
      {children}
    </div>
  );
}
