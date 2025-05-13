import {
  cosmosMsgFromJSON,
  RouteResponse,
  SkipClient,
  UserAddress,
} from "@skip-go/client";
import { hash } from "@stablelib/sha256";
import { memoDivideSkipContractSwapAmount } from "./memoDivideSkipContractSwapAmount";
import { IntentoStreamSettings } from "@/state/streamSettings";

import { atomWithMutation } from "jotai-tanstack-query";
import {
  StreamMessagesResult,
  getCounterpartyChannelId,
  getForwardAddress,
  getIntentoAddressForChannel,
} from "./converters";

export async function createMessagesForPfmStream({
  skip,
  route,
  userAddresses,
  streamSettings,
  swapSettings,
  get,
}: {
  skip: SkipClient;
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
  if (firstOp.transfer.toChainID != route.swapVenues?.[0].chainID) {
    return;
  }

  const originalRouteMsgs = await skip.messages({
    sourceAssetDenom: route.sourceAssetDenom,
    sourceAssetChainID: route.sourceAssetChainID,
    destAssetDenom: route.destAssetDenom,
    destAssetChainID: route.destAssetChainID,
    amountIn: route.amountIn,
    amountOut: route.amountOut,
    addressList: userAddresses.map((user) => user.address),
    operations: route.operations,
    estimatedAmountOut: route.estimatedAmountOut,
    slippageTolerancePercent: swapSettings.slippage.toString(),
  });

  if (!("cosmosTx" in originalRouteMsgs.txs[0])) return;
  //!("cosmosTx" in routeMsgsFromDex.txs[0])
  let ibcDenomHash = null;
  let intentoChannelToDest = "";
  let channelDestToIntento = "";

  switch (firstOp.transfer.toChainID) {
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
        `transfer/${intentoChannelToDest}/${firstOp.transfer.denomOut}`
      )
    )
  )
    .toString("hex")
    .toUpperCase();

  const counterpartyChannelId = await getCounterpartyChannelId({
    chainID: firstOp.transfer.fromChainID,
    channelId: firstOp.transfer.channel,
    portId: firstOp.transfer.port,
    get,
  });
  console.log(counterpartyChannelId);

  const fwdAddress = getForwardAddress({
    destPrefix: "osmo",
    channel: counterpartyChannelId,
    originalSender: userAddresses[0].address,
  });

  const intoAddress = getIntentoAddressForChannel({
    destPrefix: "into",
    channel: intentoChannelToDest,
    originalSender: fwdAddress,
  });

  // const intoAddress = toBech32(
  //   "into",
  //   fromBech32(userAddresses[0].address).data
  // );

  const recurrences = Math.floor(
    Number(streamSettings.duration) / Number(streamSettings.interval)
  );
  const streamAmount = Math.floor(Number(firstOp.amountOut) / recurrences);

  const memoOG = JSON.parse(
    JSON.parse(originalRouteMsgs.txs[0].cosmosTx.msgs[0].msg)["memo"]
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

  // });
  const msgTransfer = {
    source_channel: firstOp.transfer.channel,
    source_port: firstOp.transfer.port,
    sender: userAddresses.map((user) => user.address)[0],
    token: { amount: route.amountIn, denom: route.sourceAssetDenom },
    receiver: "pfm",
    memo: JSON.stringify(memoSourceChain),
    timeout_timestamp: (
      BigInt(Math.floor(Date.now() / 1000) + 10 * 60) * 1_000_000_000n
    ).toString(), // 10 minutes
    timeout_height: {
      revision_number: "0",
      revision_height: "0",
    },
  };
  console.log(msgTransfer);
  const msgJSON = cosmosMsgFromJSON({
    msg: JSON.stringify(msgTransfer),
    msg_type_url: "/ibc.applications.transfer.v1.MsgTransfer",
  });

  return {
    chainID: route.sourceAssetChainID,
    signerAddress: Object.values(userAddresses)[0].address,
    messages: [msgJSON],
    intoAddress,
  };
}
