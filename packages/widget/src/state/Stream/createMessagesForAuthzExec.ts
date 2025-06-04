import { messages, RouteResponse, UserAddress } from "@skip-go/client";
import { hash } from "@stablelib/sha256";
import { memoDivideSkipContractSwapAmount } from "./memoDivideSkipContractSwapAmount";
import { IntentoStreamSettings } from "@/state/streamSettings";

import { atomWithMutation } from "jotai-tanstack-query";
import {
  StreamMessagesResult,
  getCounterpartyChannelId,
  getForwardAddress,
} from "./converters";

import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { EncodeObject } from "@cosmjs/proto-signing";
import { fromBech32, toBech32 } from "@cosmjs/encoding";

// Define the required types directly
interface MsgExec {
  grantee: string;
  msgs: Any[];
}

interface Any {
  typeUrl: string;
  value: Uint8Array;
}

/**
 * Create messages for Osmosis AuthZ MsgExec flow
 * This wraps the CosmosMsg into AuthZ MsgExec and creates a transfer to Intento
 */
export async function createMessagesForAuthzExec({
  route,
  userAddresses,
  streamSettings,
  swapSettings,
  get,
}: {
  route: RouteResponse;
  userAddresses: UserAddress[];
  streamSettings: IntentoStreamSettings;
  swapSettings: {
    slippage: number;
  };
  get: Parameters<Parameters<typeof atomWithMutation>[0]>[0]; // to access atoms inside mutation
}): Promise<StreamMessagesResult | undefined> {
  console.log("Creating messages for AuthZ MsgExec for Osmosis");
  
  const firstOp = route.operations[0];

  if (!streamSettings.shouldStream || !("transfer" in firstOp)) return;
  
  // Type guard to ensure TypeScript knows firstOp has transfer property
  if (
    "transfer" in firstOp &&
    firstOp.transfer?.toChainId != route.swapVenues?.[0].chainId
  ) {
    return;
  }

  // Check if the chain is Osmosis
  const isOsmosisChain = 
    firstOp.transfer?.toChainId === "osmosis-1" || 
    firstOp.transfer?.toChainId === "osmo-test-5";
  
  if (!isOsmosisChain) {
    return;
  }

  // Generate the original route messages
  const originalRouteMsgs = await messages({
    sourceAssetDenom: route.sourceAssetDenom,
    sourceAssetChainId: route.sourceAssetChainId,
    destAssetDenom: route.destAssetDenom,
    destAssetChainId: route.destAssetChainId,
    amountIn: route.amountIn,
    amountOut: route.amountOut,
    addressList: userAddresses.map((user) => user.address),
    operations: route.operations,
    estimatedAmountOut: route.estimatedAmountOut,
    slippageTolerancePercent: swapSettings.slippage.toString(),
  });

  if (
    !originalRouteMsgs ||
    !originalRouteMsgs.txs ||
    !("cosmosTx" in originalRouteMsgs.txs[0])
  )
    return;

  let ibcDenomHash = null;
  let intentoChannelToDest = "";
  let channelDestToIntento = "";

  // Ensure TypeScript knows transfer exists
  if (!("transfer" in firstOp)) return;

  // Set channels based on destination chain
  switch (firstOp.transfer?.toChainId) {
    case "osmosis-1":
      intentoChannelToDest = import.meta.env.VITE_CHANNEL_ID_INTO_OSMO;
      channelDestToIntento = import.meta.env.VITE_CHANNEL_ID_OSMO_INTO;
      break;
    case "osmo-test-5":
      intentoChannelToDest = import.meta.env.VITE_CHANNEL_ID_INTO_OSMO;
      channelDestToIntento = import.meta.env.VITE_CHANNEL_ID_OSMO_INTO;
      break;
    default:
      console.error("Unsupported chain for AuthZ MsgExec");
      return;
  }

  // Calculate the IBC denom hash
  ibcDenomHash = Buffer.from(
    hash(
      new TextEncoder().encode(
        `transfer/${intentoChannelToDest}/${firstOp.transfer?.denomOut}`
      )
    )
  )
    .toString("hex")
    .toUpperCase();

  // Get the counterparty channel ID
  const counterpartyChannelId = await getCounterpartyChannelId({
    chainID: firstOp.transfer?.fromChainId || "",
    channelId: firstOp.transfer?.channel || "",
    portId: firstOp.transfer?.port || "",
    get,
  });
  
  // Get the forward address
  const fwdAddress = getForwardAddress({
    destPrefix: "osmo",
    channel: counterpartyChannelId,
    originalSender: userAddresses[0].address,
  });

  // Convert to Intento address
  const intoAddress = toBech32("into", fromBech32(fwdAddress).data);
  
  // Calculate recurrences and stream amount
  const recurrences = Math.floor(
    Number(streamSettings.duration) / Number(streamSettings.interval)
  );
  const streamAmount = Math.floor(Number(firstOp.amountOut) / recurrences);

  // Parse the original memo
  const memoOG = JSON.parse(
    JSON.parse(originalRouteMsgs.txs?.[0].cosmosTx.msgs?.[0].msg || "")["memo"]
  );
  if (!memoOG.wasm.contract) throw new Error("skip wasm contract not found");
  
  // Divide skip contract swap amount
  const memoSkipContract = memoDivideSkipContractSwapAmount(
    memoOG,
    recurrences
  );

  // Create the flow message for Intento
  const flowMsgIntento = {
    "@type": "/ibc.applications.transfer.v1.MsgTransfer",
    source_channel: intentoChannelToDest,
    source_port: "transfer",
    sender: intoAddress,
    token: { amount: String(streamAmount), denom: "ibc/" + ibcDenomHash },
    receiver: memoOG.wasm.contract,
    timeout_height: { revision_number: "0", revision_height: "0" },
    timeout_timestamp:
      streamSettings.startAt == 0
        ? (
            BigInt(
              Math.floor(Date.now() / 1000) + 600 + streamSettings.duration
            ) * 1_000_000_000n
          ).toString()
        : (
            BigInt(
              Math.floor(Date.now() / 1000) +
                600 +
                streamSettings.duration +
                streamSettings.startAt
            ) * 1_000_000_000n
          ).toString(), // 10 minutes
    memo: JSON.stringify(memoSkipContract),
  };
  
  // Create the source chain memo with flow instructions
  const memoSourceChain = {
    forward: {
      receiver: intoAddress,
      port: "transfer",
      channel: channelDestToIntento,
      timeout: "10m",
      retries: 2,
      next: {
        flow: {
          msgs: [flowMsgIntento],
          duration: streamSettings.duration + "s",
          interval: streamSettings.interval + "s",
          start_at:
            streamSettings.startAt == 0
              ? "0"
              : Math.floor(
                  Date.now() / 1000 + streamSettings.startAt
                ).toString(),
          stop_on_fail: "true",
          label: "test flow",
          owner: intoAddress,
          fallback: "true",
        },
      },
    },
  };

  // Create the MsgTransfer
  const msgTransfer = MsgTransfer.fromPartial({
    sourceChannel: firstOp.transfer?.channel,
    sourcePort: firstOp.transfer?.port,
    sender: userAddresses.map((user) => user.address)[0],
    token: { amount: route.amountIn, denom: route.sourceAssetDenom },
    receiver: "pfm",
    memo: JSON.stringify(memoSourceChain),
    timeoutTimestamp:
      BigInt(Math.floor(Date.now() / 1000) + 10 * 60) * 1_000_000_000n, // 10 minutes
    timeoutHeight: {
      revisionNumber: 0n,
      revisionHeight: 0n,
    },
  });

  // We don't need the msgTransferEncodeObject when using AuthZ MsgExec
  // Wrap the message in AuthZ MsgExec
  // Create an Any message for the MsgTransfer
  // Since we don't have access to MsgTransfer.encode, we'll use the msgTransfer directly
  const anyMsg: Any = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: new Uint8Array(Buffer.from(JSON.stringify(msgTransfer))),
  };

  // Create the AuthZ MsgExec message
  // The grantee should be the Intento address
  const msgExec: MsgExec = {
    grantee: intoAddress,
    msgs: [anyMsg],
  };

  // Create the MsgExec encode object
  const msgExecEncodeObject: EncodeObject = {
    typeUrl: "/cosmos.authz.v1beta1.MsgExec",
    value: msgExec,
  };

  // Return the result
  return {
    chainID: route.sourceAssetChainId,
    signerAddress: userAddresses[0].address,
    messages: [msgExecEncodeObject],
    intoAddress,
  };
}
