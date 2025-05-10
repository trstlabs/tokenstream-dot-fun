import { useAtom } from "jotai";
import { BigNumber } from "bignumber.js";
import {
  formatNumberWithCommas,
  formatNumberWithoutCommas,
} from "@/utils/number";
import { SmallText, SmallTextButton } from "@/components/Typography";
import { Row, Column } from "@/components/Layout";
import { css, styled } from "styled-components";
import { streamSettingsAtom } from "@/state/streamSettings";
import { useTheme } from "styled-components";
import { useMemo } from "react";
export const StartAtSetting = () => {
  const [settings, setSettings] = useAtom(streamSettingsAtom);
  const seconds = settings.startAt;

  // Decide the display unit
  const isInHours = seconds < 86400;
  const unit = isInHours ? "hours" : "days";
  const unitInSeconds = isInHours ? 3600 : 86400;

  // Convert to display value
  const displayValue = formatNumberWithCommas(seconds / unitInSeconds);

  const handleStartAtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let latest = event.target.value;
    if (latest.match(/^[.,]/)) latest = `0.${latest}`;
    latest = latest.replace(/^[0]{2,}/, "0");
    latest = latest.replace(/[^\d.,]/g, "");
    latest = latest.replace(/[.]{2,}/g, ".");
    latest = latest.replace(/[,]{2,}/g, ",");

    if (!latest.endsWith(".")) {
      latest = Math.max(
        0,
        Math.min(100, +formatNumberWithoutCommas(latest))
      ).toString();
    }

    const newSeconds = BigNumber(latest).times(unitInSeconds).toNumber();

    setSettings((prev) => ({
      ...prev,
      startAt: newSeconds,
    }));
  };
  const theme = useTheme();
  const nowColor = useMemo(() => {
    if (seconds === 0) {
      return theme.primary.text.normal;
    }

    return theme.primary.text.ultraLowContrast;
  }, [seconds, theme.primary.text, theme.primary.text.ultraLowContrast]);

  return (
    <Column gap={10}>
      <SwapDetailText>Start</SwapDetailText>
      <Column gap={10}>
        <Row justify="space-between" align="center" gap={10}>
          <SmallText>in</SmallText>
          <StyledInput
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleStartAtChange}
          />
          <SmallText>{unit}</SmallText>

          {/* Quick Set Buttons (all in days) */}
          <SmallTextButton
            color={nowColor}
            onClick={() => setSettings((s) => ({ ...s, startAt: 0 }))}
          >
            Now
          </SmallTextButton>
          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, startAt: 3600 }))}
          >
            1 hour
          </SmallTextButton>
          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, startAt: 86400 }))}
          >
            1 day
          </SmallTextButton>
          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, startAt: 604800 }))}
          >
            1 week
          </SmallTextButton>
        </Row>
      </Column>
    </Column>
  );
};

const SwapDetailText = styled(Row).attrs({
  as: SmallText,
  normalTextColor: true,
})`
  position: relative;
  letter-spacing: 0.26px;
`;

const StyledInput = styled.input<{ validAddress?: boolean }>`
  font-size: 12px;
  font-family: "ABCDiatype", sans-serif;
  height: 40px;
  width: 20%;
  box-sizing: border-box;
  outline: none;
  padding: 8px 40px 8px 15px;
  border: 1px solid ${({ theme }) => theme.primary.text.ultraLowContrast};
  background: ${({ theme }) => theme.secondary.background.normal};
  color: ${({ theme }) => theme.primary.text.normal};
  border-radius: 6px;

  ${({ validAddress, theme }) =>
    validAddress === false &&
    css`
      border-color: ${theme.error.text};
      background: ${theme.error.background};
    `}
`;
