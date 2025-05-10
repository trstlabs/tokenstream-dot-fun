import { styled, useTheme } from "styled-components";
import { Column } from "@/components/Layout";
import { useAtomValue } from "jotai";
import { SwapExecutionPageRouteSimpleRow } from "./SwapExecutionPageRouteSimpleRow";
import { BridgeArrowIcon } from "@/icons/BridgeArrowIcon";
import { ICONS } from "@/icons";
import { ClientOperation, SimpleStatus } from "@/utils/clientType";
import { swapExecutionStateAtom } from "@/state/swapExecutionPage";
import { TxsStatus } from "./useBroadcastedTxs";
import { SwapExecutionState } from "./SwapExecutionPage";
import { useMemo } from "react";
import { streamSettingsAtom } from "@/state/streamSettings";
import { SwapExecutionPageRouteSimpleRowIntento } from "./SwapExecutionPageRouteSimpleRowIntento";

export type SwapExecutionPageRouteProps = {
  operations: ClientOperation[];
  onClickEditDestinationWallet?: () => void;
  statusData?: TxsStatus;
  swapExecutionState?: SwapExecutionState;
  firstOperationStatus?: SimpleStatus | undefined;
  secondOperationStatus?: SimpleStatus | undefined;
};

export const SwapExecutionPageRouteSimple = ({
  operations,
  statusData,
  onClickEditDestinationWallet,
  swapExecutionState,
  firstOperationStatus,
}: SwapExecutionPageRouteProps) => {
  const theme = useTheme();
  const { route } = useAtomValue(swapExecutionStateAtom);
  const { interval, duration, shouldStream } = useAtomValue(streamSettingsAtom);
  const firstOperation = operations[0];
  const lastOperation = operations[operations.length - 1];
  const status = statusData?.transferEvents;

  const recurrences =
    shouldStream && interval && duration ? Math.floor(duration / interval) : 1;

  const destinationStatus = useMemo(() => {
    const destinationStatus = status?.[lastOperation.transferIndex]?.status;
    if (swapExecutionState === SwapExecutionState.confirmed) {
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

  const safeDivide = (value: number | undefined, divisor: number): string =>
    typeof value === "number" ? (value / divisor).toString() : "";

  const source = {
    denom: firstOperation.denomIn,
    tokenAmount: firstOperation.amountIn,
    chainId: firstOperation.fromChainID ?? firstOperation.chainID,
    usdValue: route?.usdAmountIn,
  };

  const intento = {
    denom: firstOperation.denomIn,
    tokenAmount: shouldStream
      ? Math.floor(Number(firstOperation.amountOut) / recurrences).toString()
      : firstOperation.amountOut,
    chainId: firstOperation.fromChainID ?? firstOperation.chainID,
    usdValue: shouldStream
      ? safeDivide(Number(route?.usdAmountOut), recurrences)
      : route?.usdAmountOut,
  };

  const destination = {
    denom: lastOperation.denomOut,
    tokenAmount: shouldStream
      ? Math.floor(Number(lastOperation.amountOut) / recurrences).toString()
      : lastOperation.amountOut,
    chainId: lastOperation.toChainID ?? lastOperation.chainID,
    usdValue: shouldStream
      ? safeDivide(Number(route?.usdAmountOut), recurrences)
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
          {...intento}
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
      />
    </StyledSwapExecutionPageRoute>
  );
};

const StyledBridgeArrowIcon = styled(BridgeArrowIcon)`
  height: 18px;
  width: 54px;
`;

const StyledSwapExecutionPageRoute = styled(Column)`
  padding: 30px;
  background: ${({ theme }) => theme.primary.background.normal};
  border-radius: 25px;
  min-height: 225px;
`;
