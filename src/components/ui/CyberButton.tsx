import { cn } from "@/lib/utils";
import { CLI_PROMPT } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Variant styles
// ---------------------------------------------------------------------------

const VARIANT_CLASSES = {
  /** Cyan border/text, cyan hover glow — primary actions */
  primary:
    "border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10 hover:border-cyber-cyan/70",
  /** White/40 border/text, subtle hover — standard menu items */
  default:
    "border-white/10 text-white/60 hover:bg-white/5 hover:text-white/90 hover:border-white/30",
  /** Magenta border/text — destructive actions */
  danger:
    "border-cyber-magenta/30 text-cyber-magenta/70 hover:bg-cyber-magenta/10 hover:border-cyber-magenta/50",
  /** Dim border/text — back buttons, secondary actions */
  muted:
    "border-white/15 text-white/40 hover:bg-white/5 hover:text-white/70 hover:border-white/30",
} as const;

export type CyberButtonVariant = keyof typeof VARIANT_CLASSES;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CyberButtonProps {
  variant?: CyberButtonVariant;
  /** Prepend the `> _` CLI prompt before children */
  prompt?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** Extra classes for size overrides etc. */
  className?: string;
  children: React.ReactNode;
  /** Optional data-testid for testing */
  "data-testid"?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shared cyberpunk-styled button used across menu screens.
 *
 * Replaces duplicated MenuButton / PauseButton patterns with a single
 * configurable component.
 */
export function CyberButton({
  variant = "default",
  prompt = false,
  onClick,
  disabled = false,
  className,
  children,
  "data-testid": testId,
}: CyberButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        // Base styles shared by all variants
        "text-left text-sm uppercase tracking-widest font-mono",
        "border transition-colors duration-150",
        "cursor-pointer select-none",
        disabled && "opacity-40 cursor-not-allowed",
        VARIANT_CLASSES[variant],
        // Default padding — can be overridden via className
        "w-full py-3 px-4",
        className,
      )}
    >
      {prompt && CLI_PROMPT}
      {children}
    </button>
  );
}
