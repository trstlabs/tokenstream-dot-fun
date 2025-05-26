// src/state/streamSettings.ts

import { atom } from "jotai";

import { atomWithStorageNoCrossTabSync } from "@/utils/misc";

import { swapSettingsAtom } from "./swapPage";

import { createMessagesForPfmStream } from "./Stream/createMessagesForPfmStream";
import { Coin } from "@cosmjs/amino";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { StreamMessagesResult } from "./Stream/converters";
import {
  submitSwapExecutionCallbacksAtom,
  swapExecutionStateAtom,
} from "./swapExecutionPage";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { getSigningStargateClient } from "@skip-go/client";
import { EncodeObject } from "@cosmjs/proto-signing";

export interface IntentoStreamSettings {
  customGasAmount: string;
  interval: number;
  duration: number;
  startAt: number;
  shouldStream: Boolean;
  emailAddress: string;
}

// Default values (same as before)
export const defaultStreamSettings: IntentoStreamSettings = {
  customGasAmount: "200000", // Replace with your actual DEFAULT_GAS_AMOUNT if needed
  interval: 600,
  duration: 86400,
  startAt: 0,
  shouldStream: false,
  emailAddress: "",
};

// Persisted atom
export const streamSettingsAtom =
  atomWithStorageNoCrossTabSync<IntentoStreamSettings>(
    "streamSettingsAtom",
    defaultStreamSettings
  );

export const expectedStreamFeesAtom = atom<Coin[]>();
export const streamMessagesAtom = atom<StreamMessagesResult>();

// Define the atom for triggering the msgTransfer action
export const msgTransferAtomToIntentoAtom = atom(null, async (get, set) => {
  const { userAddresses } = get(swapExecutionStateAtom);
  // Get expected fees or other required state here
  const expectedStreamFees = get(expectedStreamFeesAtom);
  const streamFeesAddress = get(streamMessagesAtom)?.intoAddress;

  try {
    // Prepare the message for transfer
    const chainId = import.meta.env.VITE_CHAIN_ID_ATOM;
    const cosmosAddress = toBech32(
      "cosmos",
      fromBech32(userAddresses[0].address).data
    );

    const msgTransfer: MsgTransfer = MsgTransfer.fromPartial({
      sourceChannel: import.meta.env.VITE_CHANNEL_ID_ATOM_INTO,
      sourcePort: "transfer",
      sender: cosmosAddress,
      token: expectedStreamFees?.find(
        (fee) =>
          fee.denom === import.meta.env.VITE_IBC_DENOM_ATOM ||
          fee.denom != "uinto"
      ),
      receiver: streamFeesAddress,
      timeoutHeight: {
        revisionNumber: "0",
        revisionHeight: "0",
      },
      timeoutTimestamp: (
        BigInt(Math.floor(Date.now() / 1000) + 10 * 60) * 1_000_000_000n
      ).toString(), // 10 minutes
      memo: "",
    });
    console.log("msgTransfer", msgTransfer);

    const msgTransferEncodeObject: EncodeObject = {
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: msgTransfer,
    };
    const { stargateClient } = await getSigningStargateClient({
      chainId,
    });

    // Execute the transfer
    const res = await stargateClient.signAndBroadcast(
      cosmosAddress,
      [msgTransferEncodeObject],
      "auto"
    );

    console.log(res);

    if (res.code !== 0) {
      throw new Error("Failed to submit msg");
    }

    // If successful, do something, e.g., update state
    set(expectedStreamFeesAtom, []); // Clear expected fees after successful transfer
  } catch (error: unknown) {
    console.error("Transaction failed:", error);
  }
});

export const createStreamMessagesAtom = atom(null, async (get, set) => {
  const { route, userAddresses, transactionDetailsArray } = get(
    swapExecutionStateAtom
  );
  const submitSwapExecutionCallbacks = get(submitSwapExecutionCallbacksAtom);
  const swapSettings = get(swapSettingsAtom);
  const streamSettings = get(streamSettingsAtom);
  if (!route) return;

  const result = await createMessagesForPfmStream({
    route,
    userAddresses,
    streamSettings,
    swapSettings,
    get,
  });

  if (!result) {
    const error = new Error("wasm contract not found");
    submitSwapExecutionCallbacks?.onError?.(error, transactionDetailsArray);
    return;
  }

  set(streamMessagesAtom, result);
});
