import { atomWithMutation } from "jotai-tanstack-query";
import {
  skipChainsAtom,
  skipClient,
  skipSwapVenuesAtom,
} from "@/state/skipClient";
import { routeConfigAtom, skipRouteAtom } from "@/state/route";
import { atom } from "jotai";
import {
  TransactionCallbacks,
  RouteResponse,
  TxStatusResponse,
  UserAddress,
  ChainType,
  ValidateGasResult,
  cosmosMsgFromJSON,
} from "@skip-go/client";
import {
  DEEPLINK_CHOICE,
  MinimalWallet,
  RECENT_WALLET_DATA,
  walletConnectDeepLinkByChainTypeAtom,
} from "./wallets";
import { atomEffect } from "jotai-effect";
import { setTransactionHistoryAtom, transactionHistoryAtom } from "./history";
import { SimpleStatus } from "@/utils/clientType";
import { errorAtom, ErrorType } from "./errorPage";
import { atomWithStorageNoCrossTabSync } from "@/utils/misc";
import { isUserRejectedRequestError } from "@/utils/error";
import {
  COSMOS_GAS_AMOUNT,
  EVM_GAS_AMOUNT,
  sourceAssetAtom,
  swapSettingsAtom,
} from "./swapPage";
import { createExplorerLink } from "@/utils/explorerLink";
import { callbacksAtom } from "./callbacks";
import { setUser, setTag } from "@sentry/react";
import { track } from "@amplitude/analytics-browser";
import { streamSettingsAtom } from "./streamSettings";
import { createMessagesForPfmStream } from "./Stream/createMessagesForPfmStream";
import { Coin } from "@cosmjs/amino";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { StreamMessagesResult } from "./Stream/converters";

type ValidatingGasBalanceData = {
  chainID?: string;
  txIndex?: number;
  status: "success" | "error" | "pending" | "completed";
};

type SwapExecutionState = {
  userAddresses: UserAddress[];
  route?: RouteResponse;
  transactionDetailsArray: TransactionDetails[];
  transactionHistoryIndex: number;
  overallStatus: SimpleStatus;
  isValidatingGasBalance?: ValidatingGasBalanceData;
  transactionsSigned: number;
};

export type ChainAddress = {
  chainID: string;
  chainType?: ChainType;
  address?: string;
} & {
  source?: "input" | "parent" | "injected" | "wallet";
  wallet?: Pick<
    MinimalWallet,
    "walletName" | "walletPrettyName" | "walletChainType" | "walletInfo"
  >;
};

/**
 * route.requiredChainAddresses is a list of chainIDs that are required to have an address associated with them
 * the key in this atom is the index of the chainID in the requiredChainAddresses array
 */
export const chainAddressesAtom = atom<Record<number, ChainAddress>>({});

export const swapExecutionStateAtom =
  atomWithStorageNoCrossTabSync<SwapExecutionState>("swapExecutionState", {
    route: undefined,
    userAddresses: [],
    transactionDetailsArray: [],
    transactionHistoryIndex: 0,
    overallStatus: "unconfirmed",
    isValidatingGasBalance: undefined,
    transactionsSigned: 0,
  });

export const setOverallStatusAtom = atom(
  null,
  (_get, set, status: SimpleStatus) => {
    set(swapExecutionStateAtom, (state) => ({
      ...state,
      overallStatus: status,
    }));
  }
);

export const setSwapExecutionStateAtom = atom(null, (get, set) => {
  const { data: route } = get(skipRouteAtom);
  const { data: chains } = get(skipChainsAtom);
  const transactionHistory = get(transactionHistoryAtom);
  const callbacks = get(callbacksAtom);
  const transactionHistoryIndex = transactionHistory.length;
  if (!route) return;

  const {
    requiredChainAddresses,
    sourceAssetDenom,
    sourceAssetChainID,
    destAssetDenom,
    destAssetChainID,
  } = route;

  const sourceAddress = requiredChainAddresses[0];
  const destinationAddress =
    requiredChainAddresses[requiredChainAddresses.length - 1];

  const initialChainAddresses: Record<number, ChainAddress> = {};

  route?.requiredChainAddresses?.forEach((chainID, index) => {
    initialChainAddresses[index] = {
      chainID,
      address: "",
    };
  });

  set(chainAddressesAtom, initialChainAddresses);

  set(swapExecutionStateAtom, {
    userAddresses: [],
    transactionDetailsArray: [],
    route,
    transactionHistoryIndex,
    overallStatus: "unconfirmed",
    isValidatingGasBalance: undefined,
    transactionsSigned: 0,
  });
  set(submitSwapExecutionCallbacksAtom, {
    onTransactionUpdated: (txInfo) => {
      track("execute route: transaction updated", { txInfo });
      if (txInfo.status?.status !== "STATE_COMPLETED") {
        set(setTransactionDetailsAtom, txInfo, transactionHistoryIndex);
      }
    },
    onApproveAllowance: async ({ status, allowance }) => {
      track("execute route: approve allowance", { status, allowance });
      if (allowance && status === "pending") {
        set(setOverallStatusAtom, "approving");
      }
    },
    onTransactionBroadcast: async (txInfo) => {
      track("execute route: transaction broadcasted", { txInfo });
      setUser({ id: txInfo?.txHash });
      const chain = chains?.find((chain) => chain.chainID === txInfo.chainID);
      const explorerLink = createExplorerLink({
        chainID: txInfo.chainID,
        chainType: chain?.chainType,
        txHash: txInfo.txHash,
      });
      set(
        setTransactionDetailsAtom,
        { ...txInfo, explorerLink, status: undefined },
        transactionHistoryIndex
      );
      callbacks?.onTransactionBroadcasted?.({
        chainId: txInfo.chainID,
        txHash: txInfo.txHash,
        explorerLink: explorerLink ?? "",
        sourceAddress,
        destinationAddress,
        sourceAssetDenom,
        sourceAssetChainID,
        destAssetDenom,
        destAssetChainID,
      });
    },
    onTransactionCompleted: async (chainId: string, txHash: string, status) => {
      track("execute route: transaction completed", {
        chainId,
        txHash,
        status,
      });
      setTag("txCompleted", true);
      const chain = chains?.find((chain) => chain.chainID === chainId);
      const explorerLink = createExplorerLink({
        chainID: chainId,
        chainType: chain?.chainType,
        txHash,
      });
      callbacks?.onTransactionComplete?.({
        chainId,
        txHash,
        explorerLink: explorerLink ?? "",
        sourceAddress,
        destinationAddress,
        sourceAssetDenom,
        sourceAssetChainID,
        destAssetDenom,
        destAssetChainID,
      });
    },
    onTransactionSigned: async () => {
      track("execute route: transaction signed");

      set(swapExecutionStateAtom, (prev) => ({
        ...prev,
        transactionsSigned: (prev.transactionsSigned ?? 0) + 1,
      }));

      set(setOverallStatusAtom, "pending");
    },
    onError: (error: unknown, transactionDetailsArray) => {
      const currentPage = get(currentPageAtom);
      track("execute route: error", { error, route });
      callbacks?.onTransactionFailed?.({
        error: (error as Error)?.message,
      });

      const lastTransaction =
        transactionDetailsArray?.[transactionDetailsArray?.length - 1];
      if (isUserRejectedRequestError(error)) {
        track("error page: user rejected request");
        if (currentPage === Routes.SwapExecutionPage) {
          set(errorAtom, {
            errorType: ErrorType.AuthFailed,
            onClickBack: () => {
              set(setOverallStatusAtom, "unconfirmed");
              set(clearIsValidatingGasBalanceAtom);
            },
          });
        }
      } else if (
        (error as Error)?.message
          ?.toLowerCase()
          .includes("insufficient balance for gas")
      ) {
        track("error page: insufficient balance for gas");
        set(errorAtom, {
          errorType: ErrorType.InsufficientBalanceForGas,
          error: error as Error,
          onClickBack: () => {
            set(setOverallStatusAtom, "unconfirmed");
          },
        });
      } else if (lastTransaction?.explorerLink) {
        track("error page: transaction failed", { lastTransaction });
        set(errorAtom, {
          errorType: ErrorType.TransactionFailed,
          onClickBack: () => {
            set(setOverallStatusAtom, "unconfirmed");
          },
          explorerLink: lastTransaction?.explorerLink ?? "",
          txHash: lastTransaction?.txHash ?? "",
          onClickContactSupport: () => {
            window.open("https://skip.build/discord", "_blank");
          },
        });
      } else {
        track("error page: unexpected error");
        set(errorAtom, {
          errorType: ErrorType.Unexpected,
          error: error as Error,
          onClickBack: () => {
            set(setOverallStatusAtom, "unconfirmed");
          },
        });
      }
    },
    onValidateGasBalance: async (props) => {
      track("execute route: validate gas balance", { props });
      set(setValidatingGasBalanceAtom, props);
    },
  });
});

export const setValidatingGasBalanceAtom = atom(
  null,
  (_get, set, isValidatingGasBalance: ValidatingGasBalanceData) => {
    set(swapExecutionStateAtom, (state) => ({
      ...state,
      isValidatingGasBalance,
    }));
  }
);

export const setTransactionDetailsAtom = atom(
  null,
  (
    get,
    set,
    transactionDetails: TransactionDetails,
    transactionHistoryIndex: number
  ) => {
    const swapExecutionState = get(swapExecutionStateAtom);
    const { transactionDetailsArray, route } = swapExecutionState;

    const newTransactionDetailsArray = transactionDetailsArray;

    const transactionIndexFound = newTransactionDetailsArray.findIndex(
      (transaction) =>
        transaction.txHash.toLowerCase() ===
        transactionDetails.txHash.toLowerCase()
    );
    if (transactionIndexFound !== -1) {
      newTransactionDetailsArray[transactionIndexFound] = {
        ...newTransactionDetailsArray[transactionIndexFound],
        ...transactionDetails,
      };
    } else {
      newTransactionDetailsArray.push(transactionDetails);
    }
    set(swapExecutionStateAtom, {
      ...swapExecutionState,
      transactionDetailsArray: newTransactionDetailsArray,
    });

    set(setTransactionHistoryAtom, transactionHistoryIndex, {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      route: route!,
      transactionDetails: newTransactionDetailsArray,
      timestamp: Date.now(),
      status: "unconfirmed",
    });
  }
);

export const chainAddressEffectAtom = atomEffect((get, set) => {
  const chainAddresses = get(chainAddressesAtom);
  const addressesMatch = Object.values(chainAddresses).every(
    (chainAddress) => !!chainAddress.address
  );
  if (!addressesMatch) return;

  const userAddresses = Object.values(chainAddresses).map((chainAddress) => {
    return {
      chainID: chainAddress.chainID,
      address: chainAddress.address as string,
    };
  });

  set(swapExecutionStateAtom, (prev) => ({
    ...prev,
    userAddresses,
  }));
});

export type TransactionDetails = {
  txHash: string;
  chainID: string;
  explorerLink?: string;
  status?: TxStatusResponse;
};

type SubmitSwapExecutionCallbacks = TransactionCallbacks & {
  onTransactionUpdated?: (transactionDetails: TransactionDetails) => void;
  onError: (
    error: unknown,
    transactionDetailsArray?: TransactionDetails[]
  ) => void;
};

export const submitSwapExecutionCallbacksAtom = atom<
  SubmitSwapExecutionCallbacks | undefined
>();

export const fallbackGasAmountFnAtom = atom((get) => {
  const swapVenues = get(skipSwapVenuesAtom)?.data;

  return async (
    chainId: string,
    chainType: ChainType
  ): Promise<number | undefined> => {
    if (chainType === ChainType.EVM) {
      return EVM_GAS_AMOUNT;
    }
    if (chainType !== ChainType.Cosmos) return undefined;

    const isSwapChain =
      swapVenues?.some((venue) => venue.chainID === chainId) ?? false;
    const defaultGasAmount = Math.ceil(
      isSwapChain ? COSMOS_GAS_AMOUNT.SWAP : COSMOS_GAS_AMOUNT.DEFAULT
    );

    // Special case for carbon-1
    if (chainId === "carbon-1") {
      return COSMOS_GAS_AMOUNT.CARBON;
    }

    return defaultGasAmount;
  };
});

export const simulateTxAtom = atom<boolean>();

export const skipSubmitSwapExecutionAtom = atomWithMutation((get) => {
  const skip = get(skipClient);
  const { route, userAddresses, transactionDetailsArray } = get(
    swapExecutionStateAtom
  );
  const submitSwapExecutionCallbacks = get(submitSwapExecutionCallbacksAtom);
  const getFallbackGasAmount = get(fallbackGasAmountFnAtom);
  const simulateTx = get(simulateTxAtom);
  const swapSettings = get(swapSettingsAtom);
  const streamSettings = get(streamSettingsAtom);
  const { timeoutSeconds } = get(routeConfigAtom);
  const { data: chains } = get(skipChainsAtom);
  const sourceAsset = get(sourceAssetAtom);
  const streamMesages = get(streamMessagesAtom);
  const walletConnectDeepLinkByChainType = get(
    walletConnectDeepLinkByChainTypeAtom
  );

  const chainType = chains?.find(
    (chain) => chain.chainID === sourceAsset?.chainID
  )?.chainType;

  if (chainType) {
    const { deeplink, recentWalletData } =
      walletConnectDeepLinkByChainType[chainType];
    if (chainType === ChainType.Cosmos) {
      window.localStorage.removeItem(DEEPLINK_CHOICE);
      window.localStorage.removeItem(RECENT_WALLET_DATA);
    } else {
      window.localStorage.setItem(DEEPLINK_CHOICE, deeplink);
      window.localStorage.setItem(RECENT_WALLET_DATA, recentWalletData);
    }
  }

  return {
    gcTime: Infinity,
    mutationFn: async (): Promise<any | null> => {
      // Adjusted return type
      if (!route) return null;
      if (!userAddresses.length) return null;
      try {
        if (streamSettings.shouldStream) {
          if (!streamMesages) throw new Error("stream messages not found");
          const { chainID, signerAddress, messages } = streamMesages;

          console.log(signerAddress);
          if (!sourceAsset?.chainID) return null;

          const validateGasResult = await skip.validateCosmosGasBalance({
            chainID: sourceAsset?.chainID,
            signerAddress: signerAddress,
            messages: messages,
            simulate: true,
          });

          console.log(validateGasResult);
          const { signer, stargateClient } =
            await skip.getSigningStargateClient({
              chainId: sourceAsset?.chainID,
            });

          // // Explicitly define types for executeCosmosMessage
          const res = await skip.executeCosmosMessage({
            chainID: chainID, // Use the chainID from result
            signerAddress: signerAddress, // Use signerAddress from result
            messages: messages, // Pass messages
            gas: validateGasResult as ValidateGasResult, // Use validateGasResult from result
            signer: signer, // Use signer from skip.getSigningStargateClient
            stargateClient: stargateClient, // Use stargateClient from skip.getSigningStargateClient
            ...submitSwapExecutionCallbacks,
          });
          console.log("res", res);
          const status = await skip.waitForTransaction({
            chainID: chainID,
            txHash: res.transactionHash,
          });
          console.log("status", status);

          submitSwapExecutionCallbacks?.onTransactionCompleted?.(
            chainID,
            res.transactionHash,
            status
          );
          console.log("returning");

          // if (res.code == 0) {
          //   window.location.href = `https://triggerportal.zone/alert?owner=${intoAddress}&derivedAddress=true`;
          // } else {
          //   throw new Error("Failed to submit msg");
          // }
          if (res.code != 0) {
            throw new Error("Failed to submit msg");
          }

          // console.log("response:", res);
          return { isPending: false, isSucces: true, isError: false };
        }

        // Handle non-streaming swap execution
        await skip.executeRoute({
          route,
          userAddresses,
          timeoutSeconds,
          slippageTolerancePercent: swapSettings.slippage.toString(),
          useUnlimitedApproval: swapSettings.useUnlimitedApproval,
          simulate:
            simulateTx !== undefined
              ? simulateTx
              : route.sourceAssetChainID !== "984122",
          getFallbackGasAmount,
          ...submitSwapExecutionCallbacks,
        });
      } catch (error: unknown) {
        console.error(error);
        submitSwapExecutionCallbacks?.onError?.(error, transactionDetailsArray);
      }
      return null;
    },
    onError: (error: unknown) => {
      console.error(error);
      submitSwapExecutionCallbacks?.onError?.(error, transactionDetailsArray);
    },
  };
});

export const expectedStreamFeesAtom = atom<Coin[]>();

export const streamMessagesAtom = atom<StreamMessagesResult>();

export const msgTransferAtomToIntentoAtom = atomWithMutation((get) => {
  const skip = get(skipClient);
  const { userAddresses } = get(swapExecutionStateAtom);

  const expectedStreamFees = get(expectedStreamFeesAtom);
  const streamFeesAddress = get(streamMessagesAtom)?.intoAddress;

  return {
    gcTime: Infinity,
    mutationFn: async () => {
      if (!userAddresses.length) return;
      try {
        const chainId = import.meta.env.VITE_CHAIN_ID_ATOM;
        const cosmosAddress = toBech32(
          "cosmos",
          fromBech32(userAddresses[0].address).data
        );

        const msgTransfer = {
          source_channel: import.meta.env.VITE_CHANNEL_ID_ATOM,
          source_port: "transfer",
          sender: cosmosAddress,
          token: {
            amount: expectedStreamFees?.find((fee) => fee.denom === "uatom")
              ?.amount,
            denom: "uatom",
          },
          receiver: streamFeesAddress,
          timeout_height: {
            revision_number: "0",
            revision_height: "0",
          },
          timeout_timestamp: (
            BigInt(Math.floor(Date.now() / 1000) + 10 * 60) * 1_000_000_000n
          ).toString(), // 10 minutes
          memo: "",
        };
        const msgJSON = cosmosMsgFromJSON({
          msg: JSON.stringify(msgTransfer),
          msg_type_url: "/ibc.applications.transfer.v1.MsgTransfer",
        });
        const validateGasResult = await skip.validateCosmosGasBalance({
          chainID: chainId,
          signerAddress: cosmosAddress,
          messages: [msgJSON],
          simulate: true,
        });

        console.log(validateGasResult);
        const { signer, stargateClient } = await skip.getSigningStargateClient({
          chainId,
        });

        // // Explicitly define types for executeCosmosMessage
        const res = await skip.executeCosmosMessage({
          chainID: chainId, // Use the chainID from result
          signerAddress: cosmosAddress, // Use signerAddress from result
          messages: [msgJSON], // Pass messages
          gas: validateGasResult as ValidateGasResult, // Use validateGasResult from result
          signer: signer, // Use signer from skip.getSigningStargateClient
          stargateClient: stargateClient, // Use stargateClient from skip.getSigningStargateClient
        });
        console.log(res);
        if (res.code != 0) {
          throw new Error("Failed to submit msg");
        }
        return null;
      } catch (error: unknown) {
        console.error(error);
      }
      return null;
    },
    onError: (error: unknown) => {
      console.error(error);
    },
  };
});

export const createStreamMessagesAtom = atom(null, async (get, set) => {
  const skip = get(skipClient);
  const { route, userAddresses, transactionDetailsArray } = get(
    swapExecutionStateAtom
  );
  const submitSwapExecutionCallbacks = get(submitSwapExecutionCallbacksAtom);
  const swapSettings = get(swapSettingsAtom);
  const streamSettings = get(streamSettingsAtom);
  if (!route) return;

  const result = await createMessagesForPfmStream({
    skip,
    route,
    userAddresses,
    streamSettings,
    swapSettings,
    get,
  });

  if (!result) {
    const error = new Error("wasm contract not found");
    submitSwapExecutionCallbacks?.onError?.(error, transactionDetailsArray);
    return;
  }

  set(streamMessagesAtom, result);
});
