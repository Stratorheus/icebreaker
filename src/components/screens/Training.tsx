import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameType } from "@/types/game";
import type { MinigameResult } from "@/types/minigame";
import { MINIGAME_COMPONENTS, MINIGAME_REGISTRY, getMinigameDisplayName, getMinigameBriefing, buildMetaPowerUps } from "@/data/minigames/registry";
import type { MinigameBriefing } from "@/data/minigames/types";
import { useTouchDevice } from "@/hooks/use-touch-device";

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

// ---------------------------------------------------------------------------
// Per-minigame training settings
// ---------------------------------------------------------------------------

type MinigameTrainingSettings = {
  difficulty: number;
  activeUpgradeIds: Set<string>;
  upgradeTiers: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Training screen phases
// ---------------------------------------------------------------------------

type TrainingPhase = "picker" | "briefing" | "countdown" | "active" | "round-result" | "complete";

// ---------------------------------------------------------------------------
// Training component
// ---------------------------------------------------------------------------

export function Training() {
  const trainingMinigame = useGameStore((s) => s.trainingMinigame);
  const trainingOrigin = useGameStore((s) => s.trainingOrigin);
  const markBriefingSeen = useGameStore((s) => s.markBriefingSeen);
  const setStatus = useGameStore((s) => s.setStatus);
  const setTrainingMinigame = useGameStore((s) => s.setTrainingMinigame);
  const setTrainingOrigin = useGameStore((s) => s.setTrainingOrigin);
  const unlockedMinigames = useGameStore((s) => s.unlockedMinigames);

  // If trainingMinigame is already set (from unlock flow), skip picker
  const [phase, setPhase] = useState<TrainingPhase>(
    trainingMinigame ? "briefing" : "picker",
  );
  const [round, setRound] = useState(1);
  const [countdownValue, setCountdownValue] = useState(3);
  const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);
  const [roundResults, setRoundResults] = useState<boolean[]>([]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Per-minigame settings — remembered across picker/briefing/result within the same Training session
  const [perMinigameSettings, setPerMinigameSettings] = useState<
    Partial<Record<MinigameType, MinigameTrainingSettings>>
  >({});

  const type = trainingMinigame;

  // Current settings for the active minigame
  const currentSettings: MinigameTrainingSettings = type
    ? perMinigameSettings[type] ?? {
        difficulty: 0.3,
        activeUpgradeIds: new Set<string>(),
        upgradeTiers: {},
      }
    : { difficulty: 0.3, activeUpgradeIds: new Set<string>(), upgradeTiers: {} };

  const handleSettingsChange = useCallback((s: MinigameTrainingSettings) => {
    if (!type) return;
    setPerMinigameSettings(prev => ({ ...prev, [type]: s }));
  }, [type]);

  // Picker back: go to menu, reset origin
  const handlePickerBack = useCallback(() => {
    setTrainingMinigame(null);
    setTrainingOrigin(null);
    setStatus("menu");
  }, [setTrainingMinigame, setTrainingOrigin, setStatus]);

  // Briefing back: origin-aware
  const handleBriefingBack = useCallback(() => {
    if (trainingOrigin === "meta-shop") {
      // Return to meta shop
      setTrainingMinigame(null);
      setTrainingOrigin(null);
      setStatus("meta-shop");
    } else {
      // Return to picker
      setTrainingMinigame(null);
      setPhase("picker");
    }
  }, [trainingOrigin, setTrainingMinigame, setTrainingOrigin, setStatus]);

  // Continue training: result -> briefing (preserves settings)
  const handleContinue = useCallback(() => {
    if (type) markBriefingSeen(type);
    setPhase("briefing");
    setRound(1);
    setRoundResults([]);
    setLastSuccess(null);
  }, [type, markBriefingSeen]);

  // Back to list: result -> picker
  const handleBackToList = useCallback(() => {
    if (type) markBriefingSeen(type);
    setTrainingMinigame(null);
    setTrainingOrigin(null);
    setPhase("picker");
  }, [type, markBriefingSeen, setTrainingMinigame, setTrainingOrigin]);

  // Open meta shop from briefing
  const handleOpenMetaShop = useCallback(() => {
    // Go to meta shop but trainingMinigame stays set so we can return
    setStatus("meta-shop");
  }, [setStatus]);

  // When a game is picked from the picker phase
  const handlePickGame = useCallback((pickedType: MinigameType) => {
    setTrainingMinigame(pickedType);
    const origin = useGameStore.getState().trainingOrigin;
    if (!origin) useGameStore.getState().setTrainingOrigin("picker");
    setPhase("briefing");
    setRound(1);
    setRoundResults([]);
    setLastSuccess(null);
  }, [setTrainingMinigame]);

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

  // Picker phase: show list of unlocked minigames
  if (phase === "picker") {
    return (
      <PickerPhase
        unlockedMinigames={unlockedMinigames}
        onPick={handlePickGame}
        onBack={handlePickerBack}
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
          onClick={handlePickerBack}
          className="py-2 px-6 text-sm uppercase tracking-widest font-mono border border-white/20 text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors duration-150 cursor-pointer select-none"
        >
          {">"}_&nbsp;BACK
        </button>
      </div>
    );
  }

  const briefing = getMinigameBriefing(type);
  const showQuitButton = phase === "active" || phase === "countdown" || phase === "round-result";

  return (
    <div className="min-h-screen flex flex-col pt-12 relative">
      {phase === "briefing" && (
        <BriefingPhase
          type={type}
          briefing={briefing}
          settings={currentSettings}
          onSettingsChange={handleSettingsChange}
          onBegin={() => {
            setPhase("countdown");
          }}
          onBack={handleBriefingBack}
          onOpenMetaShop={handleOpenMetaShop}
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
        <div data-testid="minigame-active" className="flex-1 flex items-center justify-center px-4">
          <ActiveRound
            type={type}
            settings={currentSettings}
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
            onContinue={handleContinue}
            onBackToList={handleBackToList}
          />
        </div>
      )}

      {/* Quit button — top-right during active gameplay phases */}
      {showQuitButton && (
        <button
          type="button"
          data-testid="quit-training-button"
          onClick={() => setShowQuitConfirm(true)}
          className="
            absolute top-3 right-3 z-40
            py-2 px-4
            text-sm uppercase tracking-widest font-mono font-bold
            border-2 border-cyber-magenta text-cyber-magenta
            bg-cyber-magenta/10
            hover:bg-cyber-magenta/20
            active:bg-cyber-magenta/30
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
                data-testid="confirm-quit"
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
// Picker phase — choose minigame (simplified: no global difficulty/toggle)
// ---------------------------------------------------------------------------

function PickerPhase({
  unlockedMinigames,
  onPick,
  onBack,
}: {
  unlockedMinigames: MinigameType[];
  onPick: (type: MinigameType) => void;
  onBack: () => void;
}) {
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

      {/* Minigame list */}
      <div className="w-full max-w-2xl space-y-2 mb-8">
        {unlockedMinigames.map((type) => {
          return (
            <button
              key={type}
              type="button"
              data-testid="minigame-picker-item"
              data-name={getMinigameDisplayName(type)}
              onClick={() => onPick(type)}
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
// Briefing phase — with per-minigame difficulty + upgrade checkboxes
// ---------------------------------------------------------------------------

function BriefingPhase({
  type,
  briefing,
  settings,
  onSettingsChange,
  onBegin,
  onBack,
  onOpenMetaShop,
}: {
  type: MinigameType;
  briefing: MinigameBriefing;
  settings: MinigameTrainingSettings;
  onSettingsChange: (s: MinigameTrainingSettings) => void;
  onBegin: () => void;
  onBack: () => void;
  onOpenMetaShop: () => void;
}) {
  const onBeginRef = useRef(onBegin);
  onBeginRef.current = onBegin;
  const isTouch = useTouchDevice();
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);

  // Get game-specific upgrades from registry
  const gameUpgrades = useMemo(() => {
    const config = MINIGAME_REGISTRY[type];
    return config.metaUpgrades.filter(u => (purchasedUpgrades[u.id] ?? 0) > 0);
  }, [type, purchasedUpgrades]);

  const diffLabel = DIFFICULTY_OPTIONS.find((d) => d.value === settings.difficulty)?.label ?? "CUSTOM";
  const activeCount = settings.activeUpgradeIds.size;

  // Toggle upgrade checkbox
  const handleToggleUpgrade = useCallback((upgradeId: string) => {
    const newIds = new Set(settings.activeUpgradeIds);
    if (newIds.has(upgradeId)) {
      newIds.delete(upgradeId);
    } else {
      newIds.add(upgradeId);
      // Initialize tier to max purchased if not set
      if (settings.upgradeTiers[upgradeId] === undefined) {
        const maxTier = purchasedUpgrades[upgradeId] ?? 1;
        onSettingsChange({
          ...settings,
          activeUpgradeIds: newIds,
          upgradeTiers: { ...settings.upgradeTiers, [upgradeId]: maxTier },
        });
        return;
      }
    }
    onSettingsChange({ ...settings, activeUpgradeIds: newIds });
  }, [settings, onSettingsChange, purchasedUpgrades]);

  // Change upgrade tier
  const handleTierChange = useCallback((upgradeId: string, delta: number) => {
    const maxTier = purchasedUpgrades[upgradeId] ?? 1;
    const current = settings.upgradeTiers[upgradeId] ?? maxTier;
    const next = Math.max(1, Math.min(maxTier, current + delta));
    onSettingsChange({
      ...settings,
      upgradeTiers: { ...settings.upgradeTiers, [upgradeId]: next },
    });
  }, [settings, onSettingsChange, purchasedUpgrades]);

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
        {/* Difficulty selector */}
        <section>
          <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-3">
            DIFFICULTY
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                data-testid="difficulty-option"
                data-value={opt.label}
                onClick={() => onSettingsChange({ ...settings, difficulty: opt.value })}
                className={`
                  py-1.5 px-2
                  text-[10px] uppercase tracking-widest font-mono
                  border transition-colors duration-150
                  cursor-pointer select-none
                  ${
                    settings.difficulty === opt.value
                      ? "border-cyber-cyan/60 text-cyber-cyan bg-cyber-cyan/10"
                      : "border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60"
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

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

        {/* Per-upgrade checkboxes */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyber-green/50 mb-3">
            {">"}_&nbsp;META UPGRADES
          </h2>
          {gameUpgrades.length > 0 ? (
            <div className="space-y-2">
              {gameUpgrades.map((upgrade) => {
                const isActive = settings.activeUpgradeIds.has(upgrade.id);
                const maxTier = purchasedUpgrades[upgrade.id] ?? 1;
                const selectedTier = settings.upgradeTiers[upgrade.id] ?? maxTier;
                const effect = upgrade.effects[selectedTier - 1];
                const effectDesc = effect
                  ? `${upgrade.name}: ${formatUpgradeEffect(effect, selectedTier)}`
                  : upgrade.description;

                return (
                  <div
                    key={upgrade.id}
                    data-testid="upgrade-card"
                    data-upgrade-id={upgrade.id}
                    className={`
                      border px-3 py-2.5 flex items-start gap-3 transition-colors duration-150
                      ${isActive
                        ? "border-cyber-green/40 bg-cyber-green/[0.06]"
                        : "border-white/10 bg-white/[0.02]"
                      }
                    `}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      data-testid="upgrade-checkbox"
                      data-checked={isActive}
                      onClick={() => handleToggleUpgrade(upgrade.id)}
                      className={`
                        mt-0.5 w-4 h-4 shrink-0 border flex items-center justify-center
                        cursor-pointer select-none transition-colors duration-150
                        ${isActive
                          ? "border-cyber-green/60 bg-cyber-green/20 text-cyber-green"
                          : "border-white/20 bg-white/[0.03] text-transparent hover:border-white/40"
                        }
                      `}
                      aria-label={`Toggle ${upgrade.name}`}
                    >
                      {isActive && <span className="text-[10px] leading-none">&#10003;</span>}
                    </button>

                    {/* Name + Description */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold uppercase tracking-wider ${isActive ? "text-cyber-green" : "text-white/40"}`}>
                        {upgrade.name}
                      </p>
                      <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">
                        {effectDesc}
                      </p>
                    </div>

                    {/* Tier +/- control */}
                    {maxTier > 1 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTierChange(upgrade.id, -1)}
                          disabled={selectedTier <= 1}
                          className={`
                            w-5 h-5 flex items-center justify-center text-[10px] font-bold
                            border cursor-pointer select-none transition-colors duration-150
                            ${selectedTier <= 1
                              ? "border-white/5 text-white/10 cursor-not-allowed"
                              : "border-white/20 text-white/50 hover:bg-white/5 hover:text-white/70"
                            }
                          `}
                        >
                          -
                        </button>
                        <span className={`text-[10px] font-mono tabular-nums min-w-[32px] text-center ${isActive ? "text-cyber-green/80" : "text-white/30"}`}>
                          Lv.{selectedTier}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTierChange(upgrade.id, 1)}
                          disabled={selectedTier >= maxTier}
                          className={`
                            w-5 h-5 flex items-center justify-center text-[10px] font-bold
                            border cursor-pointer select-none transition-colors duration-150
                            ${selectedTier >= maxTier
                              ? "border-white/5 text-white/10 cursor-not-allowed"
                              : "border-white/20 text-white/50 hover:bg-white/5 hover:text-white/70"
                            }
                          `}
                        >
                          +
                        </button>
                      </div>
                    )}
                    {maxTier === 1 && (
                      <span className={`text-[10px] font-mono ${isActive ? "text-cyber-green/60" : "text-white/20"} shrink-0`}>
                        Lv.1
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/20 text-[10px] uppercase tracking-widest text-center py-2">
              NO META UPGRADES PURCHASED FOR THIS PROTOCOL
            </p>
          )}

          {/* Open Meta Shop link */}
          <button
            type="button"
            onClick={onOpenMetaShop}
            className="
              mt-3 w-full py-2
              text-[10px] uppercase tracking-[0.3em] font-mono
              text-cyber-green/50 hover:text-cyber-green/80
              transition-colors duration-150
              cursor-pointer select-none
            "
          >
            {">"}_&nbsp;OPEN META SHOP
          </button>
        </section>

        {/* Trial info */}
        <div className="border border-dashed border-white/10 p-3 flex items-center gap-3 flex-wrap">
          <span className="text-white/20 text-xs uppercase tracking-widest">
            UNLIMITED ROUNDS
          </span>
          <span className="text-white/60 text-xs font-mono tabular-nums">
            @ {diffLabel} DIFFICULTY
          </span>
          <span className="text-white/20 text-xs uppercase tracking-widest">
            {activeCount > 0 ? `${activeCount} UPGRADE${activeCount > 1 ? "S" : ""} ACTIVE` : "NO UPGRADES"}
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
          data-testid="begin-training"
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
// Active round — renders the minigame component with per-minigame settings
// ---------------------------------------------------------------------------

function ActiveRound({
  type,
  settings,
  onComplete,
}: {
  type: MinigameType;
  settings: MinigameTrainingSettings;
  onComplete: (result: MinigameResult) => void;
}) {
  const Component = MINIGAME_COMPONENTS[type];

  const activePowerUps = useMemo(
    () =>
      buildMetaPowerUps({}, type, {
        activeIds: settings.activeUpgradeIds,
        tierMap: settings.upgradeTiers,
      }),
    [type, settings],
  );

  return (
    <Component
      difficulty={settings.difficulty}
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
// Complete phase — continue training or back to list
// ---------------------------------------------------------------------------

function CompletePhase({
  type,
  results,
  onContinue,
  onBackToList,
}: {
  type: MinigameType;
  results: boolean[];
  onContinue: () => void;
  onBackToList: () => void;
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
              {success ? "\u25CF" : "\u25CB"}
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

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onContinue}
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
          CONTINUE TRAINING
        </button>

        <button
          type="button"
          onClick={onBackToList}
          className="
            py-3 px-8
            text-sm uppercase tracking-widest font-mono
            border border-white/15 text-white/40
            hover:bg-white/5 hover:text-white/70 hover:border-white/30
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          BACK TO LIST
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: format upgrade effect for display in briefing
// ---------------------------------------------------------------------------

function formatUpgradeEffect(effect: { type: string; value: number; minigame?: MinigameType }, tier: number): string {
  const pct = Math.round(effect.value * 100);
  switch (effect.type) {
    case "minigame-specific":
      return `${pct}% (Lv.${tier})`;
    case "hint":
      return effect.value < 1 ? `${pct}% pre-filled (Lv.${tier})` : `active (Lv.${tier})`;
    case "preview":
      return `\u00b1${effect.value} range (Lv.${tier})`;
    case "peek-ahead":
      return `${pct}% pre-revealed (Lv.${tier})`;
    case "window-extend":
      return `+${pct}% wider (Lv.${tier})`;
    case "bracket-flash":
      return `shows next bracket (Lv.${tier})`;
    case "wire-color-labels":
      return `highlights next wire (Lv.${tier})`;
    case "extra-hint":
      return `extra hint letter (Lv.${tier})`;
    default:
      return `${effect.type.replace(/-/g, " ")} (Lv.${tier})`;
  }
}
