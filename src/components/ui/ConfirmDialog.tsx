// ---------------------------------------------------------------------------
// ConfirmDialog — shared confirm / cancel button pair
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Compact inline variant — smaller text, less padding, no border/bg. For use inside existing layouts. */
  compact?: boolean;
}

/**
 * Inline confirm/cancel prompt used for destructive actions (quit run,
 * quit training, etc.).
 *
 * Renders:
 * - Magenta/danger confirm button
 * - White/muted cancel button
 *
 * The consumer is responsible for the overlay / positioning wrapper.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  onConfirm,
  onCancel,
  compact = false,
}: ConfirmDialogProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-widest font-mono text-cyber-magenta/70">
          {title}
        </span>
        <button
          type="button"
          data-testid="confirm-quit"
          onClick={onConfirm}
          className="
            py-1.5 px-4
            text-[10px] uppercase tracking-widest font-mono font-bold
            border border-cyber-magenta/50 text-cyber-magenta
            hover:bg-cyber-magenta/10 hover:border-cyber-magenta/80
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="
            py-1.5 px-4
            text-[10px] uppercase tracking-widest font-mono
            border border-white/15 text-white/40
            hover:bg-white/5 hover:text-white/70
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {cancelLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8 border border-white/15 bg-black/90">
      <h2 className="text-2xl sm:text-3xl font-heading uppercase tracking-wider text-cyber-magenta glitch-text">
        {title}
      </h2>
      {message && (
        <p className="text-white/40 text-xs uppercase tracking-widest">
          {message}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="confirm-quit"
          onClick={onConfirm}
          className="
            py-2.5 px-8
            text-sm uppercase tracking-widest font-mono font-bold
            border border-cyber-magenta/50 text-cyber-magenta
            hover:bg-cyber-magenta/10 hover:border-cyber-magenta/80
            active:bg-cyber-magenta/20
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="
            py-2.5 px-8
            text-sm uppercase tracking-widest font-mono
            border border-white/20 text-white/50
            hover:bg-white/5 hover:text-white/80
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
