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
    description: "Adds +1 s to every protocol on the current floor.",
    category: "time",
    basePrice: 30,
    effect: { type: "time-bonus", value: 1 },
    icon: "clock",
  },
  {
    id: "clock-boost",
    name: "Clock Boost",
    description: "Adds +2 s to every protocol on the current floor.",
    category: "time",
    basePrice: 55,
    effect: { type: "time-bonus", value: 2 },
    icon: "zap",
  },
  {
    id: "chrono-surge",
    name: "Chrono Surge",
    description: "Adds +1.5 s to every protocol on the current floor.",
    category: "time",
    basePrice: 40,
    effect: { type: "time-bonus", value: 1.5 },
    icon: "timer",
  },
  {
    id: "lag-spike",
    name: "Lag Spike",
    description: "Adds +0.5 s to every protocol on the current floor.",
    category: "time",
    basePrice: 20,
    effect: { type: "time-bonus", value: 0.5 },
    icon: "pause-circle",
  },
  {
    id: "buffer-extend",
    name: "Buffer Extend",
    description: "Adds +2.5 s to every protocol on the current floor.",
    category: "time",
    basePrice: 70,
    effect: { type: "time-bonus", value: 2.5 },
    icon: "clock",
  },
  // Time Siphon: each consecutive win adds +0.2 s to the next protocol's timer.
  // Resets on fail. Floor-scoped (consumed at advanceFloor).
  {
    id: "time-siphon",
    name: "Time Siphon",
    description: "Each win adds +0.2 s to the next protocol's timer. Resets on fail. Floor-scoped.",
    category: "time",
    basePrice: 35,
    effect: { type: "time-siphon", value: 0.2 },
    icon: "activity",
  },
  // Deadline Override: when timer reaches the last 5%, it pauses for 1 s.
  // Consumed after the first minigame it's present for.
  {
    id: "deadline-override",
    name: "Deadline Override",
    description: "Timer pauses for 1 s when it hits the last 5%. Single use.",
    category: "time",
    basePrice: 50,
    effect: { type: "deadline-override", value: 1 },
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
    description: "Next failure deals only 25% damage. Consumed on trigger.",
    category: "defense",
    basePrice: 40,
    effect: { type: "damage-reduction", value: 0.25 },
    icon: "shield-half",
  },
  {
    id: "redundancy-layer",
    name: "Redundancy Layer",
    description: "Absorbs the next 2 failures at 50% damage each. Consumed after both uses.",
    category: "defense",
    basePrice: 75,
    effect: { type: "damage-reduction-stacked", value: 0.50 },
    icon: "layers",
  },

  // ── SKIP ──────────────────────────────────────────────────────────────────
  {
    id: "backdoor",
    name: "Backdoor",
    description: "Skip the next protocol without playing. Counts as a success but earns no credits or data.",
    category: "skip",
    basePrice: 45,
    effect: { type: "skip", value: 1 },
    icon: "skip-forward",
  },
  {
    id: "warp-gate",
    name: "Warp Gate",
    description: "Skip all remaining protocols on the current floor and go straight to the vendor. Earns 15% of normal rewards for skipped protocols.",
    category: "skip",
    basePrice: 150,
    effect: { type: "skip-floor", value: 0.15 },
    icon: "fast-forward",
  },
  {
    id: "null-route",
    name: "Null Route",
    description: "Auto-pass the next protocol. Counts as a success with full credit and data rewards.",
    category: "skip",
    basePrice: 55,
    effect: { type: "skip-silent", value: 1 },
    icon: "route-off",
  },

  // ── HEALING ───────────────────────────────────────────────────────────────
  {
    id: "repair-kit",
    name: "Repair Kit",
    description: "Restore +25 HP immediately.",
    category: "healing",
    basePrice: 65,
    effect: { type: "heal", value: 25 },
    icon: "heart-pulse",
  },
  {
    id: "system-restore",
    name: "System Restore",
    description: "Restore +35 HP immediately.",
    category: "healing",
    basePrice: 80,
    effect: { type: "heal", value: 35 },
    icon: "refresh-cw",
  },
  {
    id: "nano-repair",
    name: "Nano Repair",
    description: "Restore +5 HP after each successful protocol this floor.",
    category: "healing",
    basePrice: 45,
    effect: { type: "heal-on-success", value: 5 },
    icon: "activity",
  },

  // HP Leech: gain +2 HP after every protocol this floor (if you survive). Floor-scoped.
  {
    id: "hp-leech",
    name: "HP Leech",
    description: "Gain +2 HP after every protocol this floor (if you survive).",
    category: "healing",
    basePrice: 40,
    effect: { type: "hp-leech", value: 2 },
    icon: "droplets",
  },
  {
    id: "repair-drone",
    name: "Repair Drone",
    description: "Restore +15 HP immediately.",
    category: "healing",
    basePrice: 50,
    effect: { type: "heal", value: 15 },
    icon: "cpu",
  },

  // ── ASSIST ────────────────────────────────────────────────────────────────
  // (slash-calibration removed — meta slash-window covers it)
  // (bracket-auto-close removed — meta bracket-reducer/mirror cover it)
  // (arrow-compass removed — meta arrow-preview covers it)
  // (mine-detector removed — meta mine-echo covers it)
];
