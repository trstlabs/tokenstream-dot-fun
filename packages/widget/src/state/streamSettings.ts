// src/state/streamSettings.ts

import { atomWithStorageNoCrossTabSync } from "@/utils/misc";

export interface IntentoStreamSettings {
  customGasAmount: string;
  interval: number;
  duration: number;
  startAt: number;
  shouldStream: Boolean;
}

// Default values (same as before)
export const defaultStreamSettings: IntentoStreamSettings = {
  customGasAmount: "200000",  // Replace with your actual DEFAULT_GAS_AMOUNT if needed
  interval: 600,
  duration: 86400,
  startAt: 0,
  shouldStream: false,
};

// Persisted atom
export const streamSettingsAtom = atomWithStorageNoCrossTabSync<IntentoStreamSettings>(
  "streamSettingsAtom",
  defaultStreamSettings,
);
