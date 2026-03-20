import type { MinigameType } from "@/types/game";

export const MINIGAME_DISPLAY_NAMES: Record<MinigameType, string> = {
  "slash-timing": "Slash Timing",
  "close-brackets": "Code Inject",
  "type-backward": "Decrypt Signal",
  "match-arrows": "Packet Route",
  "mine-sweep": "Memory Scan",
  "find-symbol": "Address Lookup",
  "wire-cutting": "Wire Cutting",
  "cipher-crack": "Cipher Crack V1",
  "defrag": "Defrag",
  "network-trace": "Network Trace",
  "signal-echo": "Signal Echo",
  "checksum-verify": "Checksum Verify",
  "port-scan": "Port Scan",
  "subnet-scan": "Subnet Scan",
  "cipher-crack-v2": "Cipher Crack V2",
};

export function getMinigameDisplayName(type: MinigameType): string {
  return MINIGAME_DISPLAY_NAMES[type] ?? type;
}
