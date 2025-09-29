import { useQuery } from "@tanstack/react-query";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import { QueryClient } from "@cosmjs/stargate/build/queryclient/queryclient";
import { setupAuthzExtension } from "@cosmjs/stargate/build/modules/authz/queries";
import { skipClientConfigAtom } from "@/state/skipClient";
import { useAtomValue } from "jotai";
import { getChainInfo } from "graz";
import { getChainChannelConfig } from "@/constants/intentoChains";
import { QueryGrantsResponse } from "cosmjs-types/cosmos/authz/v1beta1/query";

const TM_CLIENTS: Record<string, Tendermint34Client> = {};

export interface GrantInfo {
  granter: string;
  grantee: string;
  msgTypeUrl: string;
  expiration: Date | null;
}

export const useAuthzGrants = ({
  granter,
  chainId,
  msgTypeUrl = "/cosmos.bank.v1beta1.MsgSend",
}: {
  granter?: string;
  chainId?: string;
  msgTypeUrl?: string;
}) => {
  const skipClientConfig = useAtomValue(skipClientConfigAtom);

  return useQuery({
    queryKey: ["authzGrants", { granter, chainId, msgTypeUrl }],
    queryFn: async () => {
      if (!chainId) throw new Error("Chain ID not found");
      if (!granter) throw new Error("Granter address not found");
      console.log("useAuthzGrants", msgTypeUrl);
      const rpcURL =
        (await skipClientConfig.endpointOptions?.getRpcEndpointForChain?.(
          chainId
        )) || getChainInfo({ chainId })?.rpc;

      if (!rpcURL) throw new Error("RPC URL not found");

      return getAuthzGrants(rpcURL, granter, chainId, msgTypeUrl);
    },
    enabled: !!granter && !!chainId,
  });
};

async function getAuthzGrants(
  rpcURL: string,
  granter: string,
  chainId: string,
  msgTypeUrl: string
): Promise<GrantInfo | null> {
  try {
    // Get or create Tendermint client and query client
    let tmClient = TM_CLIENTS[chainId];
    if (!tmClient) {
      tmClient = await Tendermint34Client.connect(rpcURL);
      TM_CLIENTS[chainId] = tmClient;
    }
    const queryClient = new QueryClient(tmClient as unknown as any);
    const authzExtension = setupAuthzExtension(queryClient as any);
    const chainConfig = getChainChannelConfig(chainId);

    // Query grants
    const response: QueryGrantsResponse = await authzExtension.authz.grants(
      granter,
      chainConfig?.trustlessAgentICAAddress || "",
      msgTypeUrl,
      undefined // pagination (optional)
    );
    if (!response.grants || response.grants.length === 0) {
      return null;
    }

    // Sort grants by expiration date (newest first)
    const sortedGrants = [...response.grants].sort((a, b) => {
      const aExpiry = a.expiration
        ? new Date(Number(a.expiration.seconds) * 1000)
        : new Date(0);
      const bExpiry = b.expiration
        ? new Date(Number(b.expiration.seconds) * 1000)
        : new Date(0);
      return bExpiry.getTime() - aExpiry.getTime();
    });

    const latestGrant = sortedGrants[0];
    console.log("latestGrant", latestGrant, sortedGrants, response.grants);
    return {
      granter,
      grantee: chainConfig?.trustlessAgentICAAddress || "",
      msgTypeUrl,
      expiration: latestGrant.expiration
        ? new Date(Number(latestGrant.expiration.seconds) * 1000)
        : null,
    };
  } catch (error) {
    console.error("Error getting authz grants:", error);
    throw error;
  }
}
