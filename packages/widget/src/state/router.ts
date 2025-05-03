import { atom } from "jotai";

export enum Routes {
  SwapPage,
  SwapExecutionPage,
  TransactionHistoryPage,
  StreamPage,
}

export const currentPageAtom = atom<Routes>(Routes.SwapPage);
