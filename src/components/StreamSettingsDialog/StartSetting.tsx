import { BigNumber } from "bignumber.js";

import { useStreamSettingsStore } from "@/context/intento-settings";
import { formatNumberWithCommas, formatNumberWithoutCommas } from "@/utils/number";
import { cn } from "@/utils/ui";
const OPTION_VALUES = ["0", "86400", "259200"];
const OPTION_KEYS = ["Right Away", "1 day", "1 week"];

export const StartSetting = () => {
  const currentValue = useStreamSettingsStore((state) => state.startAt);

  return (
    <div className="flex items-center space-x-2 p-2">
      <h3>Start</h3>
      <div className="flex-grow" />
      <div className="flex w-full max-w-32 flex-col items-stretch gap-1">
        <div className="relative text-sm">
          <input
            className={cn(
              "rounded-lg border px-2 py-1 text-end tabular-nums transition",
              "w-full pe-5 number-input-arrows-hide",
            )}
            type="text"
            inputMode="numeric"
            value={formatNumberWithCommas(BigNumber(currentValue).div(BigNumber(86400)).toString())}
            onChange={(event) => {
              let latest = event.target.value;

              if (latest.match(/^[.,]/)) latest = `0.${latest}`; // Handle first character being a period or comma
              latest = latest.replace(/^[0]{2,}/, "0"); // Remove leading zeros
              latest = latest.replace(/[^\d.,]/g, ""); // Remove non-numeric and non-decimal characters
              latest = latest.replace(/[.]{2,}/g, "."); // Remove multiple decimals
              latest = latest.replace(/[,]{2,}/g, ","); // Remove multiple commas

              if (!latest.endsWith(".")) {
                latest = Math.max(0, Math.min(100, +formatNumberWithoutCommas(latest))).toString();
              }
              useStreamSettingsStore.setState({ startAt: BigNumber(latest).times(BigNumber(86400)).toString() });
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.select();
                return;
              }

              let value = BigNumber(formatNumberWithoutCommas(event.currentTarget.value) || "0");

              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                if (event.key === "ArrowUp") {
                  if (event.shiftKey) {
                    value = value.plus(10);
                  } else if (event.altKey || event.ctrlKey || event.metaKey || value.lt(1)) {
                    value = value.plus(0.1);
                  } else {
                    value = value.plus(1);
                  }
                }
                if (event.key === "ArrowDown") {
                  if (event.shiftKey) {
                    value = value.minus(10);
                  } else if (event.altKey || event.ctrlKey || event.metaKey || value.lte(1)) {
                    value = value.minus(0.1);
                  } else {
                    value = value.minus(1);
                  }
                }
                if (value.isNegative()) {
                  value = BigNumber(0);
                }
                useStreamSettingsStore.setState({ startAt: value.times(BigNumber(86400)).toString() });
              }
            }}
          />
          <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs">days</div>
        </div>
        <div className="grid  gap-1">
          {OPTION_VALUES.map((value, i) => (
            <button
              key={i}
              className={cn(
                "rounded-lg border px-2 py-px text-xs tabular-nums transition",
                "text-neutral-600 hover:bg-neutral-100",
              )}
              onClick={() => useStreamSettingsStore.setState({ startAt: value })}
            >
              {OPTION_KEYS[i]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
