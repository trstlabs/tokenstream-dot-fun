import { atom } from "jotai";

export type StrategyKey =
  | "spot-threshold"
  | "twap-based"
  | "trend-detection"
  | "spot-vs-twap-arb";

export type Strategy = {
  key: StrategyKey;
  title: string;
  description: string;
};

export const strategies: Strategy[] = [
  {
    key: "spot-threshold",
    title: "Spot Price threshold",
    description: "Determine to stream only if spot price is favorable.",
  },
  {
    key: "twap-based",
    title: "TWAP-based",
    description:
      "Stream only when the average price across the interval is below your target.",
  },
  {
    key: "trend-detection",
    title: "Trend Detection",
    description:
      "Track positive or negative momentum using TWAP deltas.",
  },
  {
    key: "spot-vs-twap-arb",
    title: "Spot vs TWAP Arbitrage",
    description: "Identify dislocations between spot and fair value.",
  },
];

export const selectedStrategyAtom = atom<Strategy | undefined>(undefined);
