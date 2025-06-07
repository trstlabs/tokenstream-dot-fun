import { useEffect, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { track } from "@amplitude/analytics-browser";
import styled, { useTheme } from "styled-components";
import { Coin } from "@cosmjs/amino";

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
import { useStreamFeeParams } from "@/hooks/useStreamFeeParams";
import { convertTokenAmountToHumanReadableAmount } from "@/utils/crypto";
import { swapExecutionStateAtom } from "@/state/swapExecutionPage";
import { useStreamSettingsDrawer } from "@/hooks/useStreamSettingsDrawer";

export type StreamPageProps = {};

export const StreamPage = ({}: StreamPageProps) => {
  const theme = useTheme();
  const [streamSettings, setStreamSettings] = useAtom(streamSettingsAtom);
  const setCurrentPage = useSetAtom(currentPageAtom);
  const [expectedStreamFees, setExpectedStreamFees] = useAtom(
    expectedStreamFeesAtom
  );

  const streamFeeParams = useStreamFeeParams();

  const [swapExecutionState, setSwapExecutionState] = useAtom(
    swapExecutionStateAtom
  );

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

  useEffect(() => {
    const getExpectedStreamFees = async () => {
      if (!streamFeeParams || streamFeeParams.gasFeeCoins.length === 0) return;

      const gasUsed = 100_000;
      const lenMsgs = 1;

      const recurrences = Math.floor(
        Number(streamSettings.duration) / Number(streamSettings.interval)
      );

      const fees: Coin[] = [];

      for (const coin of streamFeeParams.gasFeeCoins) {
        const denom = coin.denom;
        const denomPrice = Number(coin.amount); // denom-specific gas price (e.g. INTO=30, ATOM=5)

        // Gas fee in raw units: (gasUsed * flexFeeMul) / 1000
        const gasFeeUnits =
          (gasUsed * Number(streamFeeParams.flexFeeMul)) / 1000;
        const gasFee = gasFeeUnits * denomPrice;

        // Burn fee (only if denom is INTO)
        const applyBurnFee = denom === "INTO";
        const burnFeePerRun = applyBurnFee
          ? Number(streamFeeParams.burnFeePerMsg) * lenMsgs
          : 0;

        const totalFee = recurrences * (gasFee + burnFeePerRun);

        fees.push({
          denom,
          amount: Math.round(totalFee).toString(), // keep it in microdenom (no decimals)
        });
      }

      setExpectedStreamFees(fees);
    };

    getExpectedStreamFees();
  }, [streamFeeParams, setExpectedStreamFees]);

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

      <StyledStreamPageRoute justify="space-between" align="center">
        <WaveIcon width={77} height={77} color={theme.primary.text.normal} />
        <Row justify="center" align="center" gap={5}>
          <div>
            <SmallText textAlign="center" color={theme.primary.text.normal}>
              Stream Settings
            </SmallText>
            <SmallText textAlign="center">
              Every {formatDuration(streamSettings.interval)} for{" "}
              {formatDuration(streamSettings.duration)}
            </SmallText>
            <SmallText textAlign="center">
              {Math.floor(streamSettings.duration / streamSettings.interval)}{" "}
              total recurrences
            </SmallText>
          </div>
        </Row>

        <div>
          <SmallText color={theme.brandColor} textAlign="center">
            Do you want to go once or stream?
          </SmallText>
          {expectedStreamFees && (
            <SmallText style={{ marginTop: "5px" }} textAlign="center">
              Total streaming fees are ~{" "}
              {convertTokenAmountToHumanReadableAmount(
                expectedStreamFees?.find((fee) => fee.denom === "uinto")
                  ?.amount ?? "0"
              )}{" "}
              INTO or{" "}
              {convertTokenAmountToHumanReadableAmount(
                expectedStreamFees.find(
                  (fee) =>
                    fee.denom === import.meta.env.VITE_IBC_DENOM_ATOM ||
                    fee.denom != "uinto"
                )?.amount ?? "0"
              )}{" "}
              ATOM
            </SmallText>
          )}
        </div>
      </StyledStreamPageRoute>
      {expectedStreamFees && (
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
                }));
                setHasTriggeredSwap(true);
              }}
              icon={ICONS.checkmark}
            />
          </div>
        </Row>
      )}

      <StreamSettingsFooter />
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

const formatDuration = (seconds: number) => {
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
