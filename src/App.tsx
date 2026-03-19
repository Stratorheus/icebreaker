import { Toaster } from "sonner";
import { useGameStore } from "@/store/game-store";
import { ScanlineOverlay } from "@/components/layout/ScanlineOverlay";
import { HUD } from "@/components/layout/HUD";
import { MainMenu } from "@/components/screens/MainMenu";
import { MinigameScreen } from "@/components/screens/MinigameScreen";
import { RunShop } from "@/components/screens/RunShop";
import { DeathScreen } from "@/components/screens/DeathScreen";
import { MetaShop } from "@/components/screens/MetaShop";
import { Training } from "@/components/screens/Training";
import { Stats } from "@/components/screens/Stats";
import { Codex } from "@/components/screens/Codex";
import { MilestoneOverlay } from "@/components/screens/MilestoneOverlay";
import { PauseMenu } from "@/components/screens/PauseMenu";

// ---------------------------------------------------------------------------
// App — status-based screen router
// ---------------------------------------------------------------------------

export default function App() {
  const status = useGameStore((s) => s.status);

  const renderScreen = () => {
    switch (status) {
      case "menu":
        return <MainMenu />;
      case "playing":
        return <MinigameScreen />;
      case "shop":
        return <RunShop />;
      case "dead":
        return <DeathScreen />;
      case "training":
        return <Training />;
      case "codex":
        return <Codex />;
      case "meta-shop":
        return <MetaShop />;
      case "stats":
        return <Stats />;
      case "milestone":
        return <MilestoneOverlay />;
      case "paused":
        return <PauseMenu />;
      default:
        return <MainMenu />;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg text-white font-mono">
      <ScanlineOverlay />
      <HUD />
      {renderScreen()}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          className: "font-mono text-xs uppercase tracking-wider",
        }}
      />
    </div>
  );
}
