import type { MetaUpgrade } from "@/types/shop";

/** Starting bonus upgrades — resources and stats at the beginning of each run. */
export const STARTING_UPGRADES: MetaUpgrade[] = [
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
];
