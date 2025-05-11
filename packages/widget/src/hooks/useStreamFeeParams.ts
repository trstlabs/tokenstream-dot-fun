import { skipClientConfigAtom } from "@/state/skipClient";
import { Coin } from "@cosmjs/amino";
import { useQuery } from "@tanstack/react-query";
import { getChainInfo } from "graz";
import { useAtomValue } from "jotai";

export const useStreamFeeParams = () => {
  const chainID = import.meta.env.VITE_CHAIN_ID_INTO;
  const skipClientConfig = useAtomValue(skipClientConfigAtom);

  const query = useQuery({
    queryKey: ["gasFeeCoin"],
    queryFn: async () => {
      if (!chainID) throw new Error("Chain ID not found");
      // Step 1: Resolve LCD endpoint
      const lcdURL =
        import.meta.env.VITE_INTENTO_LCD_ADDRESS ||
        (await skipClientConfig.endpointOptions?.getRestEndpointForChain?.(
          chainID
        )) ||
        getChainInfo({ chainId: chainID })?.rest;
      if (!lcdURL) throw new Error("Unable to resolve LCD URL for intento");

      // Step 2: Query IBC channel
      const endpoint = `${lcdURL}/intento/intent/v1beta1/params`;
      const res = await fetch(endpoint);

      if (!res.ok) throw new Error(`IBC query failed: ${res.statusText}`);
      const data = await res.json();

      const gasFeeCoins: Coin[] = data?.params?.gas_fee_coins;
      console.log(gasFeeCoins);
      const flexFeeMul = data?.params?.flow_flex_fee_mul;
      const burnFeePerMsg = data?.params?.burn_fee_per_msg;
      if (!gasFeeCoins) throw new Error("gasFeeCoins not found");
      return { gasFeeCoins, flexFeeMul, burnFeePerMsg };
    },
    enabled: !!chainID,
  });
  return query.data;
};
