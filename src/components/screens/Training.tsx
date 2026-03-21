import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameType, PowerUpInstance } from "@/types/game";
import type { MinigameResult } from "@/types/minigame";
import { getMinigameDisplayName } from "@/data/minigame-names";
import { MINIGAME_BRIEFINGS } from "@/data/minigame-descriptions";
import type { MinigameBriefing } from "@/data/minigame-descriptions";
import { useTouchDevice } from "@/hooks/use-touch-device";
import { META_UPGRADE_POOL } from "@/data/meta-upgrades";
import { SlashTiming } from "@/components/minigames/SlashTiming";
import { CloseBrackets } from "@/components/minigames/CloseBrackets";
import { TypeBackward } from "@/components/minigames/TypeBackward";
import { MatchArrows } from "@/components/minigames/MatchArrows";
import { FindSymbol } from "@/components/minigames/FindSymbol";
import { MineSweep } from "@/components/minigames/MineSweep";
import { WireCutting } from "@/components/minigames/WireCutting";
import { CipherCrack } from "@/components/minigames/CipherCrack";
import { Defrag } from "@/components/minigames/Defrag";
import { NetworkTrace } from "@/components/minigames/NetworkTrace";
import { SignalEcho } from "@/components/minigames/SignalEcho";
import { ChecksumVerify } from "@/components/minigames/ChecksumVerify";
import { PortScan } from "@/components/minigames/PortScan";
import { SubnetScan } from "@/components/minigames/SubnetScan";
import { CipherCrackV2 } from "@/components/minigames/CipherCrackV2";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAINING_TIME_LIMIT = 30; // generous 30s for all trial rounds

const DIFFICULTY_OPTIONS: { label: string; value: number }[] = [
  { label: "TRIVIAL", value: 0.05 },
  { label: "EASY", value: 0.15 },
  { label: "NORMAL", value: 0.3 },
  { label: "MEDIUM", value: 0.5 },
  { label: "HARD", value: 0.7 },
  { label: "EXPERT", value: 0.85 },
  { label: "INSANE", value: 1.0 },
];

// Briefing data imported from shared source
// (see src/data/minigame-descriptions.ts)

// ---------------------------------------------------------------------------
// Minigame component map (same as MinigameScreen)
// ---------------------------------------------------------------------------

const MINIGAME_COMPONENTS: Record<
  MinigameType,
  React.ComponentType<import("@/types/minigame").MinigameProps>
> = {
  "slash-timing": SlashTiming,
  "close-brackets": CloseBrackets,
  "type-backward": TypeBackward,
  "match-arrows": MatchArrows,
  "find-symbol": FindSymbol,
  "mine-sweep": MineSweep,
  "wire-cutting": WireCutting,
  "cipher-crack": CipherCrack,
  "defrag": Defrag,
  "network-trace": NetworkTrace,
  "signal-echo": SignalEcho,
  "checksum-verify": ChecksumVerify,
  "port-scan": PortScan,
  "subnet-scan": SubnetScan,
  "cipher-crack-v2": CipherCrackV2,
};

// ---------------------------------------------------------------------------
// Build meta power-ups (replicated from MinigameScreen)
// ---------------------------------------------------------------------------

function buildMetaPowerUps(
  purchasedUpgrades: Record<string, number>,
  type: MinigameType,
): PowerUpInstance[] {
  const synth: PowerUpInstance[] = [];

  function addIfOwned(
    upgradeId: string,
    effectType: PowerUpInstance["effect"]["type"],
    valueByTier: number[],
    minigame?: MinigameType,
  ) {
    const tier = purchasedUpgrades[upgradeId] ?? 0;
    if (tier <= 0) return;
    const value = valueByTier[tier - 1] ?? valueByTier[valueByTier.length - 1];
    // Look up display name + description from META_UPGRADE_POOL
    const upgradeDef = META_UPGRADE_POOL.find((u) => u.id === upgradeId);
    synth.push({
      id: `meta-${upgradeId}`,
      type: `meta-${upgradeId}`,
      name: upgradeDef?.name ?? upgradeId,
      description: upgradeDef?.description ?? "",
      effect: { type: effectType, value, minigame },
    });
  }

  switch (type) {
    case "close-brackets":
      addIfOwned("bracket-reducer", "minigame-specific", [1], "close-brackets");
      addIfOwned("bracket-mirror", "auto-close", [0.3], "close-brackets");
      break;
    case "mine-sweep":
      addIfOwned("mine-echo", "minigame-specific", [0.20, 0.35, 0.50], "mine-sweep");
      break;
    case "find-symbol":
      addIfOwned("symbol-scanner", "hint", [1], "find-symbol");
      addIfOwned("symbol-magnifier", "minigame-specific", [1], "find-symbol");
      break;
    case "match-arrows":
      addIfOwned("arrow-preview", "peek-ahead", [0.15, 0.25, 0.40], "match-arrows");
      break;
    case "type-backward":
      addIfOwned("type-assist", "hint", [1], "type-backward");
      addIfOwned("reverse-trainer", "minigame-specific", [1], "type-backward");
      break;
    case "wire-cutting":
      addIfOwned("wire-labels", "hint", [1], "wire-cutting");
      break;
    case "cipher-crack":
      addIfOwned("cipher-hint", "hint", [1], "cipher-crack");
      break;
    case "slash-timing":
      addIfOwned("slash-window", "window-extend", [0.25], "slash-timing");
      break;
    case "defrag":
      addIfOwned("defrag-safe-start", "minigame-specific", [1], "defrag");
      break;
    case "network-trace":
      addIfOwned("network-trace-highlight", "minigame-specific", [1000], "network-trace");
      break;
    case "signal-echo":
      addIfOwned("signal-echo-slow", "minigame-specific", [0.3], "signal-echo");
      break;
    case "checksum-verify":
      addIfOwned("checksum-calculator", "minigame-specific", [1], "checksum-verify");
      break;
    case "port-scan":
      addIfOwned("port-scan-deep", "minigame-specific", [2], "port-scan");
      break;
    case "subnet-scan":
      addIfOwned("subnet-cidr-helper", "minigame-specific", [1], "subnet-scan");
      break;
  }

  return synth;
}

// ---------------------------------------------------------------------------
// Training screen phases
// ---------------------------------------------------------------------------

type TrainingPhase = "picker" | "briefing" | "countdown" | "active" | "round-result" | "complete";

// ---------------------------------------------------------------------------
// Training component
// ---------------------------------------------------------------------------

export function Training() {
  const trainingMinigame = useGameStore((s) => s.trainingMinigame);
  const markBriefingSeen = useGameStore((s) => s.markBriefingSeen);
  const setStatus = useGameStore((s) => s.setStatus);
  const setTrainingMinigame = useGameStore((s) => s.setTrainingMinigame);
  const unlockedMinigames = useGameStore((s) => s.unlockedMinigames);

  // If trainingMinigame is already set (from unlock flow), skip picker
  const [phase, setPhase] = useState<TrainingPhase>(
    trainingMinigame ? "briefing" : "picker",
  );
  const [round, setRound] = useState(1);
  const [countdownValue, setCountdownValue] = useState(3);
  const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);
  const [roundResults, setRoundResults] = useState<boolean[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState(0.3);
  const [useMetaUpgrades, setUseMetaUpgrades] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const type = trainingMinigame;

  const handleBack = useCallback(() => {
    setTrainingMinigame(null);
    setStatus("menu");
  }, [setTrainingMinigame, setStatus]);

  const handleFinish = useCallback(() => {
    if (type) markBriefingSeen(type);
    setTrainingMinigame(null);
    setStatus("menu");
  }, [type, markBriefingSeen, setTrainingMinigame, setStatus]);

  // When a game is picked from the picker phase
  const handlePickGame = useCallback(
    (pickedType: MinigameType, difficulty: number, metaUpgrades: boolean) => {
      setTrainingMinigame(pickedType);
      setSelectedDifficulty(difficulty);
      setUseMetaUpgrades(metaUpgrades);
      setPhase("briefing");
      setRound(1);
      setRoundResults([]);
      setLastSuccess(null);
    },
    [setTrainingMinigame],
  );

  // Countdown effect
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdownValue <= 0) {
      setPhase("active");
      return;
    }

    const timer = setTimeout(() => {
      setCountdownValue((v) => v - 1);
    }, 666);

    return () => clearTimeout(timer);
  }, [phase, countdownValue]);

  // Escape key handler for quit confirmation
  useEffect(() => {
    if (phase !== "active" && phase !== "countdown" && phase !== "round-result") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowQuitConfirm(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase]);

  // Quit confirm handlers
  const handleQuitConfirm = useCallback(() => {
    setShowQuitConfirm(false);
    setPhase("complete");
  }, []);

  const handleQuitCancel = useCallback(() => {
    setShowQuitConfirm(false);
  }, []);

  // Handle round completion
  const handleRoundComplete = useCallback(
    (result: MinigameResult) => {
      const success = result.success;
      setLastSuccess(success);
      setRoundResults((prev) => [...prev, success]);
      setPhase("round-result");

      setTimeout(() => {
        setRound((r) => r + 1);
        setCountdownValue(3);
        setPhase("countdown");
      }, 1200);
    },
    [],
  );

  // Picker phase: show list of unlocked minigames with difficulty selection
  if (phase === "picker") {
    return (
      <PickerPhase
        unlockedMinigames={unlockedMinigames}
        onPick={handlePickGame}
        onBack={handleBack}
      />
    );
  }

  if (!type) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="text-white/30 text-sm uppercase tracking-widest mb-8">
          {">"}_&nbsp;NO TRAINING TARGET
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="py-2 px-6 text-sm uppercase tracking-widest font-mono border border-white/20 text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors duration-150 cursor-pointer select-none"
        >
          {">"}_&nbsp;BACK
        </button>
      </div>
    );
  }

  const briefing = MINIGAME_BRIEFINGS[type];
  const showQuitButton = phase === "active" || phase === "countdown" || phase === "round-result";

  return (
    <div className="min-h-screen flex flex-col pt-12 relative">
      {phase === "briefing" && (
        <BriefingPhase
          type={type}
          briefing={briefing}
          difficulty={selectedDifficulty}
          useMetaUpgrades={useMetaUpgrades}
          onBegin={() => {
            setPhase("countdown");
          }}
          onBack={handleBack}
        />
      )}

      {phase === "countdown" && (
        <div className="flex-1 flex items-center justify-center px-4">
          <CountdownPhase
            type={type}
            round={round}
            value={countdownValue}
          />
        </div>
      )}

      {phase === "active" && (
        <div className="flex-1 flex items-center justify-center px-4">
          <ActiveRound
            type={type}
            difficulty={selectedDifficulty}
            useMetaUpgrades={useMetaUpgrades}
            onComplete={handleRoundComplete}
          />
        </div>
      )}

      {phase === "round-result" && (
        <div className="flex-1 flex items-center justify-center px-4">
          <RoundResultFlash
            success={lastSuccess ?? false}
            round={round}
          />
        </div>
      )}

      {phase === "complete" && (
        <div className="flex-1 flex items-center justify-center px-4">
          <CompletePhase
            type={type}
            results={roundResults}
            onFinish={handleFinish}
          />
        </div>
      )}

      {/* Quit button — top-right during active gameplay phases */}
      {showQuitButton && (
        <button
          type="button"
          onClick={() => setShowQuitConfirm(true)}
          className="
            absolute top-3 right-3 z-40
            py-1.5 px-3
            text-xs uppercase tracking-widest font-mono
            border border-cyber-magenta/40 text-cyber-magenta/70
            hover:bg-cyber-magenta/10 hover:border-cyber-magenta/60
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          <span className="desktop-only">ESC — </span>QUIT
        </button>
      )}

      {/* Quit confirmation overlay */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 p-8 border border-white/15 bg-black/90">
            <h2 className="text-2xl sm:text-3xl font-heading uppercase tracking-wider text-cyber-magenta glitch-text">
              QUIT TRAINING?
            </h2>
            <p className="text-white/40 text-xs uppercase tracking-widest">
              CURRENT PROGRESS WILL BE SAVED TO RESULTS
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleQuitConfirm}
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
                CONFIRM
              </button>
              <button
                type="button"
                onClick={handleQuitCancel}
                className="
                  py-2.5 px-8
                  text-sm uppercase tracking-widest font-mono
                  border border-white/20 text-white/50
                  hover:bg-white/5 hover:text-white/80
                  transition-colors duration-150
                  cursor-pointer select-none
                "
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picker phase — choose minigame + difficulty
// ---------------------------------------------------------------------------

function PickerPhase({
  unlockedMinigames,
  onPick,
  onBack,
}: {
  unlockedMinigames: MinigameType[];
  onPick: (type: MinigameType, difficulty: number, metaUpgrades: boolean) => void;
  onBack: () => void;
}) {
  const [selectedDifficulty, setSelectedDifficulty] = useState(0.3);
  const [useMetaUpgrades, setUseMetaUpgrades] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-12 pb-16">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-1 glitch-flicker">
          {">"}_&nbsp;TRAINING MODE
        </p>
        <h1 className="text-3xl sm:text-4xl font-heading uppercase tracking-wider text-cyber-cyan glitch-text">
          SELECT PROTOCOL
        </h1>
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1 glitch-subtle">
          PRACTICE ANY UNLOCKED PROTOCOL — RESULTS NOT RECORDED
        </p>
      </div>

      {/* Difficulty selector */}
      <div className="w-full max-w-2xl mb-6">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-3">
          DIFFICULTY
        </p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setSelectedDifficulty(opt.value)}
              className={`
                py-1.5 px-2
                text-[10px] uppercase tracking-widest font-mono
                border transition-colors duration-150
                cursor-pointer select-none
                ${
                  selectedDifficulty === opt.value
                    ? "border-cyber-cyan/60 text-cyber-cyan bg-cyber-cyan/10"
                    : "border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meta upgrades toggle */}
      <div className="w-full max-w-2xl mb-6">
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <div
            className={`
              w-8 h-4 rounded-full relative transition-colors duration-150
              ${useMetaUpgrades ? "bg-cyber-cyan/30 border-cyber-cyan/50" : "bg-white/5 border-white/15"}
              border
            `}
            onClick={() => setUseMetaUpgrades((v) => !v)}
          >
            <div
              className={`
                absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-150
                ${useMetaUpgrades ? "left-4 bg-cyber-cyan" : "left-0.5 bg-white/30"}
              `}
            />
          </div>
          <span
            className={`
              text-[10px] uppercase tracking-[0.3em] font-mono
              ${useMetaUpgrades ? "text-cyber-cyan" : "text-white/30"}
              group-hover:text-white/50 transition-colors duration-150
            `}
            onClick={() => setUseMetaUpgrades((v) => !v)}
          >
            APPLY META UPGRADES
          </span>
        </label>
      </div>

      {/* Minigame list */}
      <div className="w-full max-w-2xl space-y-2 mb-8">
        {unlockedMinigames.map((type) => {
          return (
            <button
              key={type}
              type="button"
              onClick={() => onPick(type, selectedDifficulty, useMetaUpgrades)}
              className="
                w-full flex items-center justify-between
                px-4 py-3
                text-left cursor-pointer select-none
                border border-white/10 bg-white/[0.02]
                hover:bg-cyber-cyan/[0.05] hover:border-cyber-cyan/30
                transition-colors duration-150
              "
            >
              <div className="flex items-center gap-3">
                <span className="text-cyber-cyan text-[10px] select-none">{">"}</span>
                <span className="text-cyber-cyan text-sm font-heading uppercase tracking-wider">
                  {getMinigameDisplayName(type).toUpperCase()}
                </span>
              </div>
              <span className="text-white/20 text-[10px] uppercase tracking-widest">
                UNLIMITED
              </span>
            </button>
          );
        })}
      </div>

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="
          py-2 px-6
          text-sm uppercase tracking-widest font-mono
          border border-white/15 text-white/40
          hover:bg-white/5 hover:text-white/70 hover:border-white/30
          transition-colors duration-150
          cursor-pointer select-none
        "
      >
        {">"}_&nbsp;BACK TO MENU
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing phase
// ---------------------------------------------------------------------------

function BriefingPhase({
  type,
  briefing,
  difficulty,
  useMetaUpgrades,
  onBegin,
  onBack,
}: {
  type: MinigameType;
  briefing: MinigameBriefing;
  difficulty: number;
  useMetaUpgrades: boolean;
  onBegin: () => void;
  onBack: () => void;
}) {
  const onBeginRef = useRef(onBegin);
  onBeginRef.current = onBegin;
  const isTouch = useTouchDevice();
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);

  // Build meta power-ups for display
  const metaPowerUps = useMemo(() => {
    if (!useMetaUpgrades) return [];
    return buildMetaPowerUps(purchasedUpgrades, type);
  }, [useMetaUpgrades, type, purchasedUpgrades]);

  const diffLabel = DIFFICULTY_OPTIONS.find((d) => d.value === difficulty)?.label ?? "CUSTOM";

  return (
    <div className="flex-1 flex flex-col items-center px-4 pb-12 overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-2xl mt-6 mb-8">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-1 glitch-flicker">
          {">"}_&nbsp;TRAINING PROTOCOL
        </p>
        <h1 className="text-3xl sm:text-4xl font-heading uppercase tracking-wider text-cyber-cyan glitch-text">
          {getMinigameDisplayName(type).toUpperCase()}
        </h1>
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">
          PROTOCOL ID: <span className="text-white/40">{type}</span>
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Rules */}
        <section className="border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">
            {">"}_&nbsp;PROTOCOL RULES
          </h2>
          <ul className="space-y-2">
            {briefing.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70 leading-relaxed">
                <span className="text-cyber-cyan/60 shrink-0 select-none">{">"}</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Controls */}
        <section className="border border-cyber-cyan/20 bg-cyber-cyan/[0.03] p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyber-cyan/50 mb-3">
            {">"}_&nbsp;CONTROLS
          </h2>
          <p className="text-cyber-cyan text-sm font-mono">
            {isTouch ? briefing.controls.touch : briefing.controls.desktop}
          </p>
        </section>

        {/* Tips */}
        <section className="border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">
            {">"}_&nbsp;TACTICAL TIPS
          </h2>
          <ul className="space-y-2">
            {briefing.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/50 leading-relaxed">
                <span className="text-cyber-magenta/60 shrink-0 select-none">◆</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Active meta upgrades — card grid */}
        {useMetaUpgrades && metaPowerUps.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyber-green/50 mb-3">
              {">"}_&nbsp;ACTIVE META UPGRADES
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {metaPowerUps.map((pu, i) => (
                <div
                  key={i}
                  className="border border-cyber-green/20 bg-cyber-green/[0.04] px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-cyber-green uppercase tracking-wider mb-0.5">
                    {pu.name}
                  </p>
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    {pu.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        {useMetaUpgrades && metaPowerUps.length === 0 && (
          <p className="text-white/20 text-[10px] uppercase tracking-widest text-center">
            NO META UPGRADES PURCHASED FOR THIS PROTOCOL
          </p>
        )}

        {/* Trial info */}
        <div className="border border-dashed border-white/10 p-3 flex items-center gap-3 flex-wrap">
          <span className="text-white/20 text-xs uppercase tracking-widest">
            UNLIMITED ROUNDS
          </span>
          <span className="text-white/60 text-xs font-mono tabular-nums">
            @ {diffLabel} DIFFICULTY
          </span>
          <span className="text-white/20 text-xs uppercase tracking-widest">
            {useMetaUpgrades ? "META UPGRADES ON" : "META UPGRADES OFF"}
          </span>
          <span className="ml-auto text-white/20 text-xs uppercase tracking-widest">
            RESULTS NOT RECORDED
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-2xl flex items-center justify-between mt-8">
        <button
          type="button"
          onClick={onBack}
          className="py-2 px-6 text-sm uppercase tracking-widest font-mono border border-white/15 text-white/30 hover:bg-white/5 hover:text-white/60 hover:border-white/30 transition-colors duration-150 cursor-pointer select-none"
        >
          {">"}_&nbsp;BACK
        </button>

        <button
          type="button"
          onClick={() => onBeginRef.current()}
          className="
            py-3 px-10
            text-sm uppercase tracking-widest font-mono font-bold
            border border-cyber-cyan/50 text-cyber-cyan
            hover:bg-cyber-cyan/10 hover:border-cyber-cyan/80
            active:bg-cyber-cyan/20
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          BEGIN TRAINING
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown phase
// ---------------------------------------------------------------------------

function CountdownPhase({
  type,
  round,
  value,
}: {
  type: MinigameType;
  round: number;
  value: number;
}) {
  return (
    <div className="text-center select-none">
      <p className="text-white/30 text-xs uppercase tracking-widest mb-2 glitch-subtle">
        TRAINING — ROUND {round}
      </p>
      <h2 className="text-2xl sm:text-3xl font-heading uppercase tracking-wider text-cyber-cyan mb-8 glitch-text">
        {getMinigameDisplayName(type).toUpperCase()}
      </h2>
      <p className="text-6xl sm:text-8xl font-bold text-white/80 tabular-nums glitch-flicker">
        {value > 0 ? value : "GO"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active round — renders the minigame component
// ---------------------------------------------------------------------------

function ActiveRound({
  type,
  difficulty,
  useMetaUpgrades,
  onComplete,
}: {
  type: MinigameType;
  difficulty: number;
  useMetaUpgrades: boolean;
  onComplete: (result: MinigameResult) => void;
}) {
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);

  const activePowerUps = useMemo(() => {
    if (!useMetaUpgrades) return [];
    return buildMetaPowerUps(purchasedUpgrades, type);
  }, [useMetaUpgrades, purchasedUpgrades, type]);

  const Component = MINIGAME_COMPONENTS[type];
  return (
    <Component
      difficulty={difficulty}
      timeLimit={TRAINING_TIME_LIMIT}
      activePowerUps={activePowerUps}
      onComplete={onComplete}
    />
  );
}

// ---------------------------------------------------------------------------
// Round result flash
// ---------------------------------------------------------------------------

function RoundResultFlash({
  success,
  round,
}: {
  success: boolean;
  round: number;
}) {
  return (
    <div className="text-center select-none">
      <h2
        className={`text-5xl sm:text-7xl font-heading uppercase tracking-wider ${
          success ? "text-cyber-cyan" : "text-cyber-magenta"
        }`}
      >
        {success ? "SUCCESS" : "FAILED"}
      </h2>
      <p className="mt-4 text-white/30 text-sm uppercase tracking-widest">
        ROUND {round} COMPLETE — NEXT ROUND
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Complete phase
// ---------------------------------------------------------------------------

function CompletePhase({
  type,
  results,
  onFinish,
}: {
  type: MinigameType;
  results: boolean[];
  onFinish: () => void;
}) {
  const wins = results.filter(Boolean).length;
  const total = results.length;

  return (
    <div className="text-center select-none flex flex-col items-center">
      {/* Header */}
      <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-2 glitch-flicker">
        {">"}_&nbsp;TRAINING PROTOCOL COMPLETE
      </p>
      <h2 className="text-3xl sm:text-4xl font-heading uppercase tracking-wider text-cyber-cyan mb-8 glitch-text">
        {getMinigameDisplayName(type).toUpperCase()}
      </h2>

      {/* Round results */}
      <div className="flex items-center gap-3 mb-8 flex-wrap justify-center">
        {results.map((success, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className={`text-2xl font-bold ${success ? "text-cyber-cyan" : "text-cyber-magenta"}`}
            >
              {success ? "●" : "○"}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-white/30">
              R{i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Score line */}
      <p className="text-white/50 text-sm uppercase tracking-widest mb-1">
        ROUNDS PLAYED: {total}
      </p>
      <p className="text-white/50 text-sm uppercase tracking-widest mb-2">
        WINS: {wins}
      </p>
      <p className="text-white/25 text-xs uppercase tracking-wider mb-10">
        {total > 0 && wins === total
          ? "PERFECT SCORE — PROTOCOL MASTERED"
          : total > 0 && wins >= Math.ceil(total / 2)
            ? "SOLID PERFORMANCE — TRAINING RECORDED"
            : "KEEP PRACTICING — PROTOCOL NOW UNLOCKED"}
      </p>

      {/* Briefing note */}
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-8 border border-dashed border-white/10 px-4 py-2">
        BRIEFING MARKED AS SEEN — TRAINING RESULTS NOT RECORDED TO STATS
      </p>

      <button
        type="button"
        onClick={onFinish}
        className="
          py-3 px-10
          text-sm uppercase tracking-widest font-mono font-bold
          border border-cyber-cyan/50 text-cyber-cyan
          hover:bg-cyber-cyan/10 hover:border-cyber-cyan/80
          active:bg-cyber-cyan/20
          transition-colors duration-150
          cursor-pointer select-none
        "
      >
        RETURN TO MENU
      </button>
    </div>
  );
}
