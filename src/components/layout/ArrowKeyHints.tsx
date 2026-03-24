/**
 * Shared arrow key hint display for grid minigames.
 * Shows ↑ above ←↓→ in a keyboard layout pattern.
 *
 * When `vertical` is true, only shows ↑↓ (for list-based games like SubnetScan).
 */
export function ArrowKeyHints({ vertical = false }: { vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="desktop-only inline-flex items-center gap-1">
        <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
          {"\u2191"}
        </kbd>
        <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
          {"\u2193"}
        </kbd>
      </div>
    );
  }

  return (
    <div className="desktop-only inline-flex flex-col items-center gap-1">
      <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
        {"\u2191"}
      </kbd>
      <div className="flex items-center gap-1">
        <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
          {"\u2190"}
        </kbd>
        <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
          {"\u2193"}
        </kbd>
        <kbd className="px-3 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono">
          {"\u2192"}
        </kbd>
      </div>
    </div>
  );
}
