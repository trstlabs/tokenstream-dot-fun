import { toBech32 } from "@cosmjs/encoding";

import { skipClientConfigAtom } from "@/state/skipClient"; // adjust import path
import { getChainInfo } from "graz";
import { sha256 } from "@cosmjs/crypto";
import { atomWithMutation } from "jotai-tanstack-query";
import { EncodeObject } from "@cosmjs/proto-signing";

/**
 * Construct a WASM message for Skip contract streaming with updated timestamp and minAssetOut.
 * @param wasmMsg The original WASM message object
 * @param recurrences Number of recurrences for DCA (ignored if not SPLIT_INPUT)
 * @param streamStartSec The stream start timestamp (in seconds)
 * @param streamEndSec The stream end timestamp (in seconds)
 * @param minAssetOutPercent Percentage for min_asset.native.amount (-20, 0, +5, etc), or -1 for zero
 * @returns The mutated WASM message
 */
export function constructWasmMsgSkipContract(
  wasmMsg: any,
  recurrences: number,
  streamStartSec: number,
  streamEndSec: number,
  minAssetOutPercent: number,
  streamMode: "SPLIT_INPUT" | "RECUR_INPUT"
): any {
  // Defensive copy (if needed)
  // const msg = JSON.parse(JSON.stringify(wasmMsg));
  const msg = wasmMsg;

  // Calculate stream duration in seconds
  const streamDuration = streamEndSec - streamStartSec;

  // Set timeout to be the maximum of 1 hour or 10% of stream duration, with a cap at 7 days
  const minTimeout = 3600; // 1 hour
  const maxTimeout = 7 * 24 * 3600; // 7 days
  const calculatedTimeout = Math.min(
    Math.max(Math.floor(streamDuration * 0.1), minTimeout),
    maxTimeout
  );

  // Set the timeout to be the later of:
  // 1. The stream end time + calculated timeout
  // 2. Current time + minimum timeout
  // This ensures the timeout never happens before the stream ends
  const absoluteTimeout = Math.max(
    streamEndSec + calculatedTimeout, // Option 1
    streamStartSec + minTimeout // Option 2 (safety net)
  );

  // Set the timeout timestamp in nanoseconds
  msg.swap_and_action.timeout_timestamp = absoluteTimeout * 1_000_000_000;

  // Calculate original amount
  const originalAmount = parseInt(
    msg.swap_and_action.min_asset.native.amount,
    10
  );

  // DCA: divide amount by recurrences if recurrences > 1
  let dividedAmount = originalAmount;
  if (streamMode === "SPLIT_INPUT") {
    if (recurrences > 1) {
      dividedAmount = Math.floor(originalAmount / recurrences);
    }
  }

  // Set min_asset.native.amount based on minAssetOutPercent
  let minAssetOut: number;
  if (minAssetOutPercent === -1) {
    minAssetOut = 0;
  } else {
    minAssetOut = Math.floor(dividedAmount * (1 + minAssetOutPercent / 100));
  }
  msg.swap_and_action.min_asset.native.amount = String(minAssetOut);

  if (minAssetOut < 0) {
    throw new Error("min_asset.native.amount calculated as negative");
  }

  return msg;
}

// Constants (this would need to be the equivalent of `types.ModuleName` in Go)
const ModuleName = "packetfowardmiddleware";

export function getForwardAddress({
  destPrefix,
  channel,
  originalSender,
}: {
  destPrefix: string;
  channel: string;
  originalSender: string;
}): string {
  // Step 1: Prepare inputs
  const senderStr = `${channel}/${originalSender}`;

  // Step 2: Hash the module name
  const moduleHash = sha256(new TextEncoder().encode(ModuleName));

  // Step 3: Hash moduleHash || senderStr
  const combined = new Uint8Array(moduleHash.length + senderStr.length);
  combined.set(moduleHash, 0);
  combined.set(new TextEncoder().encode(senderStr), moduleHash.length);
  const finalHash = sha256(combined);

  // Step 4: Take first 20 bytes
  const addressBytes = finalHash.slice(0, 20);

  // Step 5: Encode as Bech32
  return toBech32(destPrefix, addressBytes);
}

const SenderPrefix = "ibc-flow-hook-intermediary";
export function getIntentoAddressForChannel({
  channel,
  originalSender,
  destPrefix,
}: {
  channel: string;
  originalSender: string;
  destPrefix: string; // Bech32 prefix for the address
}): string {
  const senderStr = `${channel}/${originalSender}`;

  // First hash: hash the SenderPrefix
  const senderPrefixHash = sha256(Buffer.from(SenderPrefix, "utf-8"));

  // Second hash: hash(senderPrefixHash || senderStr)
  const combined = Buffer.concat([
    senderPrefixHash,
    Buffer.from(senderStr, "utf-8"),
  ]);

  const finalHash = sha256(combined);

  // Use full 32 bytes (no slice)
  return toBech32(destPrefix, finalHash);
}
export const getCounterpartyChannelId = async ({
  chainID,
  channelId,
  portId,
  get,
}: {
  chainID: string;
  channelId: string;
  portId: string;
  get: Parameters<Parameters<typeof atomWithMutation>[0]>[0]; // to access atoms inside mutation
}) => {
  const skipClientConfig = get(skipClientConfigAtom);

  // Step 1: Resolve LCD endpoint
  const lcdURL =
    (await skipClientConfig.endpointOptions?.getRestEndpointForChain?.(
      chainID
    )) || getChainInfo({ chainId: chainID })?.rest;
  if (!lcdURL) throw new Error("Unable to resolve LCD URL for chain");

  // Step 2: Query IBC channel
  const endpoint = `${lcdURL}/ibc/core/channel/v1/channels/${channelId}/ports/${portId}`;
  const res = await fetch(endpoint);

  if (!res.ok) throw new Error(`IBC query failed: ${res.statusText}`);
  const data = await res.json();

  const counterpartyChannelId = data?.channel?.counterparty?.channel_id;
  if (!counterpartyChannelId)
    throw new Error("counterparty.channel_id not found");

  return counterpartyChannelId;
};

/**
 * Construct a WASM message for contract call in post_swap_action
 * @param wasmMsg The original WASM message object
 * @param streamId The stream ID from environment variables
 * @param contractAddress The contract address from environment variables
 * @returns The updated WASM message with contract call
 */
export function constructWasmMsgContractCallForStreamSwap(
  wasmMsg: any,
  streamId: string,
  contractAddress: string = import.meta.env.VITE_STREAMSWAP_CONTRACT_ADDRESS ||
    ""
): any {
  if (!contractAddress) {
    throw new Error("Contract address not found in environment variables");
  }

  if (!streamId) {
    throw new Error("Stream ID not provided");
  }

  // Create a deep copy of the original message
  const msg = JSON.parse(JSON.stringify(wasmMsg));
  console.log("msg", msg);
  // Update the post_swap_action to use contract call
  msg.swap_and_action.post_swap_action = {
    contract_call: {
      contract_address: contractAddress,
      msg: Buffer.from(
        JSON.stringify({
          subscribe: {
            stream_id: streamId,
          },
        })
      ).toString("base64"),
    },
  };

  console.log("msg", msg);
  return msg;
}

export type StreamMessagesResult = {
  chainID: string;
  signerAddress: string;
  messages: EncodeObject[];
  intoAddress: string;
};
