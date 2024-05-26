import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_GAS_AMOUNT } from "@/constants/gas";

interface IntentoSettingsStore {
  customGasAmount: string;
  interval: string;
  duration: string;
  startAt: string;
  shouldStream: boolean;
}

export const defaultValues: IntentoSettingsStore = {
  customGasAmount: DEFAULT_GAS_AMOUNT,
  interval: (3*86400).toString(),
  duration: (6*86400).toString(),
  startAt: (3*86400).toString(),
  shouldStream: false,
};

export const useStreamSettingsStore = create<IntentoSettingsStore>()(
  persist(() => defaultValues, {
    name: "IntentoSettingsState",
    version: 4,
  }),
);
