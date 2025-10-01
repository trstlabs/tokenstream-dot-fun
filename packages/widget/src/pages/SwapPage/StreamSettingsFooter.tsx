import React from "react";
import styled from "styled-components";
import { useAtomValue } from "jotai";

import { GhostButton } from "@/components/Button";
import { Row } from "@/components/Layout";
import { WaveIcon } from "@/icons/WaveIcon";
innerWidth;
import { convertSecondsToMinutesOrHours } from "@/utils/number";
import { useSettingsChanged } from "@/hooks/useSettingsChanged";
import { streamSettingsAtom } from "@/state/streamSettings";
import { formatDuration } from "../StreamPage/StreamPage";

export const StreamSettingsFooterItems: React.FC<{
  highlightSettings?: boolean;
  content?: React.ReactNode;
}> = ({ highlightSettings, content }) => {
  const { interval, duration } = useAtomValue(streamSettingsAtom);
  const settingsChanged = useSettingsChanged();
  const formattedInterval = convertSecondsToMinutesOrHours(interval || 0);
  const formattedDuration = formatDuration(duration);

  return (
    <Row align="flex-end" justify="space-between">
      <Row align="flex-end" gap={10}>
        <StyledSettingsContainer
          align="flex-end"
          gap={3}
          highlightSettings={highlightSettings}
        >
          <CogIconWrapper>
            <WaveIcon />
            {settingsChanged && <SettingsChangedIndicator />}
          </CogIconWrapper>
          Stream Settings -
          {formattedInterval && (
            <Row gap={4} align="flex-end">
              every {formattedInterval}
            </Row>
          )}
          {formattedInterval && (
            <Row gap={4} align="flex-end">
              for {formattedDuration}
            </Row>
          )}
        </StyledSettingsContainer>
      </Row>
      {content && <Row>{content}</Row>}
    </Row>
  );
};

export const StreamSettingsFooter: React.FC<
  { onClick?: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ onClick, ...props }) => (
  <GhostButton
    gap={5}
    justify="space-between"
    align="center"
    onClick={onClick}
    height={35}
    {...props}
  >
    <StreamSettingsFooterItems />
  </GhostButton>
);

const StyledSettingsContainer = styled(Row)<{ highlightSettings?: boolean }>`
  ${({ highlightSettings, theme }) =>
    highlightSettings && `color: ${theme.primary.text.normal}`};
`;

const CogIconWrapper = styled(Row)`
  position: relative;

  svg {
    display: block;
  }
`;

const SettingsChangedIndicator = styled.div`
  position: absolute;
  top: -3px;
  right: -3px;
  width: 4px;
  height: 4px;
  background: ${({ theme }) => theme.primary.text.normal};
  border-radius: 50%;
`;
