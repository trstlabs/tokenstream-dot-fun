import { messages, RouteResponse, UserAddress } from "@skip-go/client";
import {
  expectedStreamFeesAtom,
  IntentoStreamSettings,
} from "@/state/streamSettings";
import {
  StreamMessagesResult,
  constructWasmMsgContractCallForStreamSwap,
  constructWasmMsgSkipContract,
} from "./helpers";
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
import { fromBech32, toBech32 } from "@cosmjs/encoding";

const GRANT_EXPIRATION_BUFFER_SECONDS = 600; // 10 min buffer
const IBC_TIMEOUT_SECONDS = 60; // 1 min timeout for IBC

interface SwapSettings {
  slippage: number;
}

export interface ExistingGrant {
  granter: string;
  grantee: string;
  msgTypeUrl: string;
  expiration: Date | null;
}
function isSupportedChain(chainId: string): boolean {
  return intentoHostedAccountSupportedChains.includes(chainId);
}

function calculateGrantExpiration(
  existing: ExistingGrant | null | undefined,
  duration: number
): {
  needsNewGrant: boolean;
  expirationSeconds: bigint;
} {
  const now = Math.floor(Date.now() / 1000);
  const streamEnd = now + Number(duration);
  const requiredExpiration = streamEnd + GRANT_EXPIRATION_BUFFER_SECONDS;
  if (existing?.expiration) {
    const existingSec = Math.floor(existing.expiration.getTime() / 1000);
    if (existingSec > now && existingSec >= requiredExpiration) {
      return { needsNewGrant: false, expirationSeconds: BigInt(existingSec) };
    }
  }
  return { needsNewGrant: true, expirationSeconds: BigInt(requiredExpiration) };
}

function buildMsgGrants(
  needsNewGrant: boolean,
  cosmosMsgs: { msgTypeUrl: string }[],
  granter: string,
  grantee: string,
  expirationSeconds: bigint
): EncodeObject[] {
  if (!needsNewGrant) return [];
  const expiration: Timestamp = { seconds: expirationSeconds, nanos: 0 };
  const uniqueTypeUrls = [...new Set(cosmosMsgs.map((msg) => msg.msgTypeUrl))];
  return uniqueTypeUrls.map((typeUrl) => ({
    typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
    value: MsgGrant.fromPartial({
      granter,
      grantee,
      grant: {
        authorization: {
          typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
          value: GenericAuthorization.encode(
            GenericAuthorization.fromPartial({
              msg: typeUrl,
            })
          ).finish(),
        },
        expiration,
      },
    }),
  }));
}

export async function createMessagesForAuthzExec({
  route,
  userAddresses,
  streamSettings,
  swapSettings,
  get,
  existingGrant,
}: {
  route: RouteResponse;
  userAddresses: UserAddress[];
  streamSettings: IntentoStreamSettings;
  swapSettings: SwapSettings;
  get: Parameters<Parameters<typeof atomWithMutation>[0]>[0];
  existingGrant?: ExistingGrant | null;
}): Promise<StreamMessagesResult | undefined> {
  if (!streamSettings.shouldStream) return;

  const { sourceAssetChainId, amountIn } = route;
  if (!isSupportedChain(sourceAssetChainId)) {
    console.warn(
      `Chain ${sourceAssetChainId} is not supported for AuthZ MsgExec`
    );
    return;
  }

  const intoAddress = toBech32(
    "into", // Intento's bech32 prefix
    fromBech32(userAddresses[0].address).data
  );

  const channelConfig = getChainChannelConfig(sourceAssetChainId);
  if (!channelConfig) {
    console.error(
      `No channel configuration found for chain: ${sourceAssetChainId}`
    );
    return;
  }

  // 1. Build route messages
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

  const cosmosTx =
    "cosmosTx" in messagesResponse.txs[0]
      ? messagesResponse.txs[0].cosmosTx
      : undefined;
  if (!cosmosTx || !cosmosTx.msgs?.length) {
    console.error("No valid Cosmos transaction messages found");
    return;
  }

  // 2. DCA/SPLIT_INPUT logic
  let streamAmount: string;
  if (streamSettings.streamMode === "SPLIT_INPUT") {
    const recurrences = Math.floor(
      Number(streamSettings.duration) / Number(streamSettings.interval)
    );
    streamAmount = Math.floor(Number(amountIn) / recurrences).toString();
    cosmosTx.msgs.forEach((msg) => {
      if (msg.msg) {
        let cosmosMsgObject = JSON.parse(msg.msg);
        if (cosmosMsgObject.msg) {
          const now = Math.floor(Date.now() / 1000);
          const streamStartSec = streamSettings.startAt === 0 ? now : now + streamSettings.startAt;
          const streamEndSec = streamStartSec + Number(streamSettings.duration);
          let wasmMsg = constructWasmMsgSkipContract(
            cosmosMsgObject.msg,
            recurrences,
            streamStartSec,
            streamEndSec,
            streamSettings.minAssetOutPercent,
            streamSettings.streamMode
          );

          cosmosMsgObject.msg = wasmMsg;
          cosmosMsgObject.funds[0].amount = streamAmount;
          msg.msg = JSON.stringify(cosmosMsgObject);
        }
      }
    });
  } else {
    streamAmount = amountIn;
  }

  if (streamSettings.streamIntoStreamSwapID != undefined) {
    cosmosTx.msgs.forEach((msg) => {
      if (msg.msg) {
        let cosmosMsgObject = JSON.parse(msg.msg);
        if (cosmosMsgObject.msg) {
          let wasmMsg = constructWasmMsgContractCallForStreamSwap(
            cosmosMsgObject.msg,
            streamSettings.streamIntoStreamSwapID || "",
            import.meta.env.VITE_STREAMSWAP_CONTRACT_ADDRESS || ""
          );

          cosmosMsgObject.msg = wasmMsg;
          cosmosMsgObject.funds[0].amount = streamAmount;
          msg.msg = JSON.stringify(cosmosMsgObject);
        }
      }
    });
  }

  // 3. Grant expiration logic
  const { needsNewGrant, expirationSeconds } = calculateGrantExpiration(
    existingGrant,
    streamSettings.duration
  );
  console.log("existingGrant", existingGrant);
  console.log("needsNewGrant", needsNewGrant);
  console.log("expirationSeconds", expirationSeconds);

  // 4. Build grant messages
  const msgGrants = buildMsgGrants(
    needsNewGrant,
    cosmosTx.msgs.filter(
      (msg): msg is { msgTypeUrl: string } => typeof msg.msgTypeUrl === "string"
    ),
    userAddresses[0].address,
    channelConfig.hostedICAAddress,
    expirationSeconds
  );

  // 5. Build MsgExec
  const msgExec = {
    grantee: channelConfig.hostedICAAddress,
    msgs: cosmosTx.msgs.map((msg) => ({
      "@type": msg.msgTypeUrl,
      ...JSON.parse(msg.msg || ""),
    })),
  };
  console.log(msgExec);
  // 6. Build MsgTransfer for flow
  const expectedStreamFees = get(expectedStreamFeesAtom);

  const memoIntentoFlow = {
    flow: {
      msgs: [
        {
          "@type": "/cosmos.authz.v1beta1.MsgExec",
          ...msgExec,
        },
      ],
      duration: `${streamSettings.duration}s`,
      interval: `${streamSettings.interval}s`,
      start_at:
        streamSettings.startAt === 0
          ? "0"
          : Math.floor(Date.now() / 1000 + streamSettings.startAt).toString(),
      stop_on_fail: "true",
      label: "tokenstream.fun",
      owner: intoAddress,
      fallback: "true",
      hosted_account: channelConfig.hostedAddress,
      hosted_fee_limit:
        channelConfig.hostedAccountFee + channelConfig.denomOnIntento, // host denom
    },
  };

  const msgTransfer = MsgTransfer.fromPartial({
    sourceChannel: channelConfig.channelDestToIntento,
    sourcePort: "transfer",
    sender: userAddresses[0].address,
    token: {
      amount: expectedStreamFees?.find(
        (fee) =>
          fee.denom === channelConfig.denomOnIntento || fee.denom === "uinto"
      )?.amount,
      denom: channelConfig.denom,
    },
    receiver: "Your Intento Address",
    memo: JSON.stringify(memoIntentoFlow),
    timeoutTimestamp:
      BigInt(Math.floor(Date.now() / 1000) + IBC_TIMEOUT_SECONDS) *
      1_000_000_000n,
    timeoutHeight: {
      revisionNumber: 0n,
      revisionHeight: 0n,
    },
  });

  const msgTransferEncodeObject: EncodeObject = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: msgTransfer,
  };

  // 7. Return result
  return {
    chainID: route.sourceAssetChainId,
    signerAddress: userAddresses[0].address,
    messages: [...msgGrants, msgTransferEncodeObject],
    intoAddress,
  };
}
