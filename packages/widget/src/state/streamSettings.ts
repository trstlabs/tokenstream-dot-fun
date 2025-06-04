// src/state/streamSettings.ts

import { atom } from "jotai";

import { atomWithStorageNoCrossTabSync } from "@/utils/misc";

import { swapSettingsAtom } from "./swapPage";

import { createMessagesForPfmStream } from "./Stream/createMessagesForPfmStream";
import { createMessagesForAuthzExec } from "./Stream/createMessagesForAuthzExec";
import { intentoHostedAccountSupportedChains } from "@/constants/intentoChains";
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
import { getConnectedSignersAtom, walletsAtom } from "./wallets";
import { getWallet, WalletType } from "graz";

export type StreamMode = 'EQUAL_PARTS' | 'RECURRING';

export interface IntentoStreamSettings {
  customGasAmount: string;
  interval: number;
  duration: number;
  startAt: number;
  shouldStream: boolean;
  emailAddress: string;
  streamMode: StreamMode;
}

// Default values (same as before)
export const defaultStreamSettings: IntentoStreamSettings = {
  customGasAmount: "200000",
  interval: 600, // 10 minutes
  duration: 86400, // 1 day
  startAt: 0,
  shouldStream: false,
  emailAddress: "",
  streamMode: 'EQUAL_PARTS', // Default to equal parts mode
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
  const getSigners = get(getConnectedSignersAtom);
  const wallets = get(walletsAtom);
  try {
    // Ensure wallet is connected before proceeding
    if (!getSigners?.getCosmosSigner) {
      throw new Error("Cosmos wallet is not connected");
    }

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
        revisionNumber: 0n,
        revisionHeight: 0n,
      },
      timeoutTimestamp:
        BigInt(Math.floor(Date.now() / 1000) + 10 * 60) * 1_000_000_000n, // 10 minutes
      memo: "",
    });
    console.log("msgTransfer", msgTransfer);

    const msgTransferEncodeObject: EncodeObject = {
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: msgTransfer,
    };
    const getOfflineSigner = async (chainId: string) => {
      if (getSigners?.getCosmosSigner) {
        return getSigners.getCosmosSigner(chainId);
      }
      if (!wallets.cosmos) {
        throw new Error("getCosmosSigner error: no cosmos wallet");
      }
      const wallet = getWallet(wallets.cosmos.walletName as WalletType);
      if (!wallet) {
        throw new Error("getCosmosSigner error: wallet not found");
      }
      const key = await wallet.getKey(chainId);

      return key.isNanoLedger
        ? wallet.getOfflineSignerOnlyAmino(chainId)
        : wallet.getOfflineSigner(chainId);
    };

    const { stargateClient } = await getSigningStargateClient({
      chainId,
      getOfflineSigner,
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

  // Check if the source chain supports Intento hosted accounts for AuthZ MsgExec
  const sourceChainId = route.sourceAssetChainId;
  const isIntentoHostedAccountSupportedChain =
    intentoHostedAccountSupportedChains.includes(sourceChainId);

  // Use AuthZ MsgExec for supported chains (e.g., Osmosis), otherwise use PFM Stream
  let result;
  if (isIntentoHostedAccountSupportedChain) {
    console.log(`Using AuthZ MsgExec for ${sourceChainId} chain`);
    result = await createMessagesForAuthzExec({
      route,
      userAddresses,
      streamSettings,
      swapSettings: {
        slippage: swapSettings.slippage,
      },
      get,
    });
  } else {
    console.log(`Using PFM Stream for ${sourceChainId} chain`);
    result = await createMessagesForPfmStream({
      route,
      userAddresses,
      streamSettings,
      swapSettings,
      get,
    });
  }

  if (!result) {
    const error = new Error("wasm contract not found");
    submitSwapExecutionCallbacks?.onError?.(error, transactionDetailsArray);
    return;
  }

  set(streamMessagesAtom, result);
});
