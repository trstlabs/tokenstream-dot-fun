import { styled } from "styled-components";
import { createModal } from "@/components/Modal";
import { Column, Row } from "@/components/Layout";
import { SmallText, SmallTextButton } from "@/components/Typography";
import NiceModal from "@ebay/nice-modal-react";
import { track } from "@amplitude/analytics-browser";
import { Modals } from "../registerModals";

import { DurationSetting } from "./DurationSetting";
import { IntervalSetting } from "./IntervalSetting";
import { StartAtSetting } from "./StartAtSetting";
import { EmailSetting } from "./EmailSetting";
import { StreamModeSetting } from "./StreamModeSetting";
import { MinAssetOutPercentSetting } from "./MinAssetOutPercentSetting";
// import { SaveIndicator } from "./SaveIndicator";

export const StreamSettingsDrawer = createModal(() => {
  return (
    <StyledStreamSettings gap={15}>
      <Column gap={12}>
        <StreamModeSetting />

        <StartAtSetting />
        <StyledHelpText>
          Start is when to start token streaming, 0 for now
        </StyledHelpText>

        <IntervalSetting />
        <StyledHelpText>
          Interval is how much time between stream executions, or 0 for one
          time.
        </StyledHelpText>

        <DurationSetting />
        <StyledHelpText>
          Duration is how long to stream after starting.
        </StyledHelpText>
        <EmailSetting />
        <MinAssetOutPercentSetting />
      </Column>

      <Row justify="flex-end">
        <SmallTextButton
          onClick={() => {
            track("stream settings drawer: close button - clicked");
            NiceModal.hide(Modals.StreamSettingsDrawer);
          }}
        >
          Close
        </SmallTextButton>
      </Row>
    </StyledStreamSettings>
  );
});

const StyledStreamSettings = styled(Column)`
  width: 100%;
  padding: 20px;
  border-radius: 20px;
  background: ${(props) => props.theme.primary.background.normal};
`;

const StyledHelpText = styled(SmallText)`
  padding-left: 4px;
  padding-right: 4px;
  font-size: 11px;
  color: ${(props) => props.theme.neutral?.text.secondary || "#888"};
  line-height: 1.4;
`;
