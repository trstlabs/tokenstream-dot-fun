import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import {
  cosmosMsgFromJSON,
  RouteResponse,
  SkipClient,
  UserAddress,
} from "@skip-go/client";
import { hash } from "@stablelib/sha256";
import { memoDivideAmount } from "./MemoInput";
import { IntentoStreamSettings } from "@/state/streamSettings";

export async function createStreamingSwap({
  skip,
  route,
  userAddresses,
  streamSettings,
  swapSettings,
}: {
  skip: SkipClient;
  route: RouteResponse;
  userAddresses: UserAddress[];
  streamSettings: IntentoStreamSettings;
  swapSettings: {
    slippage: number;
  };
}) {
  const firstOp = route.operations[0];
  if (!streamSettings.shouldStream || !("transfer" in firstOp)) return;

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

  console.log(originalRouteMsgs);
  const routeMsgsFromDex = await skip.messages({
    sourceAssetDenom: firstOp.transfer.denomOut,
    sourceAssetChainID: firstOp.transfer.toChainID,
    destAssetDenom: route.destAssetDenom,
    destAssetChainID: route.destAssetChainID,
    amountIn: firstOp.amountIn,
    amountOut: firstOp.amountOut,
    addressList: userAddresses.map((user) => user.address).slice(1),
    operations: route.operations.slice(1),
    estimatedAmountOut: route.estimatedAmountOut,
    slippageTolerancePercent: swapSettings.slippage.toString(),
    // affiliates?: route.affiliates,
    //clientID: Object.keys(userAddresses)[1],
  });

  if (
    !("cosmosTx" in originalRouteMsgs.txs[0]) ||
    !("cosmosTx" in routeMsgsFromDex.txs[0])
  )
    return;

  const ibcDenomHash = hash(
    new TextEncoder().encode(
      "transfer/" +
        process.env.NEXT_PUBLIC_CHANNEL_ID_OSMO_INTO +
        firstOp.transfer.denomOut
    )
  );

  const recurrences = Math.floor(
    Number(streamSettings.duration) / Number(streamSettings.interval)
  );
  const streamAmount = Math.floor(Number(firstOp.amountOut) / recurrences);

  const memoOG = JSON.parse(
    JSON.parse(originalRouteMsgs.txs[0].cosmosTx.msgs[0].msg)["memo"]
  );
  const memoIntentoFlow = memoDivideAmount(memoOG, recurrences);

  const flowMsgIntento = {
    "@type": "/ibc.applications.transfer.v1.MsgTransfer",
    value: {
      source_channel: process.env.NEXT_PUBLIC_CHANNEL_ID_INTO_OSMO || "",
      source_port: "transfer",
      sender: toBech32(
        "into",
        fromBech32(userAddresses.map((user) => user.address)[0]).data
      ),
      token: { amount: String(streamAmount), denom: "ibc/" + ibcDenomHash },
      receiver: "",
      timeout_height: { revision_number: "0", revision_height: "0" },
      timeout_timestamp: "0",
      memo: memoIntentoFlow,
    },
  };

  const memoSourceChain = {
    forward: {
      receiver: "intento-submit-flow",
      port: "transfer",
      channel: process.env.NEXT_PUBLIC_CHANNEL_ID_OSMO_INTO,
      timeout: "10m",
      retries: 2,
    },
    flow: {
      msgs: JSON.stringify(flowMsgIntento),
      duration: streamSettings.duration,
      interval: streamSettings.interval,
      start_at: streamSettings.startAt,
      stop_on_fail: true,
      owner: toBech32("into", fromBech32(Object.values(userAddresses)[0].address).data),
    },
  };

  const msgTransfer = MsgTransfer.fromPartial({
    sourceChannel: firstOp.transfer.channel,
    sourcePort: firstOp.transfer.port,
    sender: userAddresses.map((user) => user.address)[0],
    token: { amount: route.amountIn, denom: route.sourceAssetDenom },
    receiver: "pfm",
    memo: JSON.stringify(memoSourceChain),
  });

  const msgJSON = cosmosMsgFromJSON({
    msg: JSON.stringify(msgTransfer),
    msg_type_url: "/ibc.applications.transfer.v1.MsgTransfer",
  });

  // Validate gas
  // if (
  //   cosmosFeeUsed &&
  //   cosmosFeeUsed.denom !== route.sourceAssetDenom &&
  //   BigNumber(maxAmountTokenMinusFees).isGreaterThanOrEqualTo(
  //     BigNumber(route.amountIn)
  //   )
  // ) {
  //   alert("Insufficient balance for gas");
  //   return;
  // }

  return {
    chainID: route.sourceAssetChainID,
    signerAddress: Object.values(userAddresses)[0].address,
    messages: [msgJSON],
  };
}
