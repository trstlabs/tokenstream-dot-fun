import { atom } from "jotai";

export enum Routes {
  SwapPage,
  SwapExecutionPage,
  TransactionHistoryPage,
  StreamPage,
  StrategyPage,
}

export const currentPageAtom = atom<Routes>(Routes.SwapPage);
