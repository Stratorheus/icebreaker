import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { ArrowKeyHints } from "@/components/layout/ArrowKeyHints";
import { CURSOR_CLASSES, HOVER_CLASSES } from "@/components/layout/GameCell";
import { useTouchDevice } from "@/hooks/use-touch-device";

// ---------------------------------------------------------------------------
// IP / Subnet helpers
// ---------------------------------------------------------------------------

/** Convert dotted-decimal IP string to a 32-bit integer. */
function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** Convert 32-bit integer back to dotted-decimal string. */
function intToIp(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

/** Check if an IP address belongs to the given CIDR subnet. */
function isInSubnet(ip: string, network: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(network) & mask);
}

// ---------------------------------------------------------------------------
// Difficulty parameters
// ---------------------------------------------------------------------------

interface Params {
  totalAddresses: number;
  correctCount: number;
  prefixOptions: number[];
}

function getParams(difficulty: number): Params {
  if (difficulty < 0.3) {
    return { totalAddresses: 4, correctCount: 1, prefixOptions: [8, 16, 24] };
  }
  if (difficulty <= 0.6) {
    const correctCount = Math.round(2 + difficulty);
    return { totalAddresses: 6, correctCount, prefixOptions: [16, 24] };
  }
  const correctCount = Math.round(3 + (difficulty - 0.6) * 2.5);
  return { totalAddresses: 6, correctCount: Math.min(correctCount, 4), prefixOptions: [20, 22, 24] };
}

// ---------------------------------------------------------------------------
// Puzzle generation
// ---------------------------------------------------------------------------

interface SubnetPuzzle {
  cidrDisplay: string;
  network: string;
  prefix: number;
  addresses: string[];
  correctSet: Set<string>;
}

function generatePuzzle(params: Params): SubnetPuzzle {
  const { totalAddresses, correctCount, prefixOptions } = params;
  const prefix = prefixOptions[Math.floor(Math.random() * prefixOptions.length)];

  const rangeType = Math.floor(Math.random() * 3);
  let baseOctets: number[];

  switch (rangeType) {
    case 0:
      baseOctets = [10, randInt(0, 255), randInt(0, 255), 0];
      break;
    case 1:
      baseOctets = [172, randInt(16, 31), randInt(0, 255), 0];
      break;
    default:
      baseOctets = [192, 168, randInt(0, 255), 0];
      break;
  }

  const rawIp = (baseOctets[0] << 24 | baseOctets[1] << 16 | baseOctets[2] << 8 | baseOctets[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const networkInt = (rawIp & mask) >>> 0;
  const network = intToIp(networkInt);

  const hostBits = 32 - prefix;
  const maxHosts = Math.pow(2, hostBits);

  const correctAddresses: string[] = [];
  const usedHosts = new Set<number>();

  while (correctAddresses.length < correctCount) {
    const hostPart = randInt(1, Math.min(maxHosts - 2, 254));
    if (usedHosts.has(hostPart)) continue;
    usedHosts.add(hostPart);
    const addr = intToIp((networkInt + hostPart) >>> 0);
    if (isInSubnet(addr, network, prefix)) {
      correctAddresses.push(addr);
    }
  }

  const incorrectCount = totalAddresses - correctCount;
  const incorrectAddresses: string[] = [];
  const allUsed = new Set(correctAddresses);

  while (incorrectAddresses.length < incorrectCount) {
    const addr = generateNearbyOutOfSubnet(networkInt, prefix, baseOctets);
    if (addr && !allUsed.has(addr) && !isInSubnet(addr, network, prefix)) {
      allUsed.add(addr);
      incorrectAddresses.push(addr);
    }
  }

  const addresses = shuffle([...correctAddresses, ...incorrectAddresses]);
  const correctSet = new Set(correctAddresses);

  return {
    cidrDisplay: `${network}/${prefix}`,
    network,
    prefix,
    addresses,
    correctSet,
  };
}

function generateNearbyOutOfSubnet(
  networkInt: number,
  prefix: number,
  baseOctets: number[],
): string | null {
  const hostBits = 32 - prefix;
  const maxHosts = Math.pow(2, hostBits);

  const strategy = Math.floor(Math.random() * 3);

  if (strategy === 0 && prefix <= 24) {
    const octets = [...baseOctets];
    if (prefix <= 8) {
      octets[0] = clamp(octets[0] + randSign() * randInt(1, 3), 1, 254);
    } else if (prefix <= 16) {
      octets[1] = clamp(octets[1] + randSign() * randInt(1, 5), 0, 255);
    } else {
      octets[2] = clamp(octets[2] + randSign() * randInt(1, 3), 0, 255);
    }
    octets[3] = randInt(1, 254);
    return `${octets[0]}.${octets[1]}.${octets[2]}.${octets[3]}`;
  }

  if (strategy === 1) {
    const offsetOptions = [maxHosts, maxHosts + randInt(1, 10), -(randInt(1, 10))];
    const offset = offsetOptions[Math.floor(Math.random() * offsetOptions.length)];
    const candidate = (networkInt + offset + randInt(1, 254)) >>> 0;
    const candidateIp = intToIp(candidate);
    const parts = candidateIp.split(".").map(Number);
    if (parts.every((p) => p >= 0 && p <= 255) && parts[0] > 0) {
      return candidateIp;
    }
  }

  const parts = intToIp(networkInt).split(".").map(Number);
  if (prefix >= 24) {
    parts[2] = clamp(parts[2] + randSign() * randInt(1, 3), 0, 255);
  } else if (prefix >= 16) {
    parts[1] = clamp(parts[1] + randSign() * randInt(1, 5), 0, 255);
  } else {
    parts[0] = clamp(parts[0] + randSign() * randInt(1, 3), 1, 254);
  }
  parts[3] = randInt(1, 254);
  return `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}`;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Subnet mask help text
// ---------------------------------------------------------------------------

function getMaskHelp(prefix: number): string {
  if (prefix === 24) return "/24 = first 3 numbers must match";
  if (prefix === 16) return "/16 = first 2 numbers must match";
  if (prefix === 8) return "/8 = first number must match";
  return `/${prefix} = partial match in the third number`;
}

function getMaskDetail(prefix: number): string[] {
  if (prefix === 24) {
    return [
      "/24 means the first 24 bits (first 3 octets) are the network.",
      "Any IP with the same first 3 numbers is in the subnet.",
    ];
  }
  if (prefix === 16) {
    return [
      "/16 means the first 16 bits (first 2 octets) are the network.",
      "Any IP with the same first 2 numbers is in the subnet.",
    ];
  }
  if (prefix === 8) {
    return [
      "/8 means the first 8 bits (first octet) are the network.",
      "Any IP with the same first number is in the subnet.",
    ];
  }
  const fullOctets = Math.floor(prefix / 8);
  const extraBits = prefix % 8;
  return [
    `/${prefix} = ${fullOctets} full octets + ${extraBits} bits of the next octet.`,
    `First ${fullOctets} numbers must match exactly. The next number must share the top ${extraBits} bits.`,
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubnetScan(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("subnet-scan", props);

  const resolvedRef = useRef(false);
  const isTouch = useTouchDevice();

  // CIDR Helper module: show expanded IP range
  const hasCidrHelper = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "subnet-scan",
    );
  }, [activePowerUps]);

  const params = useMemo(
    () => getParams(difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const puzzle = useMemo(
    () => generatePuzzle(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const maskHelp = useMemo(() => getMaskHelp(puzzle.prefix), [puzzle.prefix]);
  const maskDetail = useMemo(() => getMaskDetail(puzzle.prefix), [puzzle.prefix]);

  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedSetRef.current = selectedSet;
  }, [selectedSet]);

  const [correctCount, setCorrectCount] = useState(0);
  const correctCountRef = useRef(0);
  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorIndexRef = useRef(0);
  useEffect(() => {
    cursorIndexRef.current = cursorIndex;
  }, [cursorIndex]);

  const handleToggle = useCallback(
    (index: number) => {
      if (!isActive || resolvedRef.current) return;

      const addr = puzzle.addresses[index];
      const alreadySelected = selectedSetRef.current.has(addr);

      if (alreadySelected) {
        setSelectedSet((prev) => {
          const next = new Set(prev);
          next.delete(addr);
          return next;
        });
        if (puzzle.correctSet.has(addr)) {
          setCorrectCount((c) => {
            const next = c - 1;
            correctCountRef.current = next;
            return next;
          });
        }
        return;
      }

      if (!puzzle.correctSet.has(addr)) {
        resolvedRef.current = true;
        setSelectedSet((prev) => {
          const next = new Set(prev);
          next.add(addr);
          return next;
        });
        setTimeout(() => fail(), 400);
        return;
      }

      const newCorrectCount = correctCountRef.current + 1;
      setCorrectCount(newCorrectCount);
      correctCountRef.current = newCorrectCount;

      setSelectedSet((prev) => {
        const next = new Set(prev);
        next.add(addr);
        return next;
      });

      if (newCorrectCount >= puzzle.correctSet.size) {
        resolvedRef.current = true;
        setTimeout(() => complete(true), 400);
      }
    },
    [isActive, puzzle, fail, complete],
  );

  const handleUp = useCallback(() => {
    setCursorIndex((prev) => {
      const val = Math.max(0, prev - 1);
      cursorIndexRef.current = val;
      return val;
    });
  }, []);

  const handleDown = useCallback(() => {
    setCursorIndex((prev) => {
      const val = Math.min(puzzle.addresses.length - 1, prev + 1);
      cursorIndexRef.current = val;
      return val;
    });
  }, [puzzle.addresses.length]);

  const handleSpace = useCallback(() => {
    handleToggle(cursorIndexRef.current);
  }, [handleToggle]);

  const keyMap = useMemo(
    () => ({
      ArrowUp: handleUp,
      ArrowDown: handleDown,
      " ": handleSpace,
    }),
    [handleUp, handleDown, handleSpace],
  );

  useKeyboard(keyMap);

  return (
    <MinigameShell
      timer={timer}
      timerGap="mb-4"
      gap="gap-4"
      desktopHint={
        <>
          {/* Help box */}
          <div className="w-full max-w-sm mx-auto">
            <div
              className="border rounded-lg px-4 py-3 text-center"
              style={{
                borderColor: "rgba(0, 255, 255, 0.2)",
                backgroundColor: "rgba(0, 255, 255, 0.04)",
              }}
            >
              <p className="text-cyber-cyan/80 text-xs font-mono font-bold tracking-wider mb-1.5">
                {maskHelp}
              </p>
              {maskDetail.map((line, i) => (
                <p key={i} className="text-white/30 text-[10px] leading-relaxed">
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-3 text-center space-y-1">
              <p className="text-white/30 text-xs uppercase tracking-widest">
                Arrow keys to navigate, Space to toggle, or click
              </p>
              <ArrowKeyHints vertical />
              <kbd className="desktop-only px-4 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono ml-2">
                Space
              </kbd>
            </div>
          </div>
        </>
      }
      touchHint={
        <>
          {/* Help box */}
          <div className="w-full max-w-sm mx-auto">
            <div
              className="border rounded-lg px-4 py-3 text-center"
              style={{
                borderColor: "rgba(0, 255, 255, 0.2)",
                backgroundColor: "rgba(0, 255, 255, 0.04)",
              }}
            >
              <p className="text-cyber-cyan/80 text-xs font-mono font-bold tracking-wider mb-1.5">
                {maskHelp}
              </p>
              {maskDetail.map((line, i) => (
                <p key={i} className="text-white/30 text-[10px] leading-relaxed">
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-3 text-center">
              <p className="text-white/30 text-xs uppercase tracking-widest">
                TAP addresses that belong to the subnet
              </p>
            </div>
          </div>
        </>
      }
    >
      {/* Header */}
      <p className="text-cyber-cyan text-xs uppercase tracking-widest font-mono glitch-subtle">
        Scanning Subnet...
      </p>

      {/* CIDR display */}
      <div className="text-center">
        <span
          className="text-3xl sm:text-4xl font-mono font-bold tracking-wider"
          style={{ color: "var(--color-cyber-cyan)" }}
        >
          {puzzle.cidrDisplay}
        </span>
        {hasCidrHelper && (
          <p className="text-cyber-green/50 text-xs font-mono mt-1">
            {intToIp((ipToInt(puzzle.network)) >>> 0)} — {intToIp(((ipToInt(puzzle.network)) | (~((puzzle.prefix === 0 ? 0 : (0xffffffff << (32 - puzzle.prefix)) >>> 0)) >>> 0)) >>> 0)}
          </p>
        )}
      </div>

      {/* Counter */}
      <p className="text-white/50 text-sm font-mono tracking-wider">
        {correctCount}/{puzzle.correctSet.size} IDENTIFIED
      </p>

      {/* Address list */}
      <div className="w-full max-w-sm space-y-1.5">
        {puzzle.addresses.map((addr, idx) => {
          const isSelected = selectedSet.has(addr);
          const isCursor = !isTouch && cursorIndex === idx;
          const isCorrect = puzzle.correctSet.has(addr);
          const showMissed = resolvedRef.current && isCorrect && !isSelected;

          let itemClasses = `
            w-full flex items-center justify-between
            px-4 py-2.5
            font-mono text-sm sm:text-base
            border rounded-md
            transition-all duration-150
          `;

          let itemStyle: React.CSSProperties = {};

          if (isSelected && isCorrect) {
            itemClasses += " bg-cyan-950/40 border-cyber-cyan text-cyber-cyan";
            itemStyle = { boxShadow: "0 0 8px rgba(0, 255, 255, 0.3)" };
          } else if (isSelected && !isCorrect) {
            itemClasses += " bg-red-950/40 border-red-500 text-red-400";
            itemStyle = { boxShadow: "0 0 8px rgba(255, 0, 0, 0.4)" };
          } else if (showMissed) {
            itemClasses += " bg-cyan-950/20 border-cyan-700/40 text-cyan-500/50";
          } else {
            itemClasses += " bg-white/[0.03] border-white/10 text-white/60";
            itemClasses += ` ${HOVER_CLASSES} cursor-pointer`;
          }

          if (isCursor && !resolvedRef.current) {
            itemClasses += ` ${CURSOR_CLASSES}`;
          }

          return (
            <button
              key={idx}
              data-testid="address"
              data-correct={isCorrect}
              type="button"
              onClick={() => handleToggle(idx)}
              onMouseEnter={() => {
                if (!isTouch) {
                  setCursorIndex(idx);
                  cursorIndexRef.current = idx;
                }
              }}
              disabled={!isActive || resolvedRef.current}
              className={itemClasses}
              style={itemStyle}
            >
              <span className="tracking-wider">{addr}</span>
              {isSelected && isCorrect && (
                <span className="text-cyber-cyan text-lg">&#10003;</span>
              )}
              {isSelected && !isCorrect && (
                <span className="text-red-400 text-lg">&#10007;</span>
              )}
            </button>
          );
        })}
      </div>
    </MinigameShell>
  );
}
