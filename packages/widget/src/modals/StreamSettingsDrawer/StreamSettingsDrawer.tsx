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

import React, { useState } from "react";

export const StreamSettingsDrawer = createModal(() => {
  const [openScheduling, setOpenScheduling] = useState(true);
  const [openConfiguration, setOpenConfiguration] = useState(false);

  return (
    <StyledStreamSettings gap={15}>
      <ScrollableDrawerContent gap={12}>
        {/* Scheduling Section */}
        <CollapsibleSection>
          <SectionHeader
            onClick={() => {
              setOpenScheduling((open) => {
                if (!open) setOpenConfiguration(false);
                return !open;
              });
            }}
            active={openScheduling}
          >
            <span>Stream Scheduling</span>
            <ChevronIcon open={openScheduling}>
              <svg viewBox="0 0 16 16">
                <polyline
                  points="5,6 8,9 11,6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </ChevronIcon>
          </SectionHeader>
          {openScheduling && (
            <SectionBody>
              <StartAtSetting />
              <StyledHelpText>
                Start is when to start token streaming, 0 for now
              </StyledHelpText>
              <IntervalSetting />
              <StyledHelpText>
                Interval is how much time between stream executions, or 0 for
                one time.
              </StyledHelpText>
              <DurationSetting />
              <StyledHelpText>
                Duration is how long to stream after starting.
              </StyledHelpText>
            </SectionBody>
          )}
        </CollapsibleSection>

        {/* Configuration Section */}
        <CollapsibleSection>
          <SectionHeader
            onClick={() => {
              setOpenConfiguration((open) => {
                if (!open) setOpenScheduling(false);
                return !open;
              });
            }}
            active={openConfiguration}
          >
            <span>Stream Configuration</span>
            <ChevronIcon open={openConfiguration}>
              <svg viewBox="0 0 16 16">
                <polyline
                  points="5,6 8,9 11,6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </ChevronIcon>
          </SectionHeader>
          {openConfiguration && (
            <SectionBody>
              <EmailSetting />
              <MinAssetOutPercentSetting />
              <StreamModeSetting />
            </SectionBody>
          )}
        </CollapsibleSection>
      </ScrollableDrawerContent>
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

const ScrollableDrawerContent = styled(Column)`
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 2px;
`;

const CollapsibleSection = styled.div`
  border: 1px solid #eee;
  border-radius: 12px;
  margin-bottom: 8px;
  background: ${({ theme }) => theme.primary.background.normal};
  @media (prefers-color-scheme: dark) {
    border: 1px solid rgba(255, 255, 255, 0.04);
  }
`;

const ChevronIcon = styled.span<{ open: boolean }>`
  display: inline-block;
  margin-left: 8px;
  transition: transform 0.2s;
  transform: rotate(${({ open }) => (open ? 90 : 0)}deg);
  svg {
    display: block;
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
`;

const SectionHeader = styled.div<{ active: boolean }>`
  cursor: pointer;
  font-weight: 600;
  padding: 10px 8px;
  color: ${({ theme }) => theme.primary.text.normal};
  background: ${({ active, theme }) =>
    active ? theme.primary.background.normal : "transparent"};
  border-bottom: 1px solid #eee;
  border-radius: 12px 12px 0 0;
  user-select: none;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @media (prefers-color-scheme: dark) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
`;

const SectionBody = styled.div`
  padding-left: 8px;
  padding-right: 8px;
  background: ${({ theme }) => theme.primary.background.normal};
`;

const StyledStreamSettings = styled(Column)`
  width: 100%;
  padding: 20px;
  border-radius: 20px;
  background: ${(props) => props.theme.primary.background.normal};
`;

const StyledHelpText = styled(SmallText)`
  padding-bottom: 10px;
  padding-left: 4px;
  padding-right: 4px;
  font-size: 11px;
  color: ${(props) => props.theme.neutral?.text.secondary || "#888"};
  line-height: 1.4;
`;
