import { toast } from "sonner";
import { useGameStore } from "@/store/game-store";

/**
 * Show a one-time hint toast. If the hint has already been shown
 * (persisted in meta state), this is a no-op.
 */
export function showHintOnce(id: string, message: string): void {
  const state = useGameStore.getState();
  if (state.hintsShown[id]) return;
  state.markHintShown(id);
  toast(message, {
    duration: 6000,
    className: "font-mono text-xs uppercase tracking-wider",
  });
}
