import { useAtom } from "jotai";
import { BigNumber } from "bignumber.js";
import {
  formatNumberWithCommas,
  formatNumberWithoutCommas,
} from "@/utils/number";
import { SmallText, SmallTextButton } from "@/components/Typography";
import { Row, Column } from "@/components/Layout";
import { styled } from "styled-components";
import { streamSettingsAtom } from "@/state/streamSettings";
import { useStreamValidation } from "@/hooks/useStreamValidation";

export const IntervalSetting = () => {
  const [settings, setSettings] = useAtom(streamSettingsAtom);
  const seconds = settings.interval;
  const { isDurationValid } = useStreamValidation();

  // Automatically determine the best unit to display
  let unitInSeconds: number;
  let unit: string;

  if (seconds < 3600) {
    // Less than 1 hour
    unitInSeconds = 60;
    unit = "minutes";
  } else if (seconds < 86400) {
    // 1 hour or more but less than 1 day
    unitInSeconds = 3600;
    unit = "hours";
  } else {
    // 1 day or more
    unitInSeconds = 86400;
    unit = "days";
  }

  // Convert to display value
  const displayValue = formatNumberWithCommas(seconds / unitInSeconds);

  const handleIntervalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        maxValue = 30; // 30 days max
      }
      latest = Math.max(
        0,
        Math.min(maxValue, +formatNumberWithoutCommas(latest))
      ).toString();
    }

    const newSeconds = BigNumber(latest).times(unitInSeconds).toNumber();

    setSettings((prev) => ({
      ...prev,
      interval: newSeconds,
    }));
  };

  return (
    <Column gap={10}>
      <Row justify="space-between" align="center" gap={10}>
        <SmallText>each</SmallText>
        <StyledInput
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleIntervalChange}
          $hasError={!isDurationValid}
        />
        <SmallText>{unit}</SmallText>

        <SmallTextButton
          onClick={() => setSettings((s) => ({ ...s, interval: 600 }))}
        >
          10 min
        </SmallTextButton>
        <SmallTextButton
          onClick={() => setSettings((s) => ({ ...s, interval: 1800 }))}
        >
          30 min
        </SmallTextButton>
        <SmallTextButton
          onClick={() => setSettings((s) => ({ ...s, interval: 3600 }))}
        >
          1 hour
        </SmallTextButton>
        <SmallTextButton
          onClick={() => setSettings((s) => ({ ...s, interval: 86400 }))}
        >
          1 day
        </SmallTextButton>
        <SmallTextButton
          onClick={() => setSettings((s) => ({ ...s, interval: 604800 }))}
        >
          1 week
        </SmallTextButton>
      </Row>
    </Column>
  );
};

const StyledInput = styled.input<{ $hasError?: boolean }>`
  font-size: 14px;
  font-family: "ABCDiatype", sans-serif;
  height: 32px;
  width: 80px;
  text-align: right;
  border: 1px solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.error.text : theme.primary.text.ultraLowContrast};
  border-radius: 6px;
  padding: 0 8px;
  background: ${({ theme, $hasError }) =>
    $hasError ? theme.error.background : theme.secondary.background.normal};
  color: ${({ theme }) => theme.primary.text.normal};
  outline: none;
  transition:
    border-color 0.2s,
    background-color 0.2s;

  &:focus {
    border-color: ${({ theme, $hasError }) =>
      $hasError ? theme.error.text : theme.primary.text.lowContrast};
  }
`;
