import { useCallback } from "react";

// ── Helper ───────────────────────────────────────────────────
/** Dispatch a synthetic keyboard event on `window`. */
function fireKey(key: string) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true }),
  );
}

// ── DPad ─────────────────────────────────────────────────────

function DPad() {
  const press = useCallback((key: string) => () => fireKey(key), []);

  const btn =
    "flex items-center justify-center min-w-[48px] min-h-[48px] w-12 h-12 " +
    "rounded border border-cyber-cyan/50 bg-cyber-bg/70 text-cyber-cyan text-lg font-bold " +
    "touch-manipulation select-none " +
    "active:bg-cyber-cyan/20 active:scale-95 active:shadow-[0_0_12px_rgba(0,255,255,0.4)] " +
    "transition-all duration-100";

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Top row — Up */}
      <div className="flex justify-center">
        <button className={btn} onPointerDown={press("ArrowUp")} aria-label="Up">
          ▲
        </button>
      </div>
      {/* Bottom row — Left, Down, Right */}
      <div className="flex gap-1">
        <button className={btn} onPointerDown={press("ArrowLeft")} aria-label="Left">
          ◀
        </button>
        <button className={btn} onPointerDown={press("ArrowDown")} aria-label="Down">
          ▼
        </button>
        <button className={btn} onPointerDown={press("ArrowRight")} aria-label="Right">
          ▶
        </button>
      </div>
    </div>
  );
}

// ── Bracket Buttons ──────────────────────────────────────────

const BRACKET_KEYS = [")", "]", "}", ">", "|", "/"] as const;

function BracketButtons() {
  const press = useCallback((key: string) => () => fireKey(key), []);

  const btn =
    "flex items-center justify-center min-w-[48px] min-h-[48px] px-3 py-2 " +
    "rounded border border-cyber-cyan/50 bg-cyber-bg/70 text-cyber-cyan text-lg font-bold font-mono " +
    "touch-manipulation select-none " +
    "active:bg-cyber-cyan/20 active:scale-95 active:shadow-[0_0_12px_rgba(0,255,255,0.4)] " +
    "transition-all duration-100";

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {BRACKET_KEYS.map((key) => (
        <button key={key} className={btn} onPointerDown={press(key)} aria-label={key}>
          {key}
        </button>
      ))}
    </div>
  );
}

// ── TouchControls wrapper ────────────────────────────────────

export interface TouchControlsProps {
  type: "dpad" | "brackets" | "none";
}

export function TouchControls({ type }: TouchControlsProps) {
  if (type === "none") return null;

  return (
    <div
      className="touch-only w-full flex items-center justify-center border-t border-white/10 pt-3 pb-2"
    >
      <div className="px-4 py-3">
        {type === "dpad" && <DPad />}
        {type === "brackets" && <BracketButtons />}
      </div>
    </div>
  );
}
