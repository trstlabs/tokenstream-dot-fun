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
  streamEndSec: number,
  minAssetOutPercent: number,
  streamMode: "SPLIT_INPUT" | "RECUR_INPUT"
): any {
  // Defensive copy (if needed)
  // const msg = JSON.parse(JSON.stringify(wasmMsg));
  const msg = wasmMsg;

  // Set a fixed buffer after stream ends (1 hour)
  const bufferAfterStreamEnd = 3600; // 1 hour

  // Calculate the absolute timeout as stream end time + buffer
  const absoluteTimeout = streamEndSec + bufferAfterStreamEnd;

  // Set the timeout timestamp in nanoseconds
  const timeoutNs = BigInt(absoluteTimeout) * 1_000_000_000n;
  msg.swap_and_action.timeout_timestamp = timeoutNs.toString();

  // Handle memo in post_swap_action if it exists
  if (msg.swap_and_action?.post_swap_action?.ibc_transfer?.ibc_info?.memo) {
    try {
      const memo = JSON.parse(
        msg.swap_and_action.post_swap_action.ibc_transfer.ibc_info.memo
      );

      // Update timeouts in memo
      const updateMemoTimeouts = (obj: any) => {
        if (!obj || typeof obj !== "object") return;

        // Update timeout fields
        if ("timeout" in obj) {
          obj.timeout = timeoutNs.toString();
        }
        if ("timeout_timestamp" in obj) {
          obj.timeout_timestamp = timeoutNs.toString();
        }

        // Recursively process nested objects
        Object.values(obj).forEach((val) => {
          if (typeof val === "object" && val !== null) {
            updateMemoTimeouts(val);
          }
        });
      };

      updateMemoTimeouts(memo);

      // Update the memo with the modified object
      msg.swap_and_action.post_swap_action.ibc_transfer.ibc_info.memo =
        JSON.stringify(memo);
    } catch (e) {
      console.warn("Failed to parse memo:", e);
    }
  }

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
    minAssetOut = 1; // minimum amount for min_asset.native.amount
  } else {
    minAssetOut = Math.floor(dividedAmount * (1 + minAssetOutPercent / 100));
  }
  msg.swap_and_action.min_asset.native.amount = String(minAssetOut);

  if (minAssetOut < 1) {
    throw new Error("min_asset.native.amount calculated as less than 1");
  }

  return msg;
}

// Constants (this would need to be the equivalent of `types.ModuleName` in Go)
/**
 * Updates all timestamp fields in a memo string to the specified timestamp
 * @param memo The memo string to update (stringified JSON)
 * @param timestamp The timestamp in seconds to set
 * @returns The updated memo string
 */
export function updateTimestampsInMemo(
  memo: string,
  timestamp: number
): string {
  try {
    const memoObj = JSON.parse(memo);
    const timeoutNs = BigInt(timestamp) * 1_000_000_000n;

    // Recursively update all timestamp fields in the object
    const updateTimeouts = (obj: any) => {
      if (!obj || typeof obj !== "object") return;

      // Update all known timestamp fields
      const timestampFields = ["timeout", "timeout_timestamp", "timestamp"];
      timestampFields.forEach((field) => {
        if (field in obj) {
          obj[field] = timeoutNs.toString();
        }
      });

      // Special handling for forward object's timeout
      if (obj.forward?.timeout) {
        obj.forward.timeout = timeoutNs.toString();
      }

      // Recursively process nested objects
      Object.values(obj).forEach((val) => {
        if (typeof val === "object" && val !== null) {
          updateTimeouts(val);
        }
      });
    };

    updateTimeouts(memoObj);

    // Handle stringified JSON in memo fields
    const processStringifiedJson = (obj: any) => {
      if (!obj || typeof obj !== "object") return;

      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === "object" && parsed !== null) {
              updateTimeouts(parsed);
              obj[key] = JSON.stringify(parsed);
            }
          } catch (e) {
            // Not a JSON string, continue
          }
        } else if (typeof value === "object" && value !== null) {
          processStringifiedJson(value);
        }
      });
    };

    processStringifiedJson(memoObj);

    return JSON.stringify(memoObj);
  } catch (e) {
    console.warn("Failed to update timestamps in memo:", e);
    return memo; // Return original memo if parsing fails
  }
}

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
