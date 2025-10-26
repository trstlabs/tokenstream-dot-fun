import { styled, useTheme } from "styled-components";
import { Column } from "@/components/Layout";
import { useAtomValue } from "jotai";
import { SwapExecutionPageRouteSimpleRow } from "./SwapExecutionPageRouteSimpleRow";
import { BridgeArrowIcon } from "@/icons/BridgeArrowIcon";
import { ICONS } from "@/icons";
import { ClientOperation } from "@/utils/clientType";
import { swapExecutionStateAtom } from "@/state/swapExecutionPage";
import { SwapExecutionState } from "./SwapExecutionPage";
import { useMemo } from "react";
import { streamSettingsAtom } from "@/state/streamSettings";
import { SwapExecutionPageRouteSimpleRowIntento } from "./SwapExecutionPageRouteSimpleRowIntento";

import { RouteDetails, TransferEventStatus } from "@skip-go/client";

export type SwapExecutionPageRouteProps = {
  operations: ClientOperation[];
  onClickEditDestinationWallet?: () => void;
  statusData?: RouteDetails;
  swapExecutionState?: SwapExecutionState;
  firstOperationStatus?: TransferEventStatus | undefined;
  secondOperationStatus?: TransferEventStatus | undefined;
  bottomContent?: React.ReactNode;
};

export const SwapExecutionPageRouteSimple = ({
  operations,
  statusData,
  onClickEditDestinationWallet,
  swapExecutionState,
  firstOperationStatus,
  bottomContent,
}: SwapExecutionPageRouteProps) => {
  const theme = useTheme();
  const { route } = useAtomValue(swapExecutionStateAtom);
  const { interval, duration, shouldStream, streamMode, startAt } =
    useAtomValue(streamSettingsAtom);
  const firstOperation = operations[0];
  const lastOperation = operations[operations.length - 1];
  const status = statusData?.transferEvents;

  let recurrences =
    shouldStream && interval && duration ? Math.floor(duration / interval) : 1;

  if (startAt != undefined && startAt > 0) {
    recurrences = recurrences + 1;
  }

  const destinationStatus = useMemo(() => {
    const destinationStatus = status?.[lastOperation.transferIndex]?.status;
    if (swapExecutionState === SwapExecutionState.confirmed && !shouldStream) {
      return "completed";
    }

    if (destinationStatus && !shouldStream) return destinationStatus;

    if (firstOperationStatus === "completed" && !shouldStream) {
      return "pending";
    }
  }, [
    firstOperationStatus,
    lastOperation.transferIndex,
    status,
    swapExecutionState,
  ]);

  const source = {
    denom: firstOperation.denomIn,
    tokenAmount:
      shouldStream && streamMode === "RECUR_INPUT"
        ? (Number(firstOperation.amountIn) * recurrences).toString()
        : firstOperation.amountIn,
    chainId: firstOperation.fromChainId ?? firstOperation.chainId,
    usdValue:
      shouldStream && streamMode === "RECUR_INPUT"
        ? (Number(route?.usdAmountIn) * recurrences).toString()
        : route?.usdAmountIn,
  };

  const intentoFlow = {
    denom: firstOperation.denomIn,
    tokenAmount:
      shouldStream && streamMode === "RECUR_INPUT"
        ? (Number(firstOperation.amountIn) * recurrences).toString()
        : firstOperation.amountIn,
    chainId: firstOperation.fromChainId ?? firstOperation.chainId,
    usdValue:
      shouldStream && streamMode === "RECUR_INPUT"
        ? (Number(route?.usdAmountIn) * recurrences).toString()
        : route?.usdAmountIn,
    // denom: originalRoute?.sourceAssetDenom,
    // tokenAmount: originalRoute?.amountIn ?? "",
    // chainId: originalRoute?.sourceAssetChainId,
    // usdValue: originalRoute?.usdAmountIn,
  };

  const destination = {
    denom: lastOperation.denomOut,
    tokenAmount:
      shouldStream && streamMode === "RECUR_INPUT"
        ? (Number(lastOperation.amountOut) * recurrences).toString()
        : lastOperation.amountOut,
    chainId: lastOperation.toChainId ?? lastOperation.chainId,
    usdValue:
      shouldStream && streamMode === "RECUR_INPUT"
        ? (Number(route?.usdAmountOut) * recurrences).toString()
        : route?.usdAmountOut,
  };

  const sourceExplorerLink =
    status?.[firstOperation.transferIndex]?.fromExplorerLink;
  const destinationExplorerLink =
    status?.[lastOperation.transferIndex]?.toExplorerLink;

  return (
    <StyledSwapExecutionPageRoute justify="space-between">
      <SwapExecutionPageRouteSimpleRow
        {...source}
        status={firstOperationStatus}
        context="source"
        explorerLink={sourceExplorerLink}
      />
      <StyledBridgeArrowIcon color={theme.primary.text.normal} />
      {shouldStream && (
        <SwapExecutionPageRouteSimpleRowIntento
          {...intentoFlow}
          status={firstOperationStatus}
          explorerLink={sourceExplorerLink}
          recurrences={recurrences}
        />
      )}
      <StyledBridgeArrowIcon color={theme.primary.text.lowContrast} />
      <SwapExecutionPageRouteSimpleRow
        {...destination}
        icon={ICONS.pen}
        status={destinationStatus}
        onClickEditDestinationWallet={onClickEditDestinationWallet}
        explorerLink={destinationExplorerLink}
        context="destination"
        isSwapStream={shouldStream && source.denom !== destination.denom}
      />
      {bottomContent}
    </StyledSwapExecutionPageRoute>
  );
};

const StyledBridgeArrowIcon = styled(BridgeArrowIcon)`
  height: 18px;
  width: 54px;
`;

const StyledSwapExecutionPageRoute = styled(Column)`
  padding: 30px;
  min-height: 225px;
`;
