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
/** Cursor ring + glow classes (desktop only). Reusable across grids and lists. */
export const CURSOR_CLASSES = "ring-2 ring-cyber-cyan ring-offset-0 border-cyber-cyan/80 bg-cyber-cyan/10 shadow-[0_0_10px_rgba(0,255,255,0.25)] z-10";

/** Standard hover classes for interactive cells/rows. */
export const HOVER_CLASSES = "hover:bg-white/[0.08] hover:border-white/25";

export function cellStyles(state: {
  isCursor?: boolean;
  isTouch?: boolean;
}): string {
  const base =
    "flex items-center justify-center rounded-md border border-white/10 bg-white/5 transition-all duration-150 focus:outline-none select-none cursor-pointer";
  const cursor =
    !state.isTouch && state.isCursor ? CURSOR_CLASSES : "";
  return `${base} ${HOVER_CLASSES} ${cursor}`.trim();
}
