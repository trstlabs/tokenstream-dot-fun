export interface MemoJsonInput {
  wasm: {
    contract: string;
    msg: {
      swap_and_action: {
        user_swap: {
          swap_exact_asset_out: {
            swap_venue_name: string;
            operations: Array<{
              pool: string;
              denom_in: string;
              denom_out: string;
            }>;
            refund_address: string;
          };
        };
        min_asset: {
          native: {
            denom: string;
            amount: string;
          };
        };
        timeout_timestamp: number;
        post_swap_action: {
          transfer: {
            to_address: string;
          };
        };
        affiliates: Array<any>;
      };
    };
  };
}

export function memoDivideAmount(jsonInput: MemoJsonInput, recurrences: number): MemoJsonInput {
  console.log(jsonInput);
  console.log(jsonInput.wasm);
  console.log(jsonInput.wasm.msg);
  console.log(jsonInput.wasm.msg.swap_and_action);
  const originalAmount = parseInt(jsonInput.wasm.msg.swap_and_action.min_asset.native.amount, 10);
  const dividedAmount = Math.floor(originalAmount / recurrences).toString();
  console.log(dividedAmount);

  const newJson: MemoJsonInput = JSON.parse(JSON.stringify(jsonInput));
  newJson.wasm.msg.swap_and_action.min_asset.native.amount = dividedAmount;
  console.log(newJson);
  return newJson;
}
