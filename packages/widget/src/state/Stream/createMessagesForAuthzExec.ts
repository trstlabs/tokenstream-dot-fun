import { messages, RouteResponse, UserAddress } from "@skip-go/client";
import {
  expectedStreamFeesAtom,
  IBC_TIMEOUT_SECONDS,
  IntentoStreamSettings,
} from "@/state/streamSettings";
import {
  StreamMessagesResult,
  constructWasmMsgContractCallForStreamSwap,
  constructWasmMsgSkipContract,
  updateTimestampsInMemo,
} from "./helpers";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { EncodeObject } from "@cosmjs/proto-signing";
import {
  intentoTrustlessAgentSupportedChains,
  getChainChannelConfig,
} from "@/constants/intentoChains";
import { atomWithMutation } from "jotai-tanstack-query";
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";
import { fromBech32, toBech32 } from "@cosmjs/encoding";

const GRANT_EXPIRATION_BUFFER_SECONDS = 600; // 10 min buffer

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
  return intentoTrustlessAgentSupportedChains.includes(chainId);
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
  const recurrences = Math.floor(
    Number(streamSettings.duration) / Number(streamSettings.interval)
  );
  // 2. DCA/SPLIT_INPUT logic
  let streamAmount: string;
  if (streamSettings.streamMode === "SPLIT_INPUT") {
    streamAmount = Math.floor(Number(amountIn) / recurrences).toString();
  } else {
    streamAmount = amountIn;
  }
  cosmosTx.msgs.forEach((msg) => {
    if (msg.msg) {
      let cosmosMsgObject = JSON.parse(msg.msg);
      console.log("cosmosMsgObject", cosmosMsgObject);

      const now = Math.floor(Date.now() / 1000);
      const streamStartSec =
        streamSettings.startAt === 0
          ? now + streamSettings.interval
          : now + streamSettings.startAt;
      const streamEndSec = streamStartSec + Number(streamSettings.duration);

      // Wasm Message
      if (cosmosMsgObject.msg) {
        console.log("Wasm msg");

        // if (cosmosMsgObject.timeout_timestamp) {
        //   cosmosMsgObject.timeoutTimestamp =
        //     BigInt(streamEndSec) + 3600n * 1_000_000_000n;
        // }

        let wasmMsg = constructWasmMsgSkipContract(
          cosmosMsgObject.msg,
          recurrences,
          streamEndSec,
          streamSettings.minAssetOutPercent,
          streamSettings.streamMode
        );

        cosmosMsgObject.msg = wasmMsg;
        cosmosMsgObject.funds[0].amount = streamAmount;
        msg.msg = JSON.stringify(cosmosMsgObject);
      }
      if (cosmosMsgObject.timeout_timestamp) {
        // Convert stream end time to nanoseconds and add 1 hour buffer
        const timeoutNs = (streamEndSec + 3600) * 1_000_000_000; // Convert to nanoseconds and add 1 hour
        cosmosMsgObject.timeout_timestamp = timeoutNs.toString(); // Store as string to avoid BigInt serialization issues
        console.log(
          "cosmosMsgObject.timeout_timestamp",
          cosmosMsgObject.timeout_timestamp
        );
        try {
          // Parse the message content
          console.log("message", cosmosMsgObject);
          // Helper function to update wasm message in an object
          const updateWasmMessage = (obj: any) => {
            if (!obj) return false;
            console.log("obj", obj);
            // Handle forward.next.wasm.msg structure
            if (obj.forward?.next?.wasm?.msg) {
              obj.forward.next.wasm.msg = constructWasmMsgSkipContract(
                obj.forward.next.wasm.msg,
                recurrences,
                streamEndSec,
                streamSettings.minAssetOutPercent,
                streamSettings.streamMode
              );
              return true;
            }
            // Handle direct wasm.msg structure
            else if (obj.wasm?.msg) {
              obj.wasm.msg = constructWasmMsgSkipContract(
                obj.wasm.msg,
                recurrences,
                streamEndSec,
                streamSettings.minAssetOutPercent,
                streamSettings.streamMode
              );
              return true;
            }

            return false;
          };

          // Try to update wasm message in the main content or in memo
          let wasmUpdated = updateWasmMessage(cosmosMsgObject);
          console.log("wasmUpdated", wasmUpdated);
          // If not found in main content, try to parse memo
          if (!wasmUpdated && cosmosMsgObject.memo) {
            try {
              const memoObj = JSON.parse(cosmosMsgObject.memo);
              wasmUpdated = updateWasmMessage(memoObj);
              if (wasmUpdated) {
                cosmosMsgObject.memo = JSON.stringify(memoObj);
              }
            } catch (e) {
              console.warn("Failed to parse memo:", e);
            }
          }

          // Custom JSON stringifier that handles BigInt
          const stringifyWithBigInt = (obj: any): string => {
            return JSON.stringify(obj, (_, value) => {
              if (typeof value === "bigint") {
                return value.toString();
              }
              return value;
            });
          };

          // Update timestamps in the message
          const updatedMsg = updateTimestampsInMemo(
            stringifyWithBigInt(cosmosMsgObject),
            streamEndSec
          );

          // Update the message with the processed content
          msg.msg = updatedMsg;

          console.log("Updated message:", msg.msg);
        } catch (error) {
          console.warn("Error processing wasm message:", error);
        }
      }
    }
  });
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
    streamSettings.duration + streamSettings.startAt
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
    channelConfig.trustlessAgentICAAddress,
    expirationSeconds
  );

  // 5. Build MsgExec
  const msgExec = {
    grantee: channelConfig.trustlessAgentICAAddress,
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
      trustless_agent: channelConfig.trustlessAgentAddress,
      // Expected format: "{amount0}{denomination},...,{amountN}{denominationN}"
      fee_limit: `${channelConfig.trustlessAgentFee}${channelConfig.denomOnIntento}`,
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
