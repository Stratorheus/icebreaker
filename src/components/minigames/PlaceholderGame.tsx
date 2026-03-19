import { useEffect, useRef } from "react";
import type { MinigameProps } from "@/types/minigame";
import type { MinigameType } from "@/types/game";
import { getMinigameDisplayName } from "@/data/minigame-names";

/**
 * PlaceholderGame — temporary stub for unimplemented minigames.
 * Shows the game name + "COMING SOON" and auto-completes as success after 2s.
 * Each real task will replace its placeholder with the actual implementation.
 */
function PlaceholderGameInner({
  minigameType,
  onComplete,
}: MinigameProps & { minigameType: MinigameType }) {
  const resolvedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      onComplete({
        success: true,
        timeMs: 2000,
        minigame: minigameType,
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete, minigameType]);

  const displayName = getMinigameDisplayName(minigameType);

  return (
    <div className="flex flex-col items-center justify-center text-center select-none gap-6">
      <h2 className="text-3xl sm:text-5xl font-bold uppercase tracking-wider text-cyber-cyan glitch-text">
        {displayName}
      </h2>
      <p className="text-cyber-magenta text-lg uppercase tracking-[0.3em] font-mono animate-pulse">
        COMING SOON
      </p>
      <p className="text-white/30 text-xs uppercase tracking-widest">
        Auto-completing in 2s...
      </p>
    </div>
  );
}

/** Factory: creates a placeholder component bound to a specific minigame type. */
function createPlaceholder(type: MinigameType): React.ComponentType<MinigameProps> {
  const Placeholder = (props: MinigameProps) => (
    <PlaceholderGameInner {...props} minigameType={type} />
  );
  Placeholder.displayName = `Placeholder(${type})`;
  return Placeholder;
}

export const DefragPlaceholder = createPlaceholder("defrag");
export const NetworkTracePlaceholder = createPlaceholder("network-trace");
export const DataStreamPlaceholder = createPlaceholder("data-stream");
export const SignalEchoPlaceholder = createPlaceholder("signal-echo");
export const ChecksumVerifyPlaceholder = createPlaceholder("checksum-verify");
export const PortScanPlaceholder = createPlaceholder("port-scan");
export const SubnetScanPlaceholder = createPlaceholder("subnet-scan");
export const CipherCrackV2Placeholder = createPlaceholder("cipher-crack-v2");
