export function wasmMsgDivideSkipContractSwapAmount(
  wasmMsg: any,
  recurrences: number
): any {
  console.log(wasmMsg);
  const originalAmount = parseInt(
    wasmMsg.swap_and_action.min_asset.native.amount,
    10
  );
  const dividedAmount = Math.floor(originalAmount / recurrences).toString();
  console.log(dividedAmount);

  wasmMsg.swap_and_action.min_asset.native.amount = dividedAmount;
  if (dividedAmount == "0") {
    throw new Error("Divided amount is 0");
  }
  console.log(wasmMsg);
  return wasmMsg;
}
