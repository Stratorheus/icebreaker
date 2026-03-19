import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameType } from "@/types/game";
import type { MinigameResult } from "@/types/minigame";
import { SlashTiming } from "@/components/minigames/SlashTiming";
import { CloseBrackets } from "@/components/minigames/CloseBrackets";
import { TypeBackward } from "@/components/minigames/TypeBackward";
import { MatchArrows } from "@/components/minigames/MatchArrows";
import { FindSymbol } from "@/components/minigames/FindSymbol";
import { MineSweep } from "@/components/minigames/MineSweep";
import { WireCutting } from "@/components/minigames/WireCutting";
import { CipherCrack } from "@/components/minigames/CipherCrack";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAINING_TIME_LIMIT = 30; // generous 30s for all trial rounds
const TOTAL_ROUNDS = 3;

const DIFFICULTY_OPTIONS: { label: string; value: number }[] = [
  { label: "EASY", value: 0.1 },
  { label: "MEDIUM", value: 0.5 },
  { label: "HARD", value: 0.9 },
];

// ---------------------------------------------------------------------------
// Briefing data
// ---------------------------------------------------------------------------

interface BriefingData {
  title: string;
  rules: string[];
  controls: string;
  tips: string[];
}

const BRIEFINGS: Record<MinigameType, BriefingData> = {
  "slash-timing": {
    title: "SLASH TIMING",
    rules: [
      "Three phases cycle in sequence: GUARD \u2192 PREPARE \u2192 ATTACK",
      "Press SPACE only during the green ATTACK window to succeed",
      "Pressing SPACE during GUARD or PREPARE causes immediate failure",
      "Missing the ATTACK window restarts the cycle \u2014 keep waiting",
    ],
    controls: "SPACE \u2014 strike",
    tips: [
      "Watch for the PREPARE phase as your cue to get ready",
      "At higher difficulty the ATTACK window shrinks \u2014 precision matters",
    ],
  },
  "close-brackets": {
    title: "CLOSE BRACKETS",
    rules: [
      "A sequence of opening brackets is displayed",
      "Type the matching closing brackets in REVERSE order (stack style)",
      "Bracket pairs: ( \u2192 )  [ \u2192 ]  { \u2192 }  < \u2192 >  | \u2192 |  \\ \u2192 /",
      "Any wrong key causes immediate failure",
    ],
    controls: "Keyboard keys: ) ] } > | /",
    tips: [
      "Read the opening sequence from right to left to find your first key",
      "Build muscle memory for each bracket pair before timed runs",
    ],
  },
  "type-backward": {
    title: "TYPE BACKWARD",
    rules: [
      "A word is shown on screen \u2014 type it in reverse letter by letter",
      "Only the letters of the reversed word are accepted",
      "Any incorrect key causes immediate failure",
      "Complete all letters to succeed",
    ],
    controls: "Keyboard \u2014 type each letter",
    tips: [
      "Say the word aloud in reverse before typing to lock in the order",
      "Short words first \u2014 longer words appear at higher difficulty",
    ],
  },
  "match-arrows": {
    title: "MATCH ARROWS",
    rules: [
      "A row of hidden arrow slots is shown \u2014 one is revealed at a time",
      "Press the matching arrow key to advance to the next slot",
      "Wrong arrow key = immediate failure",
      "Match all arrows in sequence to complete",
    ],
    controls: "Arrow keys: \u2191 \u2193 \u2190 \u2192",
    tips: [
      "Focus on each revealed arrow one at a time, not the full row",
      "At higher difficulty the row gets longer \u2014 stay calm and methodical",
    ],
  },
  "find-symbol": {
    title: "FIND SYMBOL",
    rules: [
      "A target sequence is shown at the top of the screen",
      "Find and select the current target symbol in the grid below",
      "Match all targets in order to complete \u2014 wrong pick = failure",
      "Both keyboard navigation and mouse click are supported",
    ],
    controls: "Arrow keys + ENTER to navigate, or click with mouse",
    tips: [
      "At higher difficulty visually similar symbols are mixed in \u2014 look carefully",
      "Use the cursor highlight to track your grid position with keyboard",
    ],
  },
  "mine-sweep": {
    title: "MINE SWEEP",
    rules: [
      "Mines are revealed briefly in a PREVIEW phase \u2014 memorise their locations",
      "Mines hide during the MARK phase \u2014 mark the cells you memorised",
      "Marking exactly the correct cells wins; any wrong mark = failure",
      "The grid auto-checks when you've marked the same count as mines",
    ],
    controls: "Arrow keys + SPACE to mark, or click cells",
    tips: [
      "Group mines by row or region in your mind during preview",
      "Higher difficulty = more mines, smaller preview window \u2014 act fast",
    ],
  },
  "wire-cutting": {
    title: "WIRE CUTTING",
    rules: [
      "A set of coloured wires and a rule panel are displayed",
      "Read the rules carefully to deduce the correct cutting order",
      "Press the number key matching a wire to cut it",
      "Wrong order = immediate failure; cut all required wires to succeed",
    ],
    controls: "Number keys 1\u20139 to cut wires, or click a wire",
    tips: [
      "Some wires may be SKIP \u2014 do not cut those at all",
      "Work out the full order on paper mentally before making the first cut",
    ],
  },
  "cipher-crack": {
    title: "CIPHER CRACK",
    rules: [
      "An encrypted word is shown \u2014 decode it by typing the plaintext",
      "The cipher method (ROT-N or substitution) is hinted on screen",
      "Type the decrypted word letter by letter; any mistake = failure",
      "Decode all letters to complete the breach",
    ],
    controls: "Keyboard \u2014 type the decoded letters",
    tips: [
      "ROT ciphers: shift each letter back by the stated amount",
      "Substitution: map each letter using the shown key table",
    ],
  },
};

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
  const [selectedDifficulty, setSelectedDifficulty] = useState(0.1);

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
    (pickedType: MinigameType, difficulty: number) => {
      setTrainingMinigame(pickedType);
      setSelectedDifficulty(difficulty);
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

  // Handle round completion
  const handleRoundComplete = useCallback(
    (result: MinigameResult) => {
      const success = result.success;
      setLastSuccess(success);
      setRoundResults((prev) => [...prev, success]);
      setPhase("round-result");

      setTimeout(() => {
        if (round >= TOTAL_ROUNDS) {
          setPhase("complete");
        } else {
          setRound((r) => r + 1);
          setCountdownValue(3);
          setPhase("countdown");
        }
      }, 1200);
    },
    [round],
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

  const briefing = BRIEFINGS[type];

  return (
    <div className="min-h-screen flex flex-col pt-12">
      {phase === "briefing" && (
        <BriefingPhase
          type={type}
          briefing={briefing}
          difficulty={selectedDifficulty}
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
            total={TOTAL_ROUNDS}
            value={countdownValue}
          />
        </div>
      )}

      {phase === "active" && (
        <div className="flex-1 flex items-center justify-center px-4">
          <ActiveRound
            type={type}
            difficulty={selectedDifficulty}
            onComplete={handleRoundComplete}
          />
        </div>
      )}

      {phase === "round-result" && (
        <div className="flex-1 flex items-center justify-center px-4">
          <RoundResultFlash
            success={lastSuccess ?? false}
            round={round}
            total={TOTAL_ROUNDS}
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
  onPick: (type: MinigameType, difficulty: number) => void;
  onBack: () => void;
}) {
  const [selectedDifficulty, setSelectedDifficulty] = useState(0.1);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-12 pb-16">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-1">
          {">"}_&nbsp;TRAINING MODE
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan">
          SELECT PROTOCOL
        </h1>
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">
          PRACTICE ANY UNLOCKED MINIGAME — RESULTS NOT RECORDED
        </p>
      </div>

      {/* Difficulty selector */}
      <div className="w-full max-w-2xl mb-6">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-3">
          DIFFICULTY
        </p>
        <div className="flex gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setSelectedDifficulty(opt.value)}
              className={`
                flex-1 py-2 px-4
                text-xs uppercase tracking-widest font-mono
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

      {/* Minigame list */}
      <div className="w-full max-w-2xl space-y-2 mb-8">
        {unlockedMinigames.map((type) => {
          const briefing = BRIEFINGS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onPick(type, selectedDifficulty)}
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
                <span className="text-cyber-cyan text-sm font-bold uppercase tracking-wider">
                  {briefing.title}
                </span>
              </div>
              <span className="text-white/20 text-[10px] uppercase tracking-widest">
                {TOTAL_ROUNDS} ROUNDS
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
  onBegin,
  onBack,
}: {
  type: MinigameType;
  briefing: BriefingData;
  difficulty: number;
  onBegin: () => void;
  onBack: () => void;
}) {
  const onBeginRef = useRef(onBegin);
  onBeginRef.current = onBegin;

  const diffLabel = DIFFICULTY_OPTIONS.find((d) => d.value === difficulty)?.label ?? "CUSTOM";

  return (
    <div className="flex-1 flex flex-col items-center px-4 pb-12 overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-2xl mt-6 mb-8">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-1">
          {">"}_&nbsp;TRAINING PROTOCOL
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan">
          {briefing.title}
        </h1>
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">
          MINIGAME ID: <span className="text-white/40">{type}</span>
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
            {briefing.controls}
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
                <span className="text-cyber-magenta/60 shrink-0 select-none">{"\u25C6"}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Trial info */}
        <div className="border border-dashed border-white/10 p-3 flex items-center gap-3">
          <span className="text-white/20 text-xs uppercase tracking-widest">
            TRIAL ROUNDS
          </span>
          <span className="text-white/60 text-xs font-mono tabular-nums">
            {TOTAL_ROUNDS}x @ {diffLabel} DIFFICULTY
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
  total,
  value,
}: {
  type: MinigameType;
  round: number;
  total: number;
  value: number;
}) {
  return (
    <div className="text-center select-none">
      <p className="text-white/30 text-xs uppercase tracking-widest mb-2">
        TRAINING \u2014 ROUND {round}/{total}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider text-cyber-cyan mb-8">
        {BRIEFINGS[type].title}
      </h2>
      <p className="text-6xl sm:text-8xl font-bold text-white/80 tabular-nums">
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
  onComplete,
}: {
  type: MinigameType;
  difficulty: number;
  onComplete: (result: MinigameResult) => void;
}) {
  const Component = MINIGAME_COMPONENTS[type];
  return (
    <Component
      difficulty={difficulty}
      timeLimit={TRAINING_TIME_LIMIT}
      activePowerUps={[]}
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
  total,
}: {
  success: boolean;
  round: number;
  total: number;
}) {
  return (
    <div className="text-center select-none">
      <h2
        className={`text-5xl sm:text-7xl font-bold uppercase tracking-wider ${
          success ? "text-cyber-cyan" : "text-cyber-magenta"
        }`}
      >
        {success ? "SUCCESS" : "FAILED"}
      </h2>
      <p className="mt-4 text-white/30 text-sm uppercase tracking-widest">
        {round < total ? `ROUND ${round} COMPLETE \u2014 NEXT ROUND` : "FINAL ROUND COMPLETE"}
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
      <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-2">
        {">"}_&nbsp;TRAINING PROTOCOL COMPLETE
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan mb-8">
        {BRIEFINGS[type].title}
      </h2>

      {/* Round results */}
      <div className="flex items-center gap-3 mb-8">
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
      <p className="text-white/50 text-sm uppercase tracking-widest mb-2">
        {wins}/{total} ROUNDS COMPLETED
      </p>
      <p className="text-white/25 text-xs uppercase tracking-wider mb-10">
        {wins === total
          ? "PERFECT SCORE \u2014 MINIGAME MASTERED"
          : wins >= Math.ceil(total / 2)
            ? "SOLID PERFORMANCE \u2014 TRAINING RECORDED"
            : "KEEP PRACTICING \u2014 MINIGAME NOW UNLOCKED"}
      </p>

      {/* Briefing note */}
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-8 border border-dashed border-white/10 px-4 py-2">
        BRIEFING MARKED AS SEEN \u2014 TRAINING RESULTS NOT RECORDED TO STATS
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
