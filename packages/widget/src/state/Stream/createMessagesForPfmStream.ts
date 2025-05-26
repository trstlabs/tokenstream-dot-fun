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
    firstOp.transfer?.toChainId != route.swapVenues?.[0].chainId
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
  let ibcDenomHash = null;
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

  ibcDenomHash = Buffer.from(
    hash(
      new TextEncoder().encode(
        `transfer/${intentoChannelToDest}/${firstOp.transfer?.denomOut}`
      )
    )
  )
    .toString("hex")
    .toUpperCase();

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

  // const intoAddress = getIntentoAddressForChannel({
  //   destPrefix: "into",
  //   channel: intentoChannelToDest,
  //   originalSender: fwdAddress,
  // });

  // const intoAddress = toBech32(
  //   "into",
  //   fromBech32(userAddresses[0].address).data
  // );

  const intoAddress = toBech32("into", fromBech32(fwdAddress).data);
  const recurrences = Math.floor(
    Number(streamSettings.duration) / Number(streamSettings.interval)
  );
  const streamAmount = Math.floor(Number(firstOp.amountOut) / recurrences);

  const memoOG = JSON.parse(
    JSON.parse(originalRouteMsgs.txs?.[0].cosmosTx.msgs?.[0].msg || "")["memo"]
  );
  if (!memoOG.wasm.contract) throw new Error("skip wasm contract not found");
  const memoSkipContract = memoDivideSkipContractSwapAmount(
    memoOG,
    recurrences
  );

  const flowMsgIntento = {
    "@type": "/ibc.applications.transfer.v1.MsgTransfer",
    source_channel: intentoChannelToDest,
    source_port: "transfer",
    sender: intoAddress,
    token: { amount: String(streamAmount), denom: "ibc/" + ibcDenomHash },
    receiver: memoOG.wasm.contract, //Object.values(userAddresses)[1].address,
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
          label: "test flow",
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
