import React from "react";
import { useAtom } from "jotai";
import { streamSettingsAtom } from "@/state/streamSettings";
import { Row, Column } from "@/components/Layout";
import { SmallText } from "@/components/Typography";
import { Tooltip } from "@/components/Tooltip";
import styled from "styled-components";

const options = [
  { value: -1, label: "No change" },
  { value: -20, label: "-20%" },
  { value: -10, label: "-10%" },
  { value: 0, label: "0%" },
  { value: 5, label: "+5%" },
  { value: 10, label: "+10%" },
  { value: 20, label: "+20%" },
];

export const MinAssetOutPercentSetting: React.FC = () => {
  const [settings, setSettings] = useAtom(streamSettingsAtom);
  const value = settings.minAssetOutPercent;

  // Find the closest option index
  const currentIdx = options.findIndex((opt) => opt.value === value);
  const sliderIdx = currentIdx === -1 ? 0 : currentIdx;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setSettings((s) => ({ ...s, minAssetOutPercent: options[idx].value }));
  };

  return (
    <Column gap={8}>
      <Row gap={6} align="center">
        <SmallText>Min Asset Out %</SmallText>
        <Tooltip
          content={
            <SmallText normalTextColor textWrap="nowrap">
              The minimum amount of asset you want to receive after slippage.
              <br />
              <b>No change</b>: disables min asset out check.
              <br />
              Choose a percentage to require at least that much output.
              <br />
              Useful for protecting against MEV or price swings.
            </SmallText>
          }
        >
          <span style={{ cursor: "help", color: "#888" }}>ⓘ</span>
        </Tooltip>
      </Row>
      <SliderWrap>
        <Labels>
          {options.map((opt, i) => (
            <SliderLabel key={opt.value} selected={i === sliderIdx}>
              {opt.label}
            </SliderLabel>
          ))}
        </Labels>
        <StyledSlider
          min={0}
          max={options.length - 1}
          step={1}
          value={sliderIdx}
          onChange={handleSlider}
        />
      </SliderWrap>
      <Row justify="center">
        <CurrentValuePill>{options[sliderIdx].label}</CurrentValuePill>
      </Row>
    </Column>
  );
};

const SliderWrap = styled.div`
  width: 100%;
  padding: 8px 0 0 0;
`;
const Labels = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
`;
const SliderLabel = styled.span<{ selected: boolean }>`
  font-size: 12px;
  color: ${({ selected, theme }) =>
    selected
      ? theme.brandColor || "#007aff"
      : theme.neutral?.text.secondary || "#aaa"};
  font-weight: ${({ selected }) => (selected ? 600 : 400)};
  transition: color 0.2s;
`;
const StyledSlider = styled.input.attrs({ type: "range" })`
  width: 100%;
  accent-color: ${({ theme }) => theme.brandColor || "#007aff"};
  height: 3px;
  border-radius: 6px;
  background: ${({ theme }) => theme.primary.background.normal || "#f1f1f1"};
  margin-bottom: 2px;
`;
const CurrentValuePill = styled.span`
  display: inline-block;
  margin-top: 6px;
  padding: 3px 14px;
  border-radius: 14px;
  background: ${({ theme }) => theme.primary.background.normal || "#f1f1f1"};
  color: ${({ theme }) => theme.brandColor || "#007aff"};
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
`;
