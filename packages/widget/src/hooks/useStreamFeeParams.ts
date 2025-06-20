import { skipClientConfigAtom } from "@/state/skipClient";
import { Coin } from "@cosmjs/amino";
import { useQuery } from "@tanstack/react-query";
import { getChainInfo } from "graz";
import { useAtomValue } from "jotai";

// Cache for fee params to prevent refetching
let cachedFeeParams: {
  gasFeeCoins: Coin[];
  flexFeeMul: string;
  burnFeePerMsg: string;
} | null = null;

// Time in milliseconds to keep the cache (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
let cacheTimestamp = 0;

export const useStreamFeeParams = () => {
  const chainID = import.meta.env.VITE_CHAIN_ID_INTO;
  const skipClientConfig = useAtomValue(skipClientConfigAtom);

  const query = useQuery({
    queryKey: ["gasFeeCoin", chainID],
    queryFn: async () => {
      // Return cached data if it's still fresh
      const now = Date.now();
      if (cachedFeeParams && now - cacheTimestamp < CACHE_TTL) {
        return cachedFeeParams;
      }

      if (!chainID) throw new Error("Chain ID not found");
      
      try {
        // Step 1: Resolve LCD endpoint
        const lcdURL =
          import.meta.env.VITE_INTENTO_LCD_ADDRESS ||
          (await skipClientConfig.endpointOptions?.getRestEndpointForChain?.(chainID)) ||
          getChainInfo({ chainId: chainID })?.rest;
        
        if (!lcdURL) throw new Error("Unable to resolve LCD URL for intento");

        // Step 2: Query params endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const endpoint = `${lcdURL}/intento/intent/v1beta1/params`;
        const res = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`IBC query failed: ${res.statusText}`);
        const data = await res.json();

        const gasFeeCoins: Coin[] = data?.params?.gas_fee_coins;
        const flexFeeMul = data?.params?.flow_flex_fee_mul;
        const burnFeePerMsg = data?.params?.burn_fee_per_msg;
        
        if (!gasFeeCoins) throw new Error("gasFeeCoins not found");
        
        // Update cache
        cachedFeeParams = { gasFeeCoins, flexFeeMul, burnFeePerMsg };
        cacheTimestamp = now;
        
        return cachedFeeParams;
      } catch (error) {
        console.error("Failed to fetch fee params:", error);
        // Return cached data even if it's stale when there's an error
        if (cachedFeeParams) return cachedFeeParams;
        throw error;
      }
    },
    enabled: !!chainID,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 15 * 60 * 1000, // Keep unused data in cache for 15 minutes
    retry: 2, // Retry failed requests twice
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
  };
};
