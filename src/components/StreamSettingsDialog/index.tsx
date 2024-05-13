import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import * as Dialog from "@radix-ui/react-dialog";

import { useDisclosureKey } from "@/context/disclosures";

import { AdaptiveLink } from "../AdaptiveLink";

import { SaveIndicator } from "./SaveIndicator";
import { IntervalSetting } from "./IntervalSetting";
import { StartSetting } from "./StartSetting";
import { DurationSetting } from "./DurationSetting";
export const StreamSettingsDialog = () => {
  const [isOpen, { close }] = useDisclosureKey("streamSettingsDialog");
  return (
    <Dialog.Root
      modal
      open={isOpen}
    >
      <Dialog.Content className="absolute inset-0 animate-fade-zoom-in rounded-3xl bg-white">
        <div className="h-full overflow-y-auto px-4 py-6 scrollbar-hide">
          <div className="flex items-center gap-4 pb-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-neutral-100"
              onClick={close}
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <h3 className="text-xl font-bold">Stream Settings</h3>
            <div className="flex-grow" />
            <SaveIndicator />
          </div>
          <StartSetting />
          <p className="text-balance p-1 text-xs text-neutral-500 [&_a:hover]:underline [&_a]:text-red-500">
            Start is when to start swap streaming
            <br />
          </p>
          <IntervalSetting />
          <p className="text-balance p-1 text-xs text-neutral-500 [&_a:hover]:underline [&_a]:text-red-500">
            Interval is how much time between stream executions, or 0 for one time.
            <br />
          </p>
          <DurationSetting />
          <p className="text-balance p-1 text-xs text-neutral-500 [&_a:hover]:underline [&_a]:text-red-500">
            Duration is for how long to swap stream after starting, or 0 for one time.
            <br />
          </p>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
