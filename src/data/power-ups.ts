import type { RunShopItem } from "@/types/shop";

/**
 * Run-shop item pool — purchased with credits during a run.
 * All 18 items are spread across every category defined in RunShopItem.
 */
export const RUN_SHOP_POOL: RunShopItem[] = [
  // ── TIME ──────────────────────────────────────────────────────────────────
  {
    id: "time-freeze",
    name: "Time Freeze",
    description: "Adds +2 s to the next minigame's timer.",
    category: "time",
    basePrice: 30,
    effect: { type: "time-bonus", value: 2 },
    icon: "clock",
  },
  {
    id: "overclock",
    name: "Overclock",
    description: "Next minigame runs at 0.75× speed — more breathing room.",
    category: "time",
    basePrice: 45,
    effect: { type: "time-multiplier", value: 0.75 },
    icon: "zap",
  },
  {
    id: "chrono-surge",
    name: "Chrono Surge",
    description: "Adds +3 s to every minigame on the current floor.",
    category: "time",
    basePrice: 65,
    effect: { type: "time-bonus", value: 3 },
    icon: "timer",
  },
  {
    id: "lag-spike",
    name: "Lag Spike",
    description: "Pauses the timer for 1 s at the start of the next minigame.",
    category: "time",
    basePrice: 40,
    effect: { type: "time-pause", value: 1 },
    icon: "pause-circle",
  },

  // ── DEFENSE ───────────────────────────────────────────────────────────────
  {
    id: "firewall-patch",
    name: "Firewall Patch",
    description: "Next failure deals 0 damage. Consumed on trigger.",
    category: "defense",
    basePrice: 60,
    effect: { type: "shield", value: 1 },
    icon: "shield",
  },
  {
    id: "damage-reducer",
    name: "Damage Reducer",
    description: "Next failure deals 50 % less damage.",
    category: "defense",
    basePrice: 40,
    effect: { type: "damage-reduction", value: 0.5 },
    icon: "shield-half",
  },
  {
    id: "redundancy-layer",
    name: "Redundancy Layer",
    description: "Absorbs the next 2 failures at 25 % damage each.",
    category: "defense",
    basePrice: 75,
    effect: { type: "damage-reduction-stacked", value: 0.25 },
    icon: "layers",
  },

  // ── SKIP ──────────────────────────────────────────────────────────────────
  {
    id: "backdoor",
    name: "Backdoor",
    description: "Skip 1 minigame on this floor without penalty.",
    category: "skip",
    basePrice: 55,
    effect: { type: "skip", value: 1 },
    icon: "skip-forward",
  },
  {
    id: "emergency-exit",
    name: "Emergency Exit",
    description: "Skip the entire current floor. Only usable below 30 HP.",
    category: "skip",
    basePrice: 80,
    effect: { type: "skip-floor", value: 1 },
    icon: "door-open",
  },
  {
    id: "null-route",
    name: "Null Route",
    description: "Auto-pass the next minigame but earn no credits for it.",
    category: "skip",
    basePrice: 50,
    effect: { type: "skip-silent", value: 1 },
    icon: "route-off",
  },

  // ── HEALING ───────────────────────────────────────────────────────────────
  {
    id: "repair-kit",
    name: "Repair Kit",
    description: "Restore +20 HP immediately.",
    category: "healing",
    basePrice: 50,
    effect: { type: "heal", value: 20 },
    icon: "heart-pulse",
  },
  {
    id: "system-restore",
    name: "System Restore",
    description: "Restore +35 HP immediately.",
    category: "healing",
    basePrice: 75,
    effect: { type: "heal", value: 35 },
    icon: "refresh-cw",
  },
  {
    id: "nano-repair",
    name: "Nano Repair",
    description: "Restore +10 HP after each successful minigame this floor.",
    category: "healing",
    basePrice: 45,
    effect: { type: "heal-on-success", value: 10 },
    icon: "activity",
  },

  // ── VISION ────────────────────────────────────────────────────────────────
  {
    id: "preview-module",
    name: "Preview Module",
    description: "See the minigame type before it starts — once.",
    category: "vision",
    basePrice: 35,
    effect: { type: "preview", value: 1 },
    icon: "eye",
  },
  {
    id: "hint-module",
    name: "Hint Module",
    description: "Reveals a small contextual hint during the next minigame.",
    category: "vision",
    basePrice: 40,
    effect: { type: "hint", value: 1 },
    icon: "lightbulb",
  },
  {
    id: "threat-map",
    name: "Threat Map",
    description: "Highlights the most dangerous element in the next minigame.",
    category: "vision",
    basePrice: 50,
    effect: { type: "highlight-danger", value: 1 },
    icon: "map",
  },

  // ── ASSIST ────────────────────────────────────────────────────────────────
  {
    id: "slash-calibration",
    name: "Slash Calibration",
    description: "Widens the perfect-hit window for Slash Timing by 20 %.",
    category: "assist",
    basePrice: 40,
    effect: { type: "window-extend", value: 0.2, minigame: "slash-timing" },
    icon: "sword",
  },
  {
    id: "bracket-auto-close",
    name: "Bracket Auto-Close",
    description: "One random bracket is pre-closed in Close Brackets.",
    category: "assist",
    basePrice: 45,
    effect: { type: "auto-close", value: 1, minigame: "close-brackets" },
    icon: "code",
  },
  {
    id: "arrow-compass",
    name: "Arrow Compass",
    description: "First arrow in Match Arrows is always revealed.",
    category: "assist",
    basePrice: 40,
    effect: { type: "reveal-first", value: 1, minigame: "match-arrows" },
    icon: "compass",
  },
  {
    id: "mine-detector",
    name: "Mine Detector",
    description: "One random mine is flagged at the start of Mine Sweep.",
    category: "assist",
    basePrice: 45,
    effect: { type: "flag-mine", value: 1, minigame: "mine-sweep" },
    icon: "radio",
  },
];
