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
export const DurationSetting = () => {
  const [settings, setSettings] = useAtom(streamSettingsAtom);
  const seconds = settings.duration;

  // Automatically determine the best unit to display
  let unitInSeconds: number;
  let unit: string;

  if (seconds < 3600) {
    // Less than 1 hour
    unitInSeconds = 60;
    unit = "minutes";
  } else if (seconds < 86400) {
    // Less than 1 day
    unitInSeconds = 3600;
    unit = "hours";
  } else {
    // 1 day or more
    unitInSeconds = 86400;
    unit = "days";
  }

  // Convert to display value
  const displayValue = formatNumberWithCommas(seconds / unitInSeconds);

  const handleDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let latest = event.target.value;
    if (latest.match(/^[.,]/)) latest = `0.${latest}`;
    latest = latest.replace(/^[0]{2,}/, "0");
    latest = latest.replace(/[^\d.,]/g, "");
    latest = latest.replace(/[.]{2,}/g, ".");
    latest = latest.replace(/[,]{2,}/g, ",");

    if (!latest.endsWith(".")) {
      let maxValue: number;
      if (unit === "minutes") {
        maxValue = 10080; // 1 week in minutes
      } else if (unit === "hours") {
        maxValue = 168; // 1 week in hours
      } else {
        // days
        maxValue = 365; // 1 year in days
      }
      latest = Math.max(
        0,
        Math.min(maxValue, +formatNumberWithoutCommas(latest))
      ).toString();
    }

    const newSeconds = BigNumber(latest).times(unitInSeconds).toNumber();

    setSettings((prev) => ({
      ...prev,
      duration: newSeconds,
    }));
  };

  return (
    <Column gap={10}>
      <SwapDetailText>Duration</SwapDetailText>
      <Column gap={10}>
        <Row justify="space-between" align="center" gap={10}>
          <SmallText>for</SmallText>
          <StyledInput
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleDurationChange}
          />
          <SmallText>{unit}</SmallText>
          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, duration: 3600 }))} // 1 hour
          >
            1 hour
          </SmallTextButton>

          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, duration: 86400 }))} // 1 day
          >
            1 day
          </SmallTextButton>
          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, duration: 604800 }))} // 1 week
          >
            1 week
          </SmallTextButton>
          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, duration: 1209600 }))} // 2 weeks
          >
            2 weeks
          </SmallTextButton>
          <SmallTextButton
            onClick={() => setSettings((s) => ({ ...s, duration: 2592000 }))} // 30 days
          >
            30 days
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
