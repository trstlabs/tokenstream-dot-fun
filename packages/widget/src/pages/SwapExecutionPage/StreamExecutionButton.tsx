// StreamExecutionButton.tsx
import { MainButton } from "@/components/MainButton";
import { ICONS } from "@/icons";
import { SwapExecutionState } from "./SwapExecutionPage";
// import { createExplorerAddressLink } from "@/utils/explorerLink";
import pluralize from "pluralize";
import { convertSecondsToMinutesOrHours } from "@/utils/number";
import { useAtomValue, useSetAtom } from "jotai";
import { clearAssetInputAmountsAtom } from "@/state/swapPage";
import { currentPageAtom, Routes } from "@/state/router";
import { errorWarningAtom, ErrorWarningType } from "@/state/errorWarning";
import NiceModal from "@ebay/nice-modal-react";
import { Modals } from "@/modals/registerModals";
import { RouteResponse } from "@skip-go/client";
import { ClientOperation } from "@/utils/clientType";
import { GoFastSymbol } from "@/components/GoFastSymbol";
import { useIsGoFast } from "@/hooks/useIsGoFast";
import { useCountdown } from "./useCountdown";
import { track } from "@amplitude/analytics-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "styled-components";
import { useAuthzGrants } from "@/hooks/useAuthzGrants";
import {
  createStreamMessagesAtom,
  expectedStreamFeesAtom,
  msgTransferAtomToIntentoAtom,
  msgSendToIntentoAtom,
  streamMessagesAtom,
} from "@/state/streamSettings";
import { buildMessagesResponse } from "@/utils/buildMessagesResponse";
import { useQuery } from "@tanstack/react-query";
import { swapSettingsAtom } from "@/state/swapPage";
import {
  chainAddressesAtom,
  setExistingGrantAtom,
  swapExecutionStateAtom,
} from "@/state/swapExecutionPage";
import { intentoTrustlessAgentSupportedChains } from "@/constants/intentoChains";
import { MutateFunction } from "jotai-tanstack-query";
import { Adapter } from "@solana/wallet-adapter-base";
import { svmWalletAtom } from "@/state/wallets";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCreateCosmosWallets } from "@/hooks/useCreateCosmosWallets";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { SmallText } from "@/components/Typography";

type SwapExecutionButtonProps = {
  swapExecutionState: SwapExecutionState | undefined;
  route: RouteResponse | undefined;
  signaturesRemaining: number;
  lastOperation: ClientOperation;
  connectRequiredChains: (openModal?: boolean) => Promise<void>;
  submitExecuteRouteMutation: MutateFunction<
    null | undefined,
    unknown,
    {
      getSvmSigner: () => Promise<Adapter>;
    },
    unknown
  >;
};

export const StreamExecutionButton: React.FC<SwapExecutionButtonProps> = ({
  swapExecutionState,
  route,
  signaturesRemaining,
  lastOperation,
  connectRequiredChains,
  submitExecuteRouteMutation,
}) => {
  const countdown = useCountdown({
    estimatedRouteDurationSeconds: route?.estimatedRouteDurationSeconds,
    enabled: swapExecutionState === SwapExecutionState.pending,
  });

  const { wallets: solanaWallets } = useWallet();
  const svmWallet = useAtomValue(svmWalletAtom);

  const theme = useTheme();
  const setErrorWarning = useSetAtom(errorWarningAtom);
  const setCurrentPage = useSetAtom(currentPageAtom);
  const clearAssetInputAmounts = useSetAtom(clearAssetInputAmountsAtom);
  const isGoFast = useIsGoFast(route);
  const triggerCreateStreamMessages = useSetAtom(createStreamMessagesAtom);
  // Get all required state
  const swapSettings = useAtomValue(swapSettingsAtom);
  const chainAddresses = useAtomValue(chainAddressesAtom);
  const expectedStreamFees = useAtomValue(expectedStreamFeesAtom);
  const streamMessages = useAtomValue(streamMessagesAtom);
  // Rename to avoid colliding with the component prop name `swapExecutionState`
  const execStateFromAtom = useAtomValue(swapExecutionStateAtom);

  // Get the current user's address for the source chain
  const currentUserAddress = useMemo(() => {
    if (!streamMessages) return "";
    // Use type assertion to handle the chain ID as a string key

    const intoAddressSigner = toBech32(
      "into", // Intento's bech32 prefix
      fromBech32(streamMessages?.signerAddress).data
    );
    return intoAddressSigner;
  }, [streamMessages]);

  // Check if we should show the fund buttons (only for PFM streams where intoAddress is different from user's address)
  const shouldShowFundButtons = useMemo(() => {
    return (
      streamMessages?.intoAddress &&
      streamMessages.intoAddress !== currentUserAddress
    );
  }, [streamMessages, currentUserAddress]);

  // Check if we have INTO tokens to fund
  const hasIntoToken = useMemo(() => {
    return expectedStreamFees?.some((coin) => coin.denom === "uinto");
  }, [expectedStreamFees]);

  // Handlers for fund buttons
  const [isFundingAtom, setIsFundingAtom] = useState(false);
  const [isFundingInto, setIsFundingInto] = useState(false);
  const setFundAtom = useSetAtom(msgTransferAtomToIntentoAtom);
  const setFundInto = useSetAtom(msgSendToIntentoAtom);
  const { createCosmosWallets } = useCreateCosmosWallets();
  const handleFundAtom = useCallback(async () => {
    if (isFundingAtom) return;

    setIsFundingAtom(true);
    try {
      track("swap execution page: fund atom button - clicked");
      // Connect to the required chains first
      const wallet = await createCosmosWallets(
        import.meta.env.VITE_CHAIN_ID_ATOM
      );
      console.log(wallet);
      // Then trigger the funding
      await setFundAtom();
    } catch (error) {
      console.error("Failed to fund ATOM:", error);
      // You might want to show an error toast here
    } finally {
      setIsFundingAtom(false);
    }
  }, [isFundingAtom, connectRequiredChains, setFundAtom]);

  const handleFundInto = useCallback(async () => {
    if (isFundingInto) return;

    setIsFundingInto(true);
    try {
      track("swap execution page: fund into button - clicked");
      // Connect to the required chains first
      const wallet = await createCosmosWallets(
        import.meta.env.VITE_CHAIN_ID_INTO
      );
      console.log(wallet);
      // Then trigger the funding
      await setFundInto();
    } catch (error) {
      console.error("Failed to fund INTO:", error);
      // You might want to show an error toast here
    } finally {
      setIsFundingInto(false);
    }
  }, [isFundingInto, connectRequiredChains, setFundInto]);

  // Build messages response first
  const { data: messagesResponse } = useQuery({
    queryKey: [
      "messages",
      route?.sourceAssetChainId,
      route?.destAssetChainId,
      route?.amountIn,
    ],
    queryFn: async () => {
      if (!route || !swapSettings) return null;

      // Convert chain addresses to user addresses format
      const userAddresses = Object.entries(chainAddresses)
        .filter(([_, { address }]) => Boolean(address)) // Filter out undefined addresses
        .map(([chainId, { address }]) => ({
          chainId,
          address: address || "", // Ensure address is always a string
        }));

      return buildMessagesResponse({
        route,
        userAddresses,
        slippage: swapSettings.slippage,
      });
    },
    enabled: !!route && !!swapSettings && !!chainAddresses,
  });

  // Get message type URLs from the built messages
  const msgTypeUrls = useMemo(() => {
    if (!messagesResponse?.txs?.[0]) return [];
    const tx = messagesResponse.txs[0];
    if (!("cosmosTx" in tx) || !tx.cosmosTx.msgs) return [];
    const types = tx.cosmosTx.msgs
      .map((msg) => {
        if (msg && typeof msg === "object") {
          // Skip SDK may use msgTypeUrl in entries
          if ("msgTypeUrl" in (msg as any)) return String((msg as any).msgTypeUrl);
          // Or it might expose @type or typeUrl
          if ("@type" in (msg as any)) return String((msg as any)["@type"]);
          if ("typeUrl" in (msg as any)) return String((msg as any).typeUrl);
        }
        return "";
      })
      .filter(Boolean) as string[];
    // Deduplicate
    return Array.from(new Set(types));
  }, [messagesResponse]);

  // Only check grants for supported chains
  const isSupportedChain = route?.sourceAssetChainId
    ? intentoTrustlessAgentSupportedChains.includes(route.sourceAssetChainId)
    : false;

  // Check grants when on a supported chain with a known granter address
  // Do not block on msgTypeUrls; we will fall back to a default typeUrl if empty
  // This ensures the hook runs and can cache results early.
  // Note: granterAddress is defined below; TS narrow by computing rawGranter first.
  // Prefer the address corresponding to the source chain id
  const sourceChainId = route?.sourceAssetChainId;
  const userAddrForSource = execStateFromAtom?.userAddresses?.find(
    (u) => u.chainId === sourceChainId
  )?.address;
  const chainAddrForSource = Object.values(chainAddresses || {}).find(
    (c) => c.chainId === sourceChainId
  )?.address;
  const rawGranter =
    userAddrForSource ||
    chainAddrForSource ||
    execStateFromAtom?.userAddresses?.[0]?.address ||
    chainAddresses?.[0]?.address;
  const granterAddress = rawGranter && rawGranter.length > 0 ? rawGranter : undefined;
  const shouldCheckGrants =
    isSupportedChain &&
    !!route?.sourceAssetChainId &&
    !!granterAddress &&
    msgTypeUrls.length > 0;

  useEffect(() => {
    console.log("Authz debug:", {
      isSupportedChain,
      sourceChainId: route?.sourceAssetChainId,
      msgTypeUrls,
      selectedMsgTypeUrl: msgTypeUrls[0] || "/cosmos.bank.v1beta1.MsgSend",
      shouldCheckGrants,
      granterAddress,
      chainAddresses,
      userAddresses: execStateFromAtom?.userAddresses,
    });
  }, [isSupportedChain, route?.sourceAssetChainId, msgTypeUrls.join("|"), shouldCheckGrants, granterAddress, chainAddresses, execStateFromAtom?.userAddresses]);

  // Use the first msg type URL directly
  const selectedMsgTypeUrl = useMemo(() => {
    return msgTypeUrls[0] || "/cosmos.bank.v1beta1.MsgSend";
  }, [msgTypeUrls]);

  const { data: existingGrant, isLoading: isCheckingGrants } = useAuthzGrants(
    shouldCheckGrants
      ? {
          // Granter must be the user's address on the source chain, not the chainId
          granter: granterAddress,
          chainId: route?.sourceAssetChainId,
          msgTypeUrl: selectedMsgTypeUrl,
        }
      : { granter: undefined, chainId: undefined }
  );

  // Persist the existing grant in global state so it can be used when building stream messages
  const setExistingGrant = useSetAtom(setExistingGrantAtom);
  useEffect(() => {
    // Save null when unsupported or not found, undefined means unknown/not loaded yet
    if (isCheckingGrants) return;
    setExistingGrant(existingGrant ?? null);
  }, [existingGrant, isCheckingGrants, setExistingGrant]);

  const getDestinationAddreessUnsetText = useCallback(() => {
    const destinationChainIdHasSignRequired =
      lastOperation.signRequired &&
      lastOperation.fromChainId === route?.destAssetChainId;

    if (destinationChainIdHasSignRequired && route?.txsRequired === 2) {
      return "Set second signing address";
    }
    return "Set destination address";
  }, [
    lastOperation.fromChainId,
    lastOperation.signRequired,
    route?.destAssetChainId,
    route?.txsRequired,
  ]);

  switch (swapExecutionState) {
    case SwapExecutionState.recoveryAddressUnset:
      return (
        <MainButton
          label="Set intermediary address"
          icon={ICONS.rightArrow}
          onClick={() => {
            track("swap execution page: set recovery address button - clicked");
            connectRequiredChains(true);
          }}
        />
      );
    case SwapExecutionState.destinationAddressUnset:
      return (
        <MainButton
          label={getDestinationAddreessUnsetText()}
          icon={ICONS.rightArrow}
          onClick={() => {
            track(
              "swap execution page: set destination address button - clicked"
            );
            const destinationChainId = route?.destAssetChainId;
            if (!destinationChainId) return;
            NiceModal.show(Modals.SetAddressModal, {
              signRequired: lastOperation.signRequired,
              chainId: destinationChainId,
              chainAddressIndex: route.requiredChainAddresses.length - 1,
            });
          }}
        />
      );
    case SwapExecutionState.ready: {
      track("swap execution page: confirm button - clicked", { route });

      const checkAndCreateStream = async () => {
        if (!route) return;
        try {
          // Get the user's address for the source chain
          // requiredChainAddresses is an array of chain IDs that need to be connected
          // We assume the first address is the source chain address
          const userAddress = route.requiredChainAddresses[0];

          if (!userAddress) {
            console.error("No user address found for source chain");
            setErrorWarning({
              errorWarningType: ErrorWarningType.Unexpected,
              error: new Error("No user address found for source chain"),
            });
            return;
          }

          if (isCheckingGrants) {
            console.log("Checking for existing grants...");
            return;
          }
          if (existingGrant) {
            console.log("Found existing grant:", {
              expiration: existingGrant.expiration?.toISOString(),
              granter: existingGrant.granter,
              grantee: existingGrant.grantee,
              msgTypeUrl: existingGrant.msgTypeUrl,
            });
          } else {
            console.log("No existing grant found, will create a new one");
          }

          try {
            // Trigger stream message creation with the existing grant if available
            // Note: triggerCreateStreamMessages doesn't expect any arguments
            await triggerCreateStreamMessages();

            // Submit the route for execution
            submitExecuteRouteMutation({
              getSvmSigner: async () => {
                const wallet = solanaWallets.find(
                  (w) => w.adapter.name === svmWallet?.walletName
                );
                if (!wallet) {
                  throw new Error("SVM wallet not found");
                }
                return wallet.adapter as Adapter;
              },
            });
          } catch (error) {
            console.error("Error in stream creation:", error);
            throw error; // This will be caught by the outer catch block
          }
        } catch (error) {
          console.error("Error in checkAndCreateStream:", error);
          setErrorWarning({
            errorWarningType: ErrorWarningType.Unexpected,
            error:
              error instanceof Error
                ? error
                : new Error("Failed to execute stream"),
          });
          // Fallback to normal flow if there's an error
          try {
            await triggerCreateStreamMessages();
            submitExecuteRouteMutation({
              getSvmSigner: async () => {
                const wallet = solanaWallets.find(
                  (w) => w.adapter.name === svmWallet?.walletName
                );
                if (!wallet) {
                  throw new Error("SVM wallet not found");
                }
                return wallet.adapter as Adapter;
              },
            });
          } catch (fallbackError) {
            console.error("Fallback flow failed:", fallbackError);
            setErrorWarning({
              errorWarningType: ErrorWarningType.Unexpected,
              error:
                fallbackError instanceof Error
                  ? fallbackError
                  : new Error("Failed to execute stream"),
            });
          }
        }
      };

      const onClickConfirmSwap = async () => {
        if (route?.txsRequired && route.txsRequired > 1) {
          track("error page: additional signing required", { route });
          setErrorWarning({
            errorWarningType: ErrorWarningType.AdditionalSigningRequired,
            onClickContinue: checkAndCreateStream,
            signaturesRequired: route.txsRequired,
          });
          return;
        }

        await checkAndCreateStream();
      };

      return (
        <MainButton
          label="Confirm"
          icon={ICONS.rightArrow}
          onClick={onClickConfirmSwap}
        />
      );
    }
    case SwapExecutionState.validatingGasBalance:
      return (
        <MainButton
          label={isCheckingGrants ? "Checking grants..." : "Validating"}
          icon={ICONS.rightArrow}
          loading
        />
      );
    case SwapExecutionState.waitingForSigning:
      return <MainButton label="Confirming" icon={ICONS.rightArrow} loading />;
    case SwapExecutionState.approving:
      return (
        <MainButton
          label="Approving allowance"
          icon={ICONS.rightArrow}
          loading
        />
      );
    case SwapExecutionState.pending:
      return (
        <MainButton
          label="Processing"
          loading
          isGoFast={isGoFast}
          extra={isGoFast && <GoFastSymbol />}
          loadingTimeString={convertSecondsToMinutesOrHours(countdown)}
        />
      );
    case SwapExecutionState.signaturesRemaining:
      return (
        <MainButton
          label={`${signaturesRemaining} ${pluralize(
            "signature",
            signaturesRemaining
          )} ${signaturesRemaining > 1 ? "are" : "is"} still required`}
          loading
          loadingTimeString={convertSecondsToMinutesOrHours(countdown)}
        />
      );
    //todo only show if balance is enough
    case SwapExecutionState.confirmed:
      if (expectedStreamFees?.length === 0) {
        return (
          <MainButton
            label="Go again"
            icon={ICONS.checkmark}
            backgroundColor={theme.success.text}
            onClick={() => {
              track("swap execution page: go again button - clicked");
              clearAssetInputAmounts();
              setCurrentPage(Routes.SwapPage);
            }}
          />
        );
      } else {
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              width: "100%",
            }}
          >
            {shouldShowFundButtons ? (
              <>
                <div style={{ width: "100%" }}>
                  <MainButton
                    label={isFundingAtom ? "Awaiting..." : "Fund ATOM"}
                    icon={ICONS.rightArrow}
                    onClick={handleFundAtom}
                    disabled={isFundingAtom}
                  />
                </div>
                {hasIntoToken && (
                  <div style={{ width: "100%" }}>
                    <MainButton
                      label={isFundingInto ? "Awaiting..." : "Fund INTO"}
                      icon={ICONS.rightArrow}
                      onClick={handleFundInto}
                      disabled={isFundingInto}
                    />
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <SmallText normalTextColor style={{ textAlign: "center" }}>
                  All set, no additional funding required for this transaction.{" "}
                  {chainAddresses?.[0] && (
                    <>
                      <a
                        href={`https://portal.intento.zone`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary-color)" }}
                      >
                        Go to the Intento Portal
                      </a>
                      {/* <a
                        href={`${createExplorerAddressLink({
                          chainId: chainAddresses[0].chainId,
                          chainType: "cosmos",
                          address: chainAddresses[0].address || "",
                        })}/address/${chainAddresses[0].address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary-color)" }}
                      >
                        or view your address in the explorer
                      </a> */}
                    </>
                  )}
                </SmallText>
              </div>
            )}
          </div>
        );
      }
    case SwapExecutionState.pendingGettingAddresses:
      return <MainButton label="Getting addresses" loading />;

    default:
      return null;
  }
};
