import type { MetaUpgrade } from "@/types/shop";

/**
 * Persistent meta-upgrade pool — purchased with data (◆) between runs.
 * 46 upgrades across all four categories.
 */
export const META_UPGRADE_POOL: MetaUpgrade[] = [
  // ── STAT — stackable (infinite) ────────────────────────────────────────────
  {
    id: "hp-boost",
    name: "HP Boost",
    description: "Each purchase gives +5 max HP. Infinitely stackable.",
    category: "stat",
    maxTier: 999,
    prices: [100], // dynamic pricing via getStackablePrice()
    effects: [{ type: "max-hp", value: 5 }],
    stackable: true,
  },
  {
    id: "delay-injector",
    name: "Delay Injector",
    description: "Increases all timers by 3% per purchase (multiplicative).",
    category: "stat",
    maxTier: 999,
    prices: [100], // dynamic pricing via getStackablePrice()
    effects: [{ type: "global-time-bonus", value: 0.03 }],
    stackable: true,
  },
  {
    id: "difficulty-reducer",
    name: "Difficulty Reducer",
    description: "Reduces effective difficulty by 5% per purchase (multiplicative). Diminishing returns.",
    category: "stat",
    maxTier: 999,
    prices: [150], // dynamic pricing via getStackablePrice()
    effects: [{ type: "difficulty-reduction", value: 0.02 }],
    stackable: true,
  },

  // Emergency Patch: regenerate 2% of max HP at the start of each floor. Stackable.
  // Applied in advanceFloor. Stacks additively with tier count.
  {
    id: "emergency-patch",
    name: "Emergency Patch",
    description: "Regenerate 2% of max HP at the start of each floor. Stackable.",
    category: "stat",
    maxTier: 999,
    prices: [120], // dynamic pricing via getStackablePrice()
    effects: [{ type: "floor-regen", value: 0.02 }],
    stackable: true,
  },

  // Cascade Clock: each consecutive win adds +2% of base timer. Resets on fail.
  // Does NOT reset on floor advance. Cap per tier: 10%/20%/30%/40%/50%.
  {
    id: "cascade-clock",
    name: "Cascade Clock",
    description: "Each consecutive win adds +2% base timer. Resets on fail. Cap: 10% per tier (up to 50% at tier 5).",
    category: "stat",
    maxTier: 5,
    prices: [150, 300, 500, 750, 1000],
    effects: [
      { type: "cascade-clock", value: 0.10 },
      { type: "cascade-clock", value: 0.20 },
      { type: "cascade-clock", value: 0.30 },
      { type: "cascade-clock", value: 0.40 },
      { type: "cascade-clock", value: 0.50 },
    ],
  },

  // ── STAT — tiered ─────────────────────────────────────────────────────────
  {
    id: "thicker-armor",
    name: "Thicker Armor",
    description: "Permanently reduces incoming damage by 5/10/15/20/25%.",
    category: "stat",
    maxTier: 5,
    prices: [100, 200, 350, 500, 750],
    effects: [
      { type: "damage-reduction", value: 0.05 },
      { type: "damage-reduction", value: 0.10 },
      { type: "damage-reduction", value: 0.15 },
      { type: "damage-reduction", value: 0.20 },
      { type: "damage-reduction", value: 0.25 },
    ],
  },
  {
    id: "credit-multiplier",
    name: "Credit Multiplier",
    description: "Each purchase gives +3% credits (multiplicative). Infinitely stackable.",
    category: "stat",
    maxTier: 999,
    prices: [100],
    effects: [{ type: "credit-bonus", value: 0.03 }],
    stackable: true,
  },
  {
    id: "data-siphon",
    name: "Data Siphon",
    description: "Each purchase gives +3% data (multiplicative). Infinitely stackable.",
    category: "stat",
    maxTier: 999,
    prices: [100],
    effects: [{ type: "data-bonus", value: 0.03 }],
    stackable: true,
  },
  {
    id: "speed-tax",
    name: "Speed Tax",
    description: "Speed bonuses on credits are 15 / 25 / 40 % more effective.",
    category: "stat",
    maxTier: 3,
    prices: [100, 250, 500],
    effects: [
      { type: "speed-bonus-multiplier", value: 0.15 },
      { type: "speed-bonus-multiplier", value: 0.25 },
      { type: "speed-bonus-multiplier", value: 0.4 },
    ],
  },

  {
    id: "data-recovery",
    name: "Data Recovery",
    description: "Reduces death penalty from 25% to 22.5/20/17.5/15/12.5/10%.",
    category: "stat",
    maxTier: 6,
    prices: [100, 200, 300, 400, 550, 750],
    effects: [
      { type: "death-penalty-reduction", value: 0.025 },
      { type: "death-penalty-reduction", value: 0.05 },
      { type: "death-penalty-reduction", value: 0.075 },
      { type: "death-penalty-reduction", value: 0.10 },
      { type: "death-penalty-reduction", value: 0.125 },
      { type: "death-penalty-reduction", value: 0.15 },
    ],
  },

  // ── STARTING BONUS ────────────────────────────────────────────────────────
  // (quick-boot removed — random starting power-ups were inconsistent value)
  // (dual-core removed — depended on quick-boot, both removed together)
  {
    id: "overclocked",
    name: "Overclocked",
    description: "Start every run with +5/+10/+15/+20/+25 bonus HP above base.",
    category: "starting-bonus",
    maxTier: 5,
    prices: [100, 200, 350, 500, 750],
    effects: [
      { type: "start-hp", value: 5 },
      { type: "start-hp", value: 10 },
      { type: "start-hp", value: 15 },
      { type: "start-hp", value: 20 },
      { type: "start-hp", value: 25 },
    ],
  },
  {
    id: "head-start",
    name: "Head Start",
    description: "Begin each run with bonus credits: +50/+125/+300/+600/+1000.",
    category: "starting-bonus",
    maxTier: 5,
    prices: [100, 250, 450, 700, 1000],
    effects: [
      { type: "start-credits", value: 50 },
      { type: "start-credits", value: 125 },
      { type: "start-credits", value: 300 },
      { type: "start-credits", value: 600 },
      { type: "start-credits", value: 1000 },
    ],
  },
  // (pre-loaded removed — floor 1 is trivial, upgrade was wasted investment)
  // (cache-primed removed — heal guarantee reduced shop variety and decision space)

  // ── PROTOCOL UNLOCK ──────────────────────────────────────────────────────
  {
    id: "find-symbol-license",
    name: "Address Lookup License",
    description: "Unlocks the Address Lookup protocol for future runs.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [300],
    effects: [{ type: "unlock-minigame", value: 1, minigame: "find-symbol" }],
  },
  {
    id: "wire-cutting-toolkit",
    name: "Wire Cutting Toolkit",
    description: "Unlocks the Wire Cutting protocol for future runs.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [300],
    effects: [{ type: "unlock-minigame", value: 1, minigame: "wire-cutting" }],
  },
  {
    id: "cipher-crack-license",
    name: "Cipher Crack V1 License",
    description: "Unlocks the Cipher Crack V1 protocol for future runs.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [300],
    effects: [{ type: "unlock-minigame", value: 1, minigame: "cipher-crack" }],
  },
  {
    id: "defrag-license",
    name: "Defrag License",
    description: "Unlocks the Defrag protocol.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [0], // dynamic: 200 + (unlocksOwned) * 100
    effects: [{ type: "unlock-minigame", value: 1, minigame: "defrag" }],
  },
  {
    id: "network-trace-license",
    name: "Network Trace License",
    description: "Unlocks the Network Trace protocol.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [0], // dynamic: 200 + (unlocksOwned) * 100
    effects: [{ type: "unlock-minigame", value: 1, minigame: "network-trace" }],
  },
  {
    id: "signal-echo-license",
    name: "Signal Echo License",
    description: "Unlocks the Signal Echo protocol.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [0], // dynamic: 200 + (unlocksOwned) * 100
    effects: [{ type: "unlock-minigame", value: 1, minigame: "signal-echo" }],
  },
  {
    id: "checksum-verify-license",
    name: "Checksum Verify License",
    description: "Unlocks the Checksum Verify protocol.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [0], // dynamic: 200 + (unlocksOwned) * 100
    effects: [{ type: "unlock-minigame", value: 1, minigame: "checksum-verify" }],
  },
  {
    id: "port-scan-license",
    name: "Port Scan License",
    description: "Unlocks the Port Scan protocol.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [0], // dynamic: 200 + (unlocksOwned) * 100
    effects: [{ type: "unlock-minigame", value: 1, minigame: "port-scan" }],
  },
  {
    id: "subnet-scan-license",
    name: "Subnet Scan License",
    description: "Unlocks the Subnet Scan protocol.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [0], // dynamic: 200 + (unlocksOwned) * 100
    effects: [{ type: "unlock-minigame", value: 1, minigame: "subnet-scan" }],
  },
  {
    id: "cipher-crack-v2-license",
    name: "Cipher Crack V2 License",
    description: "Unlocks the advanced Cipher Crack V2 protocol.",
    category: "minigame-unlock",
    maxTier: 1,
    prices: [0], // dynamic: 200 + (unlocksOwned) * 100
    effects: [{ type: "unlock-minigame", value: 1, minigame: "cipher-crack-v2" }],
    requires: "cipher-crack-license",
  },

  // ── GAME-SPECIFIC ─────────────────────────────────────────────────────────
  {
    id: "bracket-reducer",
    name: "Bracket Reducer",
    description: "Removes bracket types from Code Inject. Tier 1: slash, Tier 2: +pipe, Tier 3: +square brackets. Remaining: ( { <",
    category: "game-specific",
    maxTier: 3,
    prices: [150, 300, 500],
    effects: [
      { type: "minigame-specific", value: 1, minigame: "close-brackets" },
      { type: "minigame-specific", value: 2, minigame: "close-brackets" },
      { type: "minigame-specific", value: 3, minigame: "close-brackets" },
    ],
  },
  {
    id: "mine-echo",
    name: "Memory Echo",
    description: "20/30/40/50/60% of corrupted sectors remain visible at the start of Memory Scan.",
    category: "game-specific",
    maxTier: 5,
    prices: [150, 250, 400, 600, 850],
    effects: [
      { type: "minigame-specific", value: 0.20, minigame: "mine-sweep" },
      { type: "minigame-specific", value: 0.30, minigame: "mine-sweep" },
      { type: "minigame-specific", value: 0.40, minigame: "mine-sweep" },
      { type: "minigame-specific", value: 0.50, minigame: "mine-sweep" },
      { type: "minigame-specific", value: 0.60, minigame: "mine-sweep" },
    ],
  },
  {
    id: "symbol-scanner",
    name: "Symbol Scanner",
    description: "The target hex code is subtly highlighted in the grid in Address Lookup.",
    category: "game-specific",
    maxTier: 1,
    prices: [200],
    effects: [{ type: "hint", value: 1, minigame: "find-symbol" }],
  },
  {
    id: "arrow-preview",
    name: "Arrow Preview",
    description: "20/30/40/50/60% of the arrow sequence is pre-revealed in Packet Route.",
    category: "game-specific",
    maxTier: 5,
    prices: [150, 250, 400, 600, 850],
    effects: [
      { type: "peek-ahead", value: 0.20, minigame: "match-arrows" },
      { type: "peek-ahead", value: 0.30, minigame: "match-arrows" },
      { type: "peek-ahead", value: 0.40, minigame: "match-arrows" },
      { type: "peek-ahead", value: 0.50, minigame: "match-arrows" },
      { type: "peek-ahead", value: 0.60, minigame: "match-arrows" },
    ],
  },
  // (type-assist removed — weak effect, reverse-trainer covers Decrypt Signal)
  {
    id: "wire-labels",
    name: "Wire Guide",
    description: "Dims non-target wires and highlights the next wire to cut.",
    category: "game-specific",
    maxTier: 1,
    prices: [200],
    effects: [{ type: "wire-color-labels", value: 1, minigame: "wire-cutting" }],
  },
  {
    id: "cipher-hint",
    name: "Cipher Hint",
    description: "An extra cipher hint letter is shown in Cipher Crack V1.",
    category: "game-specific",
    maxTier: 1,
    prices: [225],
    effects: [{ type: "extra-hint", value: 1, minigame: "cipher-crack" }],
  },
  {
    id: "slash-window",
    name: "Slash Window",
    description: "The attack window in Slash Timing is 25 % wider.",
    category: "game-specific",
    maxTier: 1,
    prices: [175],
    effects: [{ type: "window-extend", value: 0.25, minigame: "slash-timing" }],
  },
  {
    id: "bracket-mirror",
    name: "Bracket Mirror",
    description: "Shows the next expected closing bracket in Code Inject.",
    category: "game-specific",
    maxTier: 1,
    prices: [150],
    effects: [{ type: "bracket-flash", value: 1, minigame: "close-brackets" }],
  },
  // (symbol-magnifier removed — ugly, symbol-scanner covers Address Lookup)
  {
    id: "reverse-trainer",
    name: "Autocorrect",
    description: "Shows 25/50/75/100% of words in normal order in Decrypt Signal. Corrected words are marked.",
    category: "game-specific",
    maxTier: 4,
    prices: [150, 300, 500, 750],
    effects: [
      { type: "minigame-specific", value: 0.25, minigame: "type-backward" },
      { type: "minigame-specific", value: 0.50, minigame: "type-backward" },
      { type: "minigame-specific", value: 0.75, minigame: "type-backward" },
      { type: "minigame-specific", value: 1.0, minigame: "type-backward" },
    ],
  },
  // (wire-schematic removed — preview effect was never implemented)
  // (slash-echo removed — game has no audio system)

  // ── NEW MINIGAME MODULES ────────────────────────────────────────────────────
  // (defrag-safe-start removed — safe first click is now built-in default)
  {
    id: "network-trace-highlight",
    name: "Path Highlight",
    description: "Shows the correct path for 25/50/75/100% of the timer in Network Trace.",
    category: "game-specific",
    maxTier: 4,
    prices: [150, 300, 500, 750],
    effects: [
      { type: "minigame-specific", value: 0.25, minigame: "network-trace" },
      { type: "minigame-specific", value: 0.50, minigame: "network-trace" },
      { type: "minigame-specific", value: 0.75, minigame: "network-trace" },
      { type: "minigame-specific", value: 1.0, minigame: "network-trace" },
    ],
  },
  {
    id: "signal-echo-slow",
    name: "Slow Replay",
    description: "Sequence plays 30 % slower in Signal Echo.",
    category: "game-specific",
    maxTier: 1,
    prices: [200],
    effects: [{ type: "minigame-specific", value: 0.3, minigame: "signal-echo" }],
  },
  // (checksum-calculator removed — Error Margin and Range Hint are better alternatives)
  {
    id: "port-scan-deep",
    name: "Deep Scan",
    description: "Open ports flash twice instead of once in Port Scan.",
    category: "game-specific",
    maxTier: 1,
    prices: [200],
    effects: [{ type: "minigame-specific", value: 2, minigame: "port-scan" }],
  },
  {
    id: "subnet-cidr-helper",
    name: "CIDR Helper",
    description: "Shows expanded IP range instead of just CIDR notation in Subnet Scan.",
    category: "game-specific",
    maxTier: 1,
    prices: [225],
    effects: [{ type: "minigame-specific", value: 1, minigame: "subnet-scan" }],
  },

  // ── NEW GAME-SPECIFIC UPGRADES ──────────────────────────────────────────────

  // Mine Radar: shows mine count per row/column in Defrag
  {
    id: "mine-radar",
    name: "Mine Radar",
    description: "Shows mine count per row and column for 25/50/75/100% of the timer in Defrag.",
    category: "game-specific",
    maxTier: 4,
    prices: [150, 300, 500, 750],
    effects: [
      { type: "minigame-specific", value: 0.25, minigame: "defrag" },
      { type: "minigame-specific", value: 0.50, minigame: "defrag" },
      { type: "minigame-specific", value: 0.75, minigame: "defrag" },
      { type: "minigame-specific", value: 1.0, minigame: "defrag" },
    ],
  },

  // Decode Assist: pre-fills a fraction of letters in Cipher Crack V1
  {
    id: "decode-assist",
    name: "Decode Assist",
    description: "Pre-fills 20/40/60% of decoded letters at their correct positions in Cipher Crack V1.",
    category: "game-specific",
    maxTier: 3,
    prices: [150, 300, 500],
    effects: [
      { type: "minigame-specific", value: 0.20, minigame: "cipher-crack" },
      { type: "minigame-specific", value: 0.40, minigame: "cipher-crack" },
      { type: "minigame-specific", value: 0.60, minigame: "cipher-crack" },
    ],
  },

  // Shift Marker: highlights the ROT shift offset in the alphabet chart in Cipher Crack V2
  {
    id: "shift-marker",
    name: "Shift Marker",
    description: "Highlights the ROT shift amount in the alphabet chart in Cipher Crack V2.",
    category: "game-specific",
    maxTier: 1,
    prices: [175],
    effects: [{ type: "minigame-specific", value: 1, minigame: "cipher-crack-v2" }],
  },

  // Auto-Decode V2: pre-fills a fraction of decoded letters in Cipher Crack V2
  {
    id: "auto-decode-v2",
    name: "Auto-Decode",
    description: "Pre-fills 20/40/60% of decoded letters in Cipher Crack V2.",
    category: "game-specific",
    maxTier: 3,
    prices: [200, 400, 650],
    effects: [
      { type: "hint", value: 0.20, minigame: "cipher-crack-v2" },
      { type: "hint", value: 0.40, minigame: "cipher-crack-v2" },
      { type: "hint", value: 0.60, minigame: "cipher-crack-v2" },
    ],
  },

  // Error Margin: accept answers within ±N of correct in Checksum Verify
  {
    id: "error-margin",
    name: "Error Margin",
    description: "Answers within ±1/±2/±3/±4/±5 of the correct value are accepted in Checksum Verify.",
    category: "game-specific",
    maxTier: 5,
    prices: [100, 200, 350, 500, 700],
    effects: [
      { type: "hint", value: 1, minigame: "checksum-verify" },
      { type: "hint", value: 2, minigame: "checksum-verify" },
      { type: "hint", value: 3, minigame: "checksum-verify" },
      { type: "hint", value: 4, minigame: "checksum-verify" },
      { type: "hint", value: 5, minigame: "checksum-verify" },
    ],
  },

  // Range Hint: shows the answer range with fixed ±values in Checksum Verify
  {
    id: "range-hint",
    name: "Range Hint",
    description: "Shows the answer range: ±10/±5/±3 in Checksum Verify.",
    category: "game-specific",
    maxTier: 3,
    prices: [150, 300, 500],
    effects: [
      { type: "preview", value: 10, minigame: "checksum-verify" },
      { type: "preview", value: 5, minigame: "checksum-verify" },
      { type: "preview", value: 3, minigame: "checksum-verify" },
    ],
  },

  // Port Logger: shows a text list of open port numbers during the selection phase in Port Scan
  {
    id: "port-logger",
    name: "Port Logger",
    description: "Shows a text list of open port numbers during the selection phase in Port Scan.",
    category: "game-specific",
    maxTier: 1,
    prices: [200],
    effects: [{ type: "hint", value: 1, minigame: "port-scan" }],
  },
];
