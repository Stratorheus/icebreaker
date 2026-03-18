/**
 * Full-viewport scanline overlay that gives a CRT/terminal feel.
 * Pure CSS, no interaction — pointer-events: none.
 */
export function ScanlineOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
      style={{
        background:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.015) 2px, rgba(0,255,255,0.015) 4px)",
      }}
    />
  );
}
