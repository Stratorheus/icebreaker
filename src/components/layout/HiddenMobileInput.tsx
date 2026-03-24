import type { RefObject } from "react";

interface HiddenMobileInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onInput: (e: React.FormEvent<HTMLInputElement>) => void;
  /** Label for the tap-to-type button. Default "TAP HERE TO TYPE" */
  label?: string;
  /** Input mode attribute. Default "text" */
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "search" | "email" | "url" | "none";
}

/**
 * Hidden input element + touch "TAP HERE TO TYPE" button.
 *
 * Used by minigames that need a system keyboard on mobile.
 * The hidden input is positioned off-screen. The button is shown
 * only on touch devices (via touch-only class).
 */
export function HiddenMobileInput({
  inputRef,
  onInput,
  label = "TAP HERE TO TYPE",
  inputMode = "text",
}: HiddenMobileInputProps) {
  return (
    <>
      <input
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="fixed -top-24 -left-24 w-px h-px opacity-0"
        onInput={onInput}
      />
      <button
        type="button"
        className="touch-only px-4 py-2 border border-cyber-cyan/40 rounded-lg bg-cyber-cyan/10 text-cyber-cyan text-xs uppercase tracking-widest font-mono animate-pulse"
        onClick={() => inputRef.current?.focus()}
      >
        {label}
      </button>
    </>
  );
}
