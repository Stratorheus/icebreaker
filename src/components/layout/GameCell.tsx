/**
 * Shared cell styling for grid minigames.
 * Returns className string based on cell state.
 *
 * Usage:
 *   <button className={`${cellStyles({ isCursor, isTouch })} ${sizeClass} ${gameSpecificClass}`}>
 *
 * Base includes: flex centering, rounded-md, border, bg, transition, focus reset, cursor.
 * Hover adds: subtle bg + border lift.
 * Cursor adds: cyan ring + glow (desktop only).
 *
 * Game-specific state classes (selected, revealed, flagged, etc.) should be applied
 * separately and will override the base/hover as needed.
 */
export function cellStyles(state: {
  isCursor?: boolean;
  isTouch?: boolean;
}): string {
  const base =
    "flex items-center justify-center rounded-md border border-white/10 bg-white/5 transition-all duration-150 focus:outline-none select-none cursor-pointer";
  const hover = "hover:bg-white/[0.08] hover:border-white/25";
  const cursor =
    !state.isTouch && state.isCursor
      ? "ring-2 ring-cyber-cyan ring-offset-0 border-cyber-cyan/80 bg-cyber-cyan/10 shadow-[0_0_10px_rgba(0,255,255,0.25)] z-10"
      : "";
  return `${base} ${hover} ${cursor}`.trim();
}
