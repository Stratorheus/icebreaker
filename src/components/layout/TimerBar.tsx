import { cn } from "@/lib/utils";

interface TimerBarProps {
  /** 0 = empty, 1 = full */
  progress: number;
  className?: string;
}

/**
 * Thin horizontal timer bar with color transitions:
 *  - > 0.5:  cyan (#00ffff)
 *  - 0.25-0.5: orange (#ff6600)
 *  - < 0.25: magenta (#ff0066) with glow
 */
export function TimerBar({ progress, className }: TimerBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));

  const color =
    clamped > 0.5
      ? "var(--color-cyber-cyan)"
      : clamped > 0.25
        ? "var(--color-cyber-orange)"
        : "var(--color-cyber-magenta)";

  const glow =
    clamped <= 0.25
      ? `0 0 8px var(--color-cyber-magenta), 0 0 16px var(--color-cyber-magenta)`
      : "none";

  return (
    <div
      className={cn("h-1 w-full rounded-full bg-white/10", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-colors duration-500 ease-linear"
        style={{
          width: `${clamped * 100}%`,
          backgroundColor: color,
          boxShadow: glow,
        }}
      />
    </div>
  );
}
