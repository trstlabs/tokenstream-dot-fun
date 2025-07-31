import { messages, RouteResponse, UserAddress } from "@skip-go/client";
import { hash } from "@stablelib/sha256";

import { IntentoStreamSettings } from "@/state/streamSettings";

import { atomWithMutation } from "jotai-tanstack-query";
import {
  StreamMessagesResult,
  getCounterpartyChannelId,
  getForwardAddress,
  constructWasmMsgSkipContract,
} from "./helpers";

import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { EncodeObject } from "@cosmjs/proto-signing";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { getChainInfo } from "@/constants/chains";
import { getChainChannelConfig } from "@/constants/intentoChains";

export async function createMessagesForPfmStream({
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
  console.log(userAddresses);
  const firstOp = route.operations[0];

  // TODO: add support for other operations

  if (!streamSettings.shouldStream || !("transfer" in firstOp)) return;
  // Type guard to ensure TypeScript knows firstOp has transfer property
  if (
    "transfer" in firstOp &&
    !getChainChannelConfig(firstOp.transfer?.toChainId || "")
  ) {
    return;
  }

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
  //!("cosmosTx" in routeMsgsFromDex.txs[0])
  let ibcDenomHash: string;
  let intentoChannelToDest = "";
  let channelDestToIntento = "";

  // Ensure TypeScript knows transfer exists
  if (!("transfer" in firstOp)) return;

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
      alert("Unsupported chain for tokenstream");
  }

  if (firstOp.transfer?.denomOut?.startsWith("ibc/")) {
    // Get the hash part
    const hashOnly = firstOp.transfer.denomOut.split("ibc/")[1];

    // Lookup denom trace from the LCD
    const denomTrace = await fetch(
      `${getChainInfo(firstOp.transfer?.toChainId || "")?.rest}/ibc/apps/transfer/v1/denom_traces/${hashOnly}`
    )
      .then((res) => res.json())
      .then((res) => res.denom_trace);
    console.log(denomTrace);
    if (!denomTrace) throw new Error("Invalid IBC denom");

    const fullPath = `transfer/${intentoChannelToDest}/${denomTrace.path}/${denomTrace.base_denom}`;
    console.log(fullPath);
    ibcDenomHash = Buffer.from(hash(new TextEncoder().encode(fullPath)))
      .toString("hex")
      .toUpperCase();
  } else {
    // single-hop fallback
    const fullPath = `transfer/${intentoChannelToDest}/${firstOp.transfer?.denomOut}`;

    ibcDenomHash = Buffer.from(hash(new TextEncoder().encode(fullPath)))
      .toString("hex")
      .toUpperCase();
  }
  console.log(ibcDenomHash);

  const counterpartyChannelId = await getCounterpartyChannelId({
    chainID: firstOp.transfer?.fromChainId || "",
    channelId: firstOp.transfer?.channel || "",
    portId: firstOp.transfer?.port || "",
    get,
  });
  console.log(counterpartyChannelId);

  const fwdAddress = getForwardAddress({
    destPrefix: "osmo",
    channel: counterpartyChannelId,
    originalSender: userAddresses[0].address,
  });

  const intoAddress = toBech32("into", fromBech32(fwdAddress).data);
  const recurrences = Math.floor(
    Number(streamSettings.duration) / Number(streamSettings.interval)
  );
  const streamAmount = Math.floor(Number(firstOp.amountOut) / recurrences);

  let memoObj: any;
  let receiverString = ""; // Initialize with empty string
  if (
    JSON.parse(originalRouteMsgs.txs?.[0].cosmosTx.msgs?.[0].msg || "")?.memo
  ) {
    const memoOG = JSON.parse(
      JSON.parse(originalRouteMsgs.txs?.[0].cosmosTx.msgs?.[0].msg || "")[
        "memo"
      ]
    );
    if (!memoOG.wasm.contract) throw new Error("skip wasm contract not found");
    const now = Math.floor(Date.now() / 1000);
    const streamStartSec =
      streamSettings.startAt === 0
        ? now + streamSettings.interval
        : now + streamSettings.startAt;
    const streamEndSec = streamStartSec + Number(streamSettings.duration);
    let wasmMsg = constructWasmMsgSkipContract(
      memoOG.wasm.msg,
      recurrences,
      streamEndSec,
      streamSettings.minAssetOutPercent,
      streamSettings.streamMode
    );
    memoObj = memoOG;
    memoObj.wasm.msg = wasmMsg;
    receiverString = memoOG.wasm.contract;
  } else {
    receiverString = JSON.parse(
      originalRouteMsgs.txs?.[0].cosmosTx.msgs?.[0].msg || ""
    )["receiver"];
  }
  const flowMsgIntento = {
    "@type": "/ibc.applications.transfer.v1.MsgTransfer",
    source_channel: intentoChannelToDest,
    source_port: "transfer",
    sender: intoAddress,
    token: { amount: String(streamAmount), denom: "ibc/" + ibcDenomHash },
    receiver: receiverString,
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
    memo: JSON.stringify(memoObj),
  };
  console.log(flowMsgIntento);
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
          updating_disabled: "true",
          label: "test",
          owner: intoAddress,
          fallback: "true",
        },
      },
    },
  };
  console.log(memoSourceChain);

  const msgTransfer = MsgTransfer.fromPartial({
    sourceChannel: firstOp.transfer?.channel,
    sourcePort: firstOp.transfer?.port,
    sender: userAddresses.map((user) => user.address)[0],
    token: {
      amount:
        streamSettings.streamMode === "SPLIT_INPUT"
          ? route.amountIn
          : (Number(route.amountIn) * recurrences).toString(),
      denom: route.sourceAssetDenom,
    },
    receiver: userAddresses.map((user) => user.address)[1],
    memo: JSON.stringify(memoSourceChain),
    timeoutTimestamp:
      BigInt(Math.floor(Date.now() / 1000) + 10 * 60) * 1_000_000_000n, // 10 minutes
    timeoutHeight: {
      revisionNumber: 0n,
      revisionHeight: 0n,
    },
  });
  console.log("msgTransfer", msgTransfer);
  const msgTransferEncodeObject: EncodeObject = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: msgTransfer,
  };

  return {
    chainID: route.sourceAssetChainId,
    signerAddress: Object.values(userAddresses)[0].address,
    messages: [msgTransferEncodeObject],
    intoAddress,
  };
}
