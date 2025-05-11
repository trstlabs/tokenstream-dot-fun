// StreamExecutionButton.tsx
import { MainButton } from "@/components/MainButton";
import { ICONS } from "@/icons";
import { SwapExecutionState } from "./SwapExecutionPage";
import pluralize from "pluralize";
import { convertSecondsToMinutesOrHours } from "@/utils/number";
import { useSetAtom } from "jotai";
import { clearAssetInputAmountsAtom } from "@/state/swapPage";
import { currentPageAtom, Routes } from "@/state/router";
import { errorAtom, ErrorType } from "@/state/errorPage";
import NiceModal from "@ebay/nice-modal-react";
import { Modals } from "@/modals/registerModals";
import { RouteResponse } from "@skip-go/client";
import { ClientOperation } from "@/utils/clientType";
import { GoFastSymbol } from "@/components/GoFastSymbol";
import { useIsGoFast } from "@/hooks/useIsGoFast";
import { useCountdown } from "./useCountdown";
import { track } from "@amplitude/analytics-browser";
import { useCallback } from "react";

import {
  createStreamMessagesAtom,
  expectedStreamFeesAtom,
} from "@/state/swapExecutionPage";
import { Row } from "@/components/Layout";

type SwapExecutionButtonProps = {
  swapExecutionState: SwapExecutionState | undefined;
  route: RouteResponse | undefined;
  signaturesRemaining: number;
  lastOperation: ClientOperation;
  connectRequiredChains: (openModal?: boolean) => Promise<void>;
  submitExecuteRouteMutation: () => void;
  msgTransferAtomToIntentoMutation: () => void;
};

export const StreamExecutionButton: React.FC<SwapExecutionButtonProps> = ({
  swapExecutionState,
  route,
  signaturesRemaining,
  lastOperation,
  connectRequiredChains,
  submitExecuteRouteMutation,
  msgTransferAtomToIntentoMutation,
}) => {
  const countdown = useCountdown({
    estimatedRouteDurationSeconds: route?.estimatedRouteDurationSeconds,
    swapExecutionState,
  });

  const setError = useSetAtom(errorAtom);
  const setCurrentPage = useSetAtom(currentPageAtom);
  const clearAssetInputAmounts = useSetAtom(clearAssetInputAmountsAtom);
  const isGoFast = useIsGoFast(route);
  const triggerCreateStreamMessages = useSetAtom(createStreamMessagesAtom);
  const setExpectedStreamFees = useSetAtom(expectedStreamFeesAtom);
  const getDestinationAddreessUnsetText = useCallback(() => {
    const destinationChainIdHasSignRequired =
      lastOperation.signRequired &&
      lastOperation.fromChainID === route?.destAssetChainID;

    if (destinationChainIdHasSignRequired && route?.txsRequired === 2) {
      return "Set second signing address";
    }
    return "Set destination address";
  }, [
    lastOperation.fromChainID,
    lastOperation.signRequired,
    route?.destAssetChainID,
    route?.txsRequired,
  ]);

  switch (swapExecutionState) {
    case SwapExecutionState.recoveryAddressUnset:
      return (
        <MainButton
          label="Set intermediary address"
          icon={ICONS.rightArrow}
          onClick={() => {
            track("swap execution page: set recovery address button - clicked");
            connectRequiredChains(true);
          }}
        />
      );
    case SwapExecutionState.destinationAddressUnset:
      return (
        <MainButton
          label={getDestinationAddreessUnsetText()}
          icon={ICONS.rightArrow}
          onClick={() => {
            track(
              "swap execution page: set destination address button - clicked"
            );
            const destinationChainID = route?.destAssetChainID;
            if (!destinationChainID) return;
            NiceModal.show(Modals.SetAddressModal, {
              signRequired: lastOperation.signRequired,
              chainId: destinationChainID,
              chainAddressIndex: route.requiredChainAddresses.length - 1,
            });
          }}
        />
      );
    case SwapExecutionState.ready: {
      track("swap execution page: confirm button - clicked", { route });

      const onClickConfirmSwap = async () => {
        if (route?.txsRequired && route.txsRequired > 1) {
          track("error page: additional signing required", { route });
          setError({
            errorType: ErrorType.AdditionalSigningRequired,
            onClickContinue: async () => {
              await triggerCreateStreamMessages(); // ⬅ await here
              submitExecuteRouteMutation();
            },
            signaturesRequired: route.txsRequired,
          });
          return;
        }

        await triggerCreateStreamMessages(); // ⬅ await here
        submitExecuteRouteMutation();
      };

      return (
        <MainButton
          label="Confirm"
          icon={ICONS.rightArrow}
          onClick={onClickConfirmSwap}
        />
      );
    }
    case SwapExecutionState.validatingGasBalance:
      return <MainButton label="Validating" icon={ICONS.rightArrow} loading />;
    case SwapExecutionState.waitingForSigning:
      return <MainButton label="Confirming" icon={ICONS.rightArrow} loading />;
    case SwapExecutionState.approving:
      return (
        <MainButton
          label="Approving allowance"
          icon={ICONS.rightArrow}
          loading
        />
      );
    case SwapExecutionState.pending:
      return (
        <MainButton
          label="Processing"
          loading
          isGoFast={isGoFast}
          extra={isGoFast && <GoFastSymbol />}
          loadingTimeString={convertSecondsToMinutesOrHours(countdown)}
        />
      );
    case SwapExecutionState.signaturesRemaining:
      return (
        <MainButton
          label={`${signaturesRemaining} ${pluralize(
            "signature",
            signaturesRemaining
          )} ${signaturesRemaining > 1 ? "are" : "is"} still required`}
          loading
          loadingTimeString={convertSecondsToMinutesOrHours(countdown)}
        />
      );
    //todo only show if balance is enough
    case SwapExecutionState.confirmed:
      return (
        <>
          <Row
            justify="center"
            align="center"
            gap={20}
            style={{ marginTop: "10px" }}
          >
            <MainButton
              label="Fund ATOM"
              icon={ICONS.rightArrow}
              onClick={() => {
                track("swap execution page: fund atom button - clicked");
                msgTransferAtomToIntentoMutation();
                //todo check if balance is enough now
                setExpectedStreamFees([]);
              }}
            />
            <MainButton
              label="Fund INTO"
              icon={ICONS.rightArrow}
              onClick={() => {
                track("swap execution page: fund button - clicked");
                clearAssetInputAmounts();
                setCurrentPage(Routes.SwapPage);
              }}
            />
          </Row>
        </>
      );
    case SwapExecutionState.pendingGettingAddresses:
      return <MainButton label="Getting addresses" loading />;

    default:
      return null;
  }
};
