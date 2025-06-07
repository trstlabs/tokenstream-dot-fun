import { messages, RouteResponse, UserAddress } from "@skip-go/client";
import {
  expectedStreamFeesAtom,
  IntentoStreamSettings,
} from "@/state/streamSettings";
import { StreamMessagesResult } from "./converters";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { EncodeObject } from "@cosmjs/proto-signing";
import {
  intentoHostedAccountSupportedChains,
  getChainChannelConfig,
} from "@/constants/intentoChains";

import { atomWithMutation } from "jotai-tanstack-query";
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import { wasmMsgDivideSkipContractSwapAmount } from "./memoDivideSkipContractSwapAmount";

/**
 * Create messages for Osmosis AuthZ MsgExec flow
 * This wraps the CosmosMsg into AuthZ MsgExec and creates a transfer to Intento
 */
interface SwapSettings {
  slippage: number;
}

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
  swapSettings: SwapSettings;
  get: Parameters<Parameters<typeof atomWithMutation>[0]>[0]; // to access atoms inside mutation
}): Promise<StreamMessagesResult | undefined> {
  console.log("Creating messages for AuthZ MsgExec");

  if (!streamSettings.shouldStream) return;
  // Get the source chain and denom info
  const { sourceAssetChainId, amountIn } = route;
  // Check if source chain is in the supported chains list
  const isSupportedChain =
    intentoHostedAccountSupportedChains.includes(sourceAssetChainId);

  if (!isSupportedChain) {
    console.log(
      `Chain ${sourceAssetChainId} is not in the supported chains list for AuthZ MsgExec`
    );
    return;
  }

  // Generate the original route messages
  const messagesResponse = await messages({
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

  if (!messagesResponse?.txs?.length) {
    console.error("No transaction data found in messages response");
    return;
  }

  console.log("messagesResponse", messagesResponse);

  // Find the first cosmos transaction with messages
  const cosmosTx =
    "cosmosTx" in messagesResponse.txs[0]
      ? messagesResponse.txs[0].cosmosTx
      : undefined;
  if (!cosmosTx) {
    console.error("No valid Cosmos transaction found");
    return;
  }
  if (!cosmosTx.msgs || !cosmosTx.msgs.length) {
    console.error("No valid Cosmos transaction messages found");
    return;
  }

  // // Transform messages into proper EncodeObjects
  // const encodeObjects = cosmosTx.cosmosTx.msgs
  //   .map((msg) => {
  //     if (!msg.msgTypeUrl || !msg.msg) {
  //       console.warn("Skipping invalid message format:", msg);
  //       return null;
  //     }
  //     return {
  //       typeUrl: msg.msgTypeUrl,
  //       value: msg.msg,
  //     } as EncodeObject;
  //   })
  //   .filter((msg): msg is EncodeObject => msg !== null);

  // if (encodeObjects.length === 0) {
  //   console.error("No valid messages found after transformation");
  //   return;
  // }
  // const registry = new Registry(); // You should register all types used
  // registry.register("/cosmos.bank.v1beta1.MsgSend", MsgSend);
  // registry.register("/ibc.applications.transfer.v1.MsgTransfer", MsgTransfer);
  // registry.register("/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract);

  // const updatedEncodeObjects = encodeObjects.map((msg) => {
  //   const clonedValue = structuredClone(msg.value); // Avoid mutating original
  //   // Modify amount field based on structure and DCA mode
  //   if (clonedValue.amount?.amount !== undefined) {
  //     clonedValue.amount.amount = streamAmount;
  //   } else if (clonedValue.token?.amount !== undefined) {
  //     clonedValue.token.amount = streamAmount;
  //   } else if (Array.isArray(clonedValue.funds)) {
  //     clonedValue.funds = clonedValue.funds.map((coin: Coin) => ({
  //       ...coin,
  //       amount: streamAmount.toString(),
  //     }));
  //   }

  //   return {
  //     typeUrl: msg.typeUrl,
  //     value: clonedValue,
  //   };
  // });
  // console.log("updatedEncodeObjects", updatedEncodeObjects);

  // const msgs: Any[] = updatedEncodeObjects.map((msg) => {
  //   const encoded = registry.encode(msg); // Gives Uint8Array
  //   return {
  //     typeUrl: msg.typeUrl,
  //     value: encoded,
  //   };
  // });
  // Get the Intento address for the source chain
  const intoAddress = userAddresses.find(
    (addr) => addr.chainId === sourceAssetChainId
  )?.address;

  if (!intoAddress) {
    console.error("No Intento address found for the source chain");
    return;
  }

  // Get channel configuration for the source chain
  const channelConfig = getChainChannelConfig(sourceAssetChainId);
  if (!channelConfig) {
    console.error(
      `No channel configuration found for chain: ${sourceAssetChainId}`
    );
    return;
  }
  // Calculate stream amount based on stream mode
  let streamAmount: string;
  if (streamSettings.streamMode === "EQUAL_PARTS") {
    const recurrences = Math.floor(
      Number(streamSettings.duration) / Number(streamSettings.interval)
    );
    // For DCA mode, split the amount into equal parts
    streamAmount = Math.floor(Number(amountIn) / recurrences).toString();
    cosmosTx.msgs.map((msg) => {
      console.log(msg);
      const cosmosMsgObject = JSON.parse(msg.msg || "");
      if (cosmosMsgObject.msg) {
        const wasmMsg = wasmMsgDivideSkipContractSwapAmount(
          cosmosMsgObject.msg,
          recurrences
        );
        cosmosMsgObject.funds[0].amount = streamAmount;
        console.log("wasmMsg", wasmMsg);
        msg.msg = JSON.stringify(cosmosMsgObject);
      }
    });
  } else {
    // For FULL_AMOUNT mode, use the full amount for each stream
    streamAmount = amountIn;
  }

  console.log(`Streaming ${streamAmount} in ${streamSettings.streamMode} mode`);

  // Create the AuthZ MsgExec message with properly encoded messages
  const msgExec = {
    grantee: intoAddress,
    msgs: cosmosTx.msgs.map((msg) => ({
      typeUrl: msg.msgTypeUrl,
      value: msg.msg,
    })),
  };

  const now = Math.floor(Date.now() / 1000);
  const expiration: Timestamp = {
    seconds: BigInt(now + streamSettings.duration + 600), // 10 minutes after the end of the stream
    nanos: 0,
  };

  // Deduplicate typeUrls for grant
  const uniqueTypeUrls = [
    ...new Set(cosmosTx.msgs.map((msg) => msg.msgTypeUrl)),
  ];

  const msgGrants: EncodeObject[] = uniqueTypeUrls.map((typeUrl) => {
    const grant = {
      authorization: {
        typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
        value: GenericAuthorization.encode({ msg: typeUrl || "" }).finish(),
      },
      expiration,
    };

    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: MsgGrant.fromPartial({
        granter: userAddresses[0].address,
        grantee: channelConfig.hostedICAAddress,
        grant,
      }),
    };
  });
  console.log("msgGrants", msgGrants);

  // Create the MsgExec encode object
  const msgExecEncodeObject: EncodeObject = {
    typeUrl: "/cosmos.authz.v1beta1.MsgExec",
    value: msgExec,
  };
  const expectedStreamFees = get(expectedStreamFeesAtom);
  // Create the source chain memo with flow instructions
  const memoIntentoFlow = {
    flow: {
      msgs: [msgExecEncodeObject],
      duration: `${streamSettings.duration}s`,
      interval: `${streamSettings.interval}s`,
      start_at:
        streamSettings.startAt === 0
          ? "0"
          : Math.floor(Date.now() / 1000 + streamSettings.startAt).toString(),
      stop_on_fail: "true",
      label: "AuthZ DCA Flow",
      owner: intoAddress,
      fallback: "true",
      hosted_address: channelConfig.hostedAddress,
    },
  };
  console.log("memoIntentoFlow", memoIntentoFlow);
  // Create the MsgTransfer with the flow instructions
  const msgTransfer = MsgTransfer.fromPartial({
    sourceChannel: channelConfig.channelDestToIntento,
    sourcePort: "transfer", // Default transfer port
    sender: intoAddress,
    token: {
      amount: expectedStreamFees?.find(
        (fee) =>
          fee.denom === channelConfig.denomOnIntento ||
          fee.denom ===
            "ibc/4810C6E0DF162BD8BCEB9189DAFE25AF6B2A47323891BD3EB95365C0D2A889F6" //temporary fix
      )?.amount,
      denom: channelConfig.denom,
    },
    receiver: "Intento Flows",
    memo: JSON.stringify(memoIntentoFlow),
    timeoutTimestamp:
      BigInt(Math.floor(Date.now() / 1000) + 600) * 1_000_000_000n, // 10 minutes
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
  console.log("msgTransferEncodeObject", msgTransferEncodeObject);
  console.log("msgGrants", msgGrants);
  // Return the result
  return {
    chainID: route.sourceAssetChainId,
    signerAddress: userAddresses[0].address,
    messages: [], //[...msgGrants, msgTransferEncodeObject],
    intoAddress,
  };
}
