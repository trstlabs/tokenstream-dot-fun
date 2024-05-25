import { WifiIcon } from "@heroicons/react/20/solid";
import { BigNumber } from "bignumber.js";

import { useDisclosureKey } from "@/context/disclosures";
import { useStreamSettingsStore } from "@/context/intento-settings";

interface Props {
  onGoBack: () => void;
  message?: string;
  title?: string;
}

export const StreamOption = ({ onGoBack, message = "", title = "" }: Props) => {
  const { interval, startAt, duration } = useStreamSettingsStore();
  const [isOpen, control] = useDisclosureKey("streamDialog");
  if (!isOpen || title === "") return null;

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto rounded-3xl bg-white p-6 scrollbar-hide">
      <div className="flex-grow pt-8">
        <div className="flex justify-center py-16 text-blue-400">
          <WifiIcon className="h-24 w-24" />
        </div>
        <h3 className="mb-2 text-center text-lg font-bold tabular-nums text-blue-500">{title}</h3>
        <p className="px-4 text-center text-lg tabular-nums leading-snug text-neutral-500">{message}</p>
        <p className="px-4 text-center text-lg tabular-nums leading-snug text-neutral-500">
          Swap{" "}
          {startAt == "0"
            ? " right Away "
            : startAt == "86400"
              ? " in one day "
              : "In " + BigNumber(startAt).div(BigNumber(86400)).toString() + " days "}
          {duration != "0" &&
            "for " +
              (duration == "86400" ? "one day" : BigNumber(duration).div(BigNumber(86400)).toString() + " days")}{" "}
          {interval != "0" &&
            "every " + (interval == "86400" ? "day" : BigNumber(interval).div(BigNumber(86400)).toString() + " days ")}
        </p>
        <p className="px-4  pt-2 text-center text-lg tabular-nums leading-snug text-neutral-500">
          Do you want to continue or swap once?
        </p>
      </div>

      <div className="flex items-end gap-1">
        <button
          className="bborder-neutral-400 w-full rounded-lg border py-4 font-semibold text-neutral-500  transition-colors hover:bg-[#ed1149]"
          onClick={() => {
            control.close();
            onGoBack();
          }}
        >
          Go Back
        </button>
        <button
          className="w-full rounded-lg border border-neutral-400 py-4 font-semibold text-neutral-500 transition-colors hover:bg-neutral-100"
          onClick={() => {
            useStreamSettingsStore.setState({ shouldStream: false }), control.close();
          }}
        >
          Swap Once
        </button>
        <button
          className="w-full rounded-lg border border-neutral-400 bg-[#16537e] py-4 font-semibold text-white transition-colors hover:bg-[#6aa84f]"
          onClick={() => {
            useStreamSettingsStore.setState({ shouldStream: true }), control.close();
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
};
