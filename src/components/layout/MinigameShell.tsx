import { TimerBar } from "@/components/layout/TimerBar";

interface MinigameShellProps {
  timer: { progress: number };
  children: React.ReactNode;
  /** Max width class for the content area. Default "max-w-lg" */
  maxWidth?: string;
  /** Gap class for the content area. Default "gap-6" */
  gap?: string;
  /** Timer bottom margin class. Default "mb-6" */
  timerGap?: string;
  /** Desktop-only instruction footer */
  desktopHint?: React.ReactNode;
  /** Touch-only instruction footer */
  touchHint?: React.ReactNode;
  /** Extra props spread on the outer div (e.g. data-testid) */
  outerProps?: React.HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>;
}

/**
 * Shared layout wrapper for all minigames.
 *
 * Renders: outer container → TimerBar → flex content area → instruction footers.
 */
export function MinigameShell({
  timer,
  children,
  maxWidth = "max-w-lg",
  gap = "gap-6",
  timerGap = "mb-6",
  desktopHint,
  touchHint,
  outerProps,
}: MinigameShellProps) {
  return (
    <div
      className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6"
      {...outerProps}
    >
      <TimerBar progress={timer.progress} className={`w-full max-w-md ${timerGap}`} />

      <div className={`flex-1 flex flex-col items-center justify-center ${gap} w-full ${maxWidth}`}>
        {children}
      </div>

      {desktopHint && (
        <div className="desktop-only mt-6 text-center">
          {desktopHint}
        </div>
      )}
      {touchHint && (
        <div className="touch-only mt-6 text-center">
          {touchHint}
        </div>
      )}
    </div>
  );
}
