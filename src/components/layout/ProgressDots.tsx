interface ProgressDotsProps {
  /** Total number of dots */
  total: number;
  /** How many steps completed (green) */
  current: number;
  /** Currently active index (pulsing cyan). Set to -1 to disable. */
  activeIndex: number;
}

/**
 * Colored progress dots used by multi-step minigames.
 *
 * - Completed: green with glow
 * - Active: cyan with pulse
 * - Remaining: dim white
 */
export function ProgressDots({ total, current, activeIndex }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const isCompleted = i < current;
        const isActive = i === activeIndex;

        return (
          <div
            key={i}
            className={`
              w-3 h-3 rounded-full transition-all duration-200
              ${
                isCompleted
                  ? "bg-cyber-green shadow-[0_0_6px_rgba(0,255,65,0.5)]"
                  : isActive
                    ? "bg-cyber-cyan animate-pulse shadow-[0_0_6px_rgba(0,255,255,0.4)]"
                    : "bg-white/15"
              }
            `}
          />
        );
      })}
    </div>
  );
}
