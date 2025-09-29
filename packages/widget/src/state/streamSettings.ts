// src/state/streamSettings.ts

import { atom } from "jotai";

import { atomWithStorageNoCrossTabSync } from "@/utils/storage";

import { swapSettingsAtom } from "./swapPage";

import { createMessagesForPfmStream } from "./Stream/createMessagesForPfmStream";
import { createMessagesForAuthzExec } from "./Stream/createMessagesForAuthzExec";
import { intentoTrustlessAgentSupportedChains } from "@/constants/intentoChains";
import { Coin } from "@cosmjs/amino";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { StreamMessagesResult } from "./Stream/helpers";
import {
  submitSwapExecutionCallbacksAtom,
  swapExecutionStateAtom,
} from "./swapExecutionPage";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { getSigningStargateClient } from "@skip-go/client";
import { EncodeObject } from "@cosmjs/proto-signing";
import { getConnectedSignersAtom, walletsAtom } from "./wallets";
import { getWallet, WalletType } from "graz";

export type StreamMode = "SPLIT_INPUT" | "RECUR_INPUT";

export const IBC_TIMEOUT_SECONDS = 600; // 1 min timeout for IBC

export interface IntentoStreamSettings {
  /**
   * Minimum asset out percent for WASM Skip contract (-20, 0, +5, etc), or -1 for zero
   */
  minAssetOutPercent: number;
  customGasAmount: string;
  interval: number;
  duration: number;
  startAt: number;
  shouldStream: boolean;
  emailAddress: string;
  streamMode: StreamMode;
  streamIntoStreamSwapID?: string;
}

// Default values (same as before)
export const defaultStreamSettings: IntentoStreamSettings = {
  minAssetOutPercent: -1,
  customGasAmount: "200000",
  interval: 7200, // 2 hours
  duration: 86400, // 1 day
  startAt: 0,
  shouldStream: false,
  emailAddress: "",
  streamMode: "SPLIT_INPUT",
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
// Atom for transferring tokens to Intento via IBC
const createTransferAtom = (isMsgSend: boolean) =>
  atom(null, async (get, _set) => {
    const { userAddresses } = get(swapExecutionStateAtom);
    const expectedStreamFees = get(expectedStreamFeesAtom);
    const streamFeesAddress = get(streamMessagesAtom)?.intoAddress;
    const getSigners = get(getConnectedSignersAtom);
    const wallets = get(walletsAtom);

    try {
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

      if (isMsgSend) {
        // Direct MsgSend to Intento chain
        const chainId = import.meta.env.VITE_CHAIN_ID_INTO;
        const intoAddress = toBech32(
          "into", // Intento's bech32 prefix
          fromBech32(userAddresses[0].address).data
        );

        const { stargateClient } = await getSigningStargateClient({
          chainId,
          getOfflineSigner,
        });

        const msgSend = {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: intoAddress,
            toAddress: streamFeesAddress,
            amount: expectedStreamFees?.filter(
              (coin) => coin.denom === "uinto"
            ),
          },
        };

        const res = await stargateClient.signAndBroadcast(
          intoAddress,
          [msgSend],
          { amount: [], gas: "180000" }
        );

        console.log("Direct MsgSend result:", res);
        if (res.code !== 0) {
          throw new Error("Failed to submit MsgSend");
        }
      } else {
        // IBC MsgTransfer (existing ATOM transfer logic)
        const chainId = import.meta.env.VITE_CHAIN_ID_ATOM;
        const cosmosAddress = toBech32(
          "cosmos",
          fromBech32(userAddresses[0].address).data
        );

        const msgTransfer: MsgTransfer = MsgTransfer.fromPartial({
          sourceChannel: import.meta.env.VITE_CHANNEL_ID_ATOM_INTO,
          sourcePort: "transfer",
          sender: cosmosAddress,
          token: {
            amount: expectedStreamFees?.find(
              (fee) => fee.denom === import.meta.env.VITE_IBC_DENOM_ATOM
            )?.amount,
            denom: "uatom",
          },
          receiver: streamFeesAddress,
          timeoutHeight: { revisionNumber: 0n, revisionHeight: 0n },
          timeoutTimestamp:
            BigInt(Math.floor(Date.now() / 1000) + IBC_TIMEOUT_SECONDS) *
            1_000_000_000n,
        });

        const msgTransferEncodeObject: EncodeObject = {
          typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
          value: msgTransfer,
        };

        const { stargateClient } = await getSigningStargateClient({
          chainId,
          getOfflineSigner,
        });

        const res = await stargateClient.signAndBroadcast(
          cosmosAddress,
          [msgTransferEncodeObject],
          { amount: [], gas: "180000" }
        );

        console.log("IBC MsgTransfer result:", res);
        if (res.code !== 0) {
          throw new Error("Failed to submit MsgTransfer");
        }
      }

      // Clear expected fees after successful transfer
      _set(expectedStreamFeesAtom, []);
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error; // Re-throw to be handled by the UI
    }
  });

export const msgTransferAtomToIntentoAtom = createTransferAtom(false);
export const msgSendToIntentoAtom = createTransferAtom(true);

export const createStreamMessagesAtom = atom(null, async (get, set) => {
  const { route, userAddresses, transactionDetailsArray, existingGrant } = get(
    swapExecutionStateAtom
  );
  const submitSwapExecutionCallbacks = get(submitSwapExecutionCallbacksAtom);
  const swapSettings = get(swapSettingsAtom);
  const streamSettings = get(streamSettingsAtom);
  if (!route) return;

  // Check if the source chain supports Intento trustless agents for AuthZ MsgExec
  const sourceChainId = route.sourceAssetChainId;
  const isIntentoTrustlessAgentSupportedChain =
    intentoTrustlessAgentSupportedChains.includes(sourceChainId);

  // Use AuthZ MsgExec for supported chains (e.g., Osmosis), otherwise use PFM Stream
  let result;
  if (isIntentoTrustlessAgentSupportedChain) {
    console.log(`Using AuthZ MsgExec for ${sourceChainId} chain`);
    result = await createMessagesForAuthzExec({
      route,
      userAddresses,
      streamSettings,
      swapSettings: {
        slippage: swapSettings.slippage,
      },
      get,
      existingGrant,
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
