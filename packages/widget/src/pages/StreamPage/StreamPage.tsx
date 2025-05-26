import { ICONS } from "@/icons";

import { StreamPageHeader } from "./StreamPageHeader";
import { track } from "@amplitude/analytics-browser";
import { MainButton } from "@/components/MainButton";
import styled, { useTheme } from "styled-components";
import { Row, Column } from "@/components/Layout";
import { SmallText } from "@/components/Typography";
import { WaveIcon } from "@/icons/WaveIcon";
import { currentPageAtom, Routes } from "@/state/router";
import { useAtom, useSetAtom } from "jotai";
import { streamSettingsAtom } from "@/state/streamSettings";
import { expectedStreamFeesAtom } from "@/state/streamSettings";
import { useStreamFeeParams } from "@/hooks/useStreamFeeParams";
import { useEffect, useState } from "react";
import { Coin } from "@cosmjs/amino";
import { convertTokenAmountToHumanReadableAmount } from "@/utils/crypto";
import { swapExecutionStateAtom } from "@/state/swapExecutionPage";

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

      let fees: Coin[] = [];

      for (const coin of streamFeeParams.gasFeeCoins) {
        const denom = coin.denom;

        const flexFeeForPeriod =
          (Number(streamFeeParams.flexFeeMul) / 1000) * gasUsed;

        const recurrences = Math.floor(
          Number(streamSettings.duration) / Number(streamSettings.interval)
        );

        const flowFee =
          recurrences * flexFeeForPeriod +
          recurrences * Number(streamFeeParams.burnFeePerMsg) * lenMsgs;

        const denomCoin = streamFeeParams.gasFeeCoins.find(
          (c) => c.denom === denom
        );
        if (!denomCoin) continue;

        const flowFeeForDenom = flowFee * Number(denomCoin.amount);
        fees = [...fees, { denom, amount: flowFeeForDenom.toString() }];
        //fees[coin.denom] = Number(flowFeeNormalized.toFixed(4));
      }

      setExpectedStreamFees(fees);
    };

    getExpectedStreamFees();
  }, [streamFeeParams, setExpectedStreamFees]);

  const [hasTriggeredSwap, setHasTriggeredSwap] = useState(false);

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
        <Row justify="center" align="center" gap={15}>
          {/* Stream Icon */}

          <div>
            <SmallText textAlign="center" color={theme.primary.text.normal}>
              Stream Settings
            </SmallText>
            <SmallText textAlign="center">
              Interval is every {formatDuration(streamSettings.interval)}
            </SmallText>
            <SmallText textAlign="center">
              The total recurrences is{" "}
              {Math.floor(streamSettings.duration / streamSettings.interval)}
            </SmallText>
            {streamSettings.startAt != 0 && (
              <SmallText textAlign="center">
                Starts in {formatDuration(streamSettings.startAt)}
              </SmallText>
            )}
          </div>
        </Row>

        <div style={{ marginTop: "10px" }}>
          <SmallText color={theme.brandColor} textAlign="center">
            Do you want to go once or stream?
          </SmallText>
          {expectedStreamFees && (
            <SmallText style={{ marginTop: "10px" }} textAlign="center">
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
          style={{ marginTop: "10px" }}
        >
          {/* Button to go back to swap */}
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
          {/* Button to continue */}
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
            />{" "}
          </div>
        </Row>
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
  padding: 30px;
  background: ${({ theme }) => theme.primary.background.normal};
  border-radius: 25px;
  min-height: 225px;
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
