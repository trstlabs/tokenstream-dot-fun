import { useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { track } from "@amplitude/analytics-browser";
import styled, { useTheme } from "styled-components";

import { MainButton } from "@/components/MainButton";
import { Row, Column } from "@/components/Layout";
import { SmallText } from "@/components/Typography";
import { WaveIcon } from "@/icons/WaveIcon";
import { ICONS } from "@/icons";
import { StreamPageHeader } from "./StreamPageHeader";
import { currentPageAtom, Routes } from "@/state/router";
import {
  streamSettingsAtom,
  expectedStreamFeesAtom,
} from "@/state/streamSettings";
import { sourceAssetAtom } from "@/state/swapPage";
import {
  getChainChannelConfig,
  intentoTrustlessAgentSupportedChains,
} from "@/constants/intentoChains";
import { useStreamFeeParams } from "@/hooks/useStreamFeeParams";
import { convertTokenAmountToHumanReadableAmount } from "@/utils/crypto";
import { swapExecutionStateAtom } from "@/state/swapExecutionPage";
import { useStreamSettingsDrawer } from "@/hooks/useStreamSettingsDrawer";
import NiceModal from "@ebay/nice-modal-react";
import { Modals } from "@/modals/registerModals";
import { settingsDrawerAtom } from "@/state/settingsDrawer";

export type StreamPageProps = {};

export const StreamPage = ({}: StreamPageProps) => {
  const settingsDrawer = useAtomValue(settingsDrawerAtom);
  const theme = useTheme();
  const [streamSettings, setStreamSettings] = useAtom(streamSettingsAtom);
  const setCurrentPage = useSetAtom(currentPageAtom);
  const [expectedStreamFees, setExpectedStreamFees] = useAtom(
    expectedStreamFeesAtom
  );
  const [sourceAsset] = useAtom(sourceAssetAtom);

  const {
    data: streamFeeParams,
    isLoading: isLoadingFees,
    isError,
  } = useStreamFeeParams();
  const [swapExecutionState, setSwapExecutionState] = useAtom(
    swapExecutionStateAtom
  );

  // Memoize the fees calculation
  const fees = useMemo(() => {
    if (!streamFeeParams?.gasFeeCoins?.length) return [];

    const expectedMaxGasUsed = 120_000;
    const lenMsgs = 1;
    // Calculate recurrences based on the total time span (from start to end) divided by interval
    let recurrences = 1; // At least one recurrence
    if (streamSettings.interval > 0) {
      const startTime = streamSettings.startAt > 0 ? streamSettings.startAt : 0;
      const endTime = startTime + streamSettings.duration;
      const totalDuration = endTime - startTime;
      recurrences = Math.max(
        1,
        Math.ceil(totalDuration / streamSettings.interval)
      );
    }

    // Check if chain supports hosted accounts
    const isTrustlessAgentSupported =
      sourceAsset?.chainId &&
      intentoTrustlessAgentSupportedChains.includes(sourceAsset.chainId);

    const fees = streamFeeParams.gasFeeCoins
      .map((coin) => {
        try {
          let authzFeeForDenom = 0;
          const denom = coin.denom;
          // If hosted account is supported, only process the denom that matches the source asset's chain ID
          if (isTrustlessAgentSupported) {
            const chainConfig = getChainChannelConfig(
              sourceAsset?.chainId || ""
            );
            if (!chainConfig) return null;
            if (denom !== chainConfig.denomOnIntento) return null;
            // Add authz fee denom when using authz
            authzFeeForDenom =
              denom == chainConfig?.denomOnIntento
                ? Number(chainConfig.trustlessAgentFee) * recurrences
                : 0;
          }
          const denomPrice = Number(coin.amount);
          const gasFeeUnits =
            (expectedMaxGasUsed * Number(streamFeeParams.flexFeeMul || 1)) /
            1000;
          const gasFee = gasFeeUnits * denomPrice;
          const applyBurnFee = denom === "uinto";
          const burnFeePerRun = applyBurnFee
            ? Number(streamFeeParams.burnFeePerMsg || 0) * lenMsgs
            : 0;
          const totalFee =
            recurrences * (gasFee + burnFeePerRun) + authzFeeForDenom;
          return {
            denom,
            amount: Math.round(totalFee).toString(),
          };
        } catch (error) {
          console.error("Error calculating fee for coin:", coin, error);
          return null;
        }
      })
      .filter(Boolean) as { denom: string; amount: string }[]; // Filter out any nulls from errors

    // If no fees were found for the source asset's denom but hosted account is supported,
    // return an empty array to indicate no valid fees
    if (isTrustlessAgentSupported && sourceAsset?.denom && fees.length === 0) {
      return [];
    }
    return fees;
  }, [streamFeeParams, streamSettings.duration, streamSettings.interval]);
  const openStreamSettingsDrawer = () => {
    track("stream page: open stream settings (email prompt)");
    NiceModal.show(Modals.StreamSettingsDrawer, {
      drawer: true,
      container: settingsDrawer,
    });
  };

  // Update expected fees when calculation changes
  useEffect(() => {
    if (fees.length > 0) {
      setExpectedStreamFees(fees);
    }
  }, [fees, setExpectedStreamFees]);

  // Reset swap execution state when needed
  useEffect(() => {
    if (
      streamSettings.shouldStream &&
      swapExecutionState.overallStatus === "completed"
    ) {
      setSwapExecutionState((prev) => ({
        ...prev,
        overallStatus: "unconfirmed",
      }));
    }
  }, [
    streamSettings.shouldStream,
    swapExecutionState.overallStatus,
    setSwapExecutionState,
  ]);

  const [hasTriggeredSwap, setHasTriggeredSwap] = useState(false);
  const { StreamSettingsFooterSwapPage: StreamSettingsFooter } =
    useStreamSettingsDrawer();

  useEffect(() => {
    if (hasTriggeredSwap) {
      setCurrentPage(Routes.SwapExecutionPage);
      setHasTriggeredSwap(false); // reset
    }
  }, [streamSettings.shouldStream, hasTriggeredSwap]);
  return (
    <>
      <StreamPageHeader
        leftButton={{
          label: "Back",
          icon: ICONS.thinArrow,
          onClick: () => {
            track("stream page: back button clicked");
            setCurrentPage(Routes.SwapPage);
          },
        }}
      />
      <StreamSettingsFooter />
      <StyledStreamPageRoute
        style={{ cursor: "pointer" }}
        justify="space-between"
        align="center"
        onClick={openStreamSettingsDrawer}
      >
        <WaveIcon width={77} height={77} color={theme.primary.text.normal} />
        <Row justify="center" align="center" gap={5}>
          <div>
            <SmallText textAlign="center" color={theme.primary.text.normal}>
              Review Stream
            </SmallText>
            <SmallText textAlign="center">
              Every {formatDuration(streamSettings.interval)} for{" "}
              {formatDuration(streamSettings.duration)}
            </SmallText>

            <SmallText textAlign="center">
              {Math.floor(streamSettings.duration / streamSettings.interval)}{" "}
              total recurrences
            </SmallText>
            <SmallText textAlign="center">
              Starts{" "}
              {streamSettings.startAt > 0
                ? "in " + formatDuration(streamSettings.startAt)
                : "on first run"}
            </SmallText>
          </div>
        </Row>
        {(!streamSettings.emailAddress ||
          streamSettings.emailAddress.trim() === "") && (
          <SmallText>No email set for alerts</SmallText>
        )}
        <div>
          {isLoadingFees ? (
            <SmallText style={{ marginTop: "5px" }} textAlign="center">
              Loading fees...
            </SmallText>
          ) : isError ? (
            <SmallText
              style={{ marginTop: "5px" }}
              textAlign="center"
              color="warning"
            >
              Failed to load fees. Using default values.
            </SmallText>
          ) : fees.length > 0 ? (
            <div style={{ textAlign: "center", marginTop: "5px" }}>
              <SmallText textAlign="center" fontWeight="bold">
                Streaming Fee
              </SmallText>
              <SmallText textAlign="center">
                {fees.map((fee, index) => {
                  // Map denoms to their display symbols
                  const denomMap: Record<string, string> = {
                    uinto: "INTO",
                    [import.meta.env.VITE_IBC_DENOM_ATOM]: "ATOM",
                    [import.meta.env.VITE_IBC_DENOM_OSMO]: "OSMO",
                  };

                  const symbol = denomMap[fee.denom] || fee.denom;
                  const amount = convertTokenAmountToHumanReadableAmount(
                    fee.amount,
                    6
                  );
                  const isLast = index === fees.length - 1;

                  return (
                    <span key={fee.denom}>
                      {amount} {symbol}
                      {!isLast && " or "}
                    </span>
                  );
                })}
              </SmallText>
              <SmallText color={theme.brandColor} textAlign="center">
                Do you want to go once or stream?
              </SmallText>
            </div>
          ) : (
            <SmallText style={{ marginTop: "5px" }} textAlign="center">
              No fees data available {fees.length}
            </SmallText>
          )}
        </div>
      </StyledStreamPageRoute>
      {expectedStreamFees && (
        <>
          <Row
            justify="center"
            align="center"
            gap={20}
            style={{ marginBottom: "10px" }}
          >
            <div style={{ width: "100%" }}>
              <MainButton
                label="Go Once"
                onClick={async () => {
                  track("stream page: swap button clicked");
                  setStreamSettings((prev) => ({
                    ...prev,
                    shouldStream: false,
                    streamIntoStreamSwapID: undefined,
                  }));
                  setHasTriggeredSwap(true);
                }}
                icon={ICONS.swap}
              />
            </div>
            <div style={{ width: "100%" }}>
              <MainButton
                label="Stream"
                onClick={() => {
                  track("stream page: continue button clicked");
                  setStreamSettings((prev) => ({
                    ...prev,
                    shouldStream: true,
                    streamIntoStreamSwapID: undefined,
                  }));
                  setHasTriggeredSwap(true);
                }}
                icon={ICONS.checkmark}
              />
            </div>
          </Row>

          {/* Stream into StreamSwap button - only shown for USDC destination on Osmosis from a token swapped on Osmosis */}
          {import.meta.env.VITE_STREAM_SWAP_IDS &&
            swapExecutionState?.route?.swapVenues?.every(
              (venue) => venue.chainId === "osmosis-1"
            ) &&
            swapExecutionState?.route?.destAssetChainId == "osmosis-1" &&
            swapExecutionState?.route?.destAssetDenom?.includes(
              import.meta.env.VITE_OSMOSIS_USDC_DENOM
            ) &&
            !swapExecutionState?.route?.sourceAssetDenom
              ?.toLowerCase()
              .includes("usdc") && (
              <div style={{ marginTop: "10px", width: "100%" }}>
                <div>
                  <MainButton
                    label={`✨ Stream into $${Object.keys(JSON.parse(import.meta.env.VITE_STREAM_SWAP_IDS || "{}"))[0]} StreamSwap`}
                    onClick={() => {
                      track("stream page: stream into streamswap clicked");
                      const streamId = Object.values(
                        JSON.parse(import.meta.env.VITE_STREAM_SWAP_IDS || "{}")
                      )[0] as string;

                      setStreamSettings((prev) => ({
                        ...prev,
                        shouldStream: true,
                        streamIntoStreamSwapID: streamId,
                      }));
                      setHasTriggeredSwap(true);
                    }}
                    backgroundColor="linear-gradient(135deg, #8a2be2 0%,rgb(255, 123, 0) 100%)"
                  />
                </div>
              </div>
            )}
        </>
      )}

      {/* <div style={{ marginTop: '20px' }}>
       <GhostButton
         gap={5}
         align="center" 
       
         onClick={() => {
           track("stream page: back button clicked");
           setCurrentPage(Routes.SwapPage);
         }}
         
       >Back</GhostButton>
     </div> */}
    </>
  );
};

const StyledStreamPageRoute = styled(Column)`
  padding: 10px;
  background: ${({ theme }) => theme.primary.background.normal};
  border-radius: 25px;
  margin-bottom: 10px;
  min-height: 22px;
  opacity: ${({ theme }) => ((theme as any).drawerOpen ? 0.3 : 1)};
  transition: opacity 0.2s ease;
`;

export const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
};
