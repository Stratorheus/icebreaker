import { useGameStore } from "@/store/game-store";
import { ScanlineOverlay } from "@/components/layout/ScanlineOverlay";
import { HUD } from "@/components/layout/HUD";
import { MainMenu } from "@/components/screens/MainMenu";
import { MinigameScreen } from "@/components/screens/MinigameScreen";
import { RunShop } from "@/components/screens/RunShop";
import { DeathScreen } from "@/components/screens/DeathScreen";
import { MetaShop } from "@/components/screens/MetaShop";

// ---------------------------------------------------------------------------
// Placeholder screens (implemented in later tasks)
// ---------------------------------------------------------------------------

function Training() {
  const setStatus = useGameStore((s) => s.setStatus);
  return (
    <PlaceholderScreen
      title="TRAINING"
      onBack={() => setStatus("menu")}
    />
  );
}

function Codex() {
  const setStatus = useGameStore((s) => s.setStatus);
  return (
    <PlaceholderScreen title="CODEX" onBack={() => setStatus("menu")} />
  );
}

function Stats() {
  const setStatus = useGameStore((s) => s.setStatus);
  return (
    <PlaceholderScreen title="STATS" onBack={() => setStatus("menu")} />
  );
}

function PlaceholderScreen({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold uppercase tracking-wider text-cyber-cyan mb-4">
        {title}
      </h1>
      <p className="text-white/30 text-sm uppercase tracking-widest mb-8">
        {">"}_&nbsp;COMING SOON
      </p>
      <button
        type="button"
        onClick={onBack}
        className="
          py-2 px-6
          text-sm uppercase tracking-widest font-mono
          border border-white/20 text-white/50
          hover:bg-white/5 hover:text-white/80
          transition-colors duration-150
          cursor-pointer select-none
        "
      >
        {">"}_&nbsp;BACK
      </button>
    </div>
  );
}

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
      default:
        return <MainMenu />;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg text-white font-mono">
      <ScanlineOverlay />
      <HUD />
      {renderScreen()}
    </div>
  );
}
