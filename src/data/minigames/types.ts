import type { MinigameType } from "@/types/game";
import type { MinigameProps } from "@/types/minigame";
import type { MetaUpgrade } from "@/types/shop";

export interface MinigameBriefing {
  rules: string[];
  controls: {
    desktop: string;
    touch: string;
  };
  tips: string[];
  hint: {
    desktop: string;
    touch: string;
  };
}

export interface MinigameConfig {
  id: MinigameType;
  displayName: string;
  component: React.ComponentType<MinigameProps>;
  baseTimeLimit: number;
  starting: boolean;
  unlockPrice?: number | "dynamic";
  licenseId?: string;
  requires?: string;
  briefing: MinigameBriefing;
  metaUpgrades: MetaUpgrade[];
}
