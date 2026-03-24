import type { CipherCharDisplay } from "@/hooks/use-cipher-minigame";

interface CipherDisplayProps {
  charDisplay: CipherCharDisplay[];
  charIndex: number;
  wordLength: number;
  preFilledCount: number;
}

/**
 * Shared character-by-character display for CipherCrack / CipherCrackV2.
 *
 * Renders: prefilled (green/70), typed (green), cursor (cyan pulse), remaining (dim).
 * Also shows a progress counter below.
 */
export function CipherDisplay({
  charDisplay,
  charIndex,
  wordLength,
  preFilledCount,
}: CipherDisplayProps) {
  return (
    <>
      {/* Input display */}
      <div className="flex items-center justify-center min-h-[3.5rem]">
        <div className="flex items-center justify-center font-mono text-3xl sm:text-4xl tracking-wider">
          {charDisplay.map((cd, i) => {
            if (cd.state === "prefilled") {
              return <span key={i} className="text-cyber-green/70 font-bold">{cd.char}</span>;
            }
            if (cd.state === "typed") {
              return <span key={i} className="text-cyber-green font-bold">{cd.char}</span>;
            }
            if (cd.state === "cursor") {
              return (
                <span key={i} className="relative">
                  <span className="inline-block w-[2px] h-8 sm:h-10 bg-cyber-cyan animate-pulse mx-0.5" />
                  <span className="text-white/15 font-bold">_</span>
                </span>
              );
            }
            return <span key={i} className="text-white/15 font-bold">_</span>;
          })}
        </div>
      </div>

      <p className="text-white/40 text-xs uppercase tracking-widest">
        {charIndex >= wordLength ? wordLength : charIndex}/{wordLength}
        {preFilledCount > 0 && (
          <span className="text-cyber-green/50 ml-2">({preFilledCount} pre-filled)</span>
        )}
      </p>
    </>
  );
}
