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

export type StreamPageProps = {};

export const StreamPage = ({}: StreamPageProps) => {
  const theme = useTheme();
  const [streamSettings, setStreamSettings] = useAtom(streamSettingsAtom);
  const setCurrentPage = useSetAtom(currentPageAtom);

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
        </div>
      </StyledStreamPageRoute>
      <Row
        justify="center"
        align="center"
        gap={20}
        style={{ marginTop: "10px" }}
      >
        {/* Button to go back to swap */}
        <MainButton
          label="Go Once"
          onClick={() => {
            track("stream page: swap button clicked");
            setStreamSettings((prev) => ({ ...prev, shouldStream: false }));
            setCurrentPage(Routes.SwapExecutionPage);
          }}
          icon={ICONS.swap}
        />
        {/* Button to continue */}
        <MainButton
          label="Stream"
          onClick={() => {
            track("stream page: continue button clicked");
            setStreamSettings((prev) => ({ ...prev, shouldStream: true }));
            setCurrentPage(Routes.SwapExecutionPage);
          }}
          icon={ICONS.checkmark}
        />
      </Row>

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
