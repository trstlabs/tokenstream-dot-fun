import { WifiIcon } from "@heroicons/react/20/solid";
import { ComponentProps } from "react";

import { disclosure } from "@/context/disclosures";
import { cn } from "@/utils/ui";

import { SimpleTooltip } from "./SimpleTooltip";

export const StreamSettingsButton = ({ className, ...props }: ComponentProps<"button">) => {
  return (
    <SimpleTooltip label="Stream Settings">
      <button
        className={cn(
          "rounded-full p-2 text-black/80 hover:bg-neutral-100 hover:text-black/100",
          "transition-colors focus:outline-none",
          className,
        )}
        onClick={() => disclosure.open("streamSettingsDialog")}
        role="group"
        {...props}
      >
        <WifiIcon className="h-4 w-4" />
      </button>
    </SimpleTooltip>
  );
};
