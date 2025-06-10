import { Modals } from "@/modals/registerModals";
import { SwapPageFooterItemsProps } from "@/pages/SwapPage/SwapPageFooter";
import { StreamSettingsFooter } from "@/pages/SwapPage/StreamSettingsFooter";
import { skipRouteAtom } from "@/state/route";
import { settingsDrawerAtom } from "@/state/settingsDrawer";
import { goFastWarningAtom, isWaitingForNewRouteAtom } from "@/state/swapPage";
import { track } from "@amplitude/analytics-browser";
import NiceModal from "@ebay/nice-modal-react";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useState } from "react";

export const useStreamSettingsDrawer = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const settingsDrawer = useAtomValue(settingsDrawerAtom);
  const { isError: isRouteError, data: route } = useAtomValue(skipRouteAtom);
  const isWaitingForNewRoute = useAtomValue(isWaitingForNewRouteAtom);
  const setShowGoFastErrorAtom = useSetAtom(goFastWarningAtom);

  const StreamSettingsFooterSwapPage = ({
    content,
    ...props
  }: SwapPageFooterItemsProps) => {
    const openSettingsDrawer = () => {
      // Only open if streaming is possible
      if (isRouteError || isWaitingForNewRoute || route === undefined) {
        return;
      }
      track("streamsettings drawer - clicked");
      setShowGoFastErrorAtom(false);
      NiceModal.show(Modals.StreamSettingsDrawer, {
        drawer: true,
        container: settingsDrawer,
        onOpenChange: (open: boolean) => {
          if (open) {
            setDrawerOpen(true);
          } else {
            track("streamsettings drawer - closed");
            setDrawerOpen(false);
          }
        },
      });
    };


    // Only render the trigger if streaming is possible
    if (isRouteError || isWaitingForNewRoute || route === undefined) {
      return null;
    }
    return (
      <StreamSettingsFooter
        onClick={openSettingsDrawer}
        {...props}
      />
    );
  };

  return { StreamSettingsFooterSwapPage, drawerOpen };
};
