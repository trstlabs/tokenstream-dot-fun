import { toBech32 } from "@cosmjs/encoding";

import { skipClientConfigAtom } from "@/state/skipClient"; // adjust import path
import { getChainInfo } from "graz";
import { sha256 } from "@cosmjs/crypto";
import { atomWithMutation } from "jotai-tanstack-query";
import { CosmosMsg } from "@skip-go/client";

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

export type StreamMessagesResult = {
  chainID: string;
  signerAddress: string;
  messages: CosmosMsg[];
  intoAddress: string;
};
