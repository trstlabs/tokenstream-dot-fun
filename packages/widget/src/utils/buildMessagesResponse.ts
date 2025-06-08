import { messages, UserAddress } from "@skip-go/client";

export async function buildMessagesResponse({
  route,
  userAddresses,
  slippage,
}: {
  route: {
    sourceAssetDenom: string;
    sourceAssetChainId: string;
    destAssetDenom: string;
    destAssetChainId: string;
    amountIn: string;
    amountOut: string;
    operations: any[];
    estimatedAmountOut: string;
  };
  userAddresses: UserAddress[];
  slippage: number;
}) {
  return messages({
    sourceAssetDenom: route.sourceAssetDenom,
    sourceAssetChainId: route.sourceAssetChainId,
    destAssetDenom: route.destAssetDenom,
    destAssetChainId: route.destAssetChainId,
    amountIn: route.amountIn,
    amountOut: route.amountOut,
    addressList: userAddresses.map((user) => user.address),
    operations: route.operations,
    estimatedAmountOut: route.estimatedAmountOut,
    slippageTolerancePercent: slippage.toString(),
  });
}
