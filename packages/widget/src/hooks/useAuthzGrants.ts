import { useQuery } from "@tanstack/react-query";
import { StargateClient } from "@cosmjs/stargate";
import { setupAuthzExtension } from "@cosmjs/stargate/build/modules/authz/queries";
import { skipClientConfigAtom } from "@/state/skipClient";
import { useAtomValue } from "jotai";
import { getChainInfo } from "graz";
import { getChainChannelConfig } from "@/constants/intentoChains";
import { QueryClient } from "@cosmjs/stargate/build/queryclient/queryclient";

const AUTHZ_CLIENTS: Record<string, StargateClient> = {};

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
    // Get or create client
    let client = AUTHZ_CLIENTS[chainId];
    if (!client) {
      client = await StargateClient.connect(rpcURL);
      AUTHZ_CLIENTS[chainId] = client;
    }

    // Get the query client and setup authz extension
    const queryClient = QueryClient.withExtensions(
      // @ts-ignore - forceGetQueryClient is protected but we need it
      client.forceGetQueryClient()
    );
    const authzExtension = setupAuthzExtension(queryClient);
    const chainConfig = getChainChannelConfig(chainId);

    // Query grants
    const response = await authzExtension.authz.grants(
      granter,
      chainConfig?.hostedAddress || "",
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
    return {
      granter,
      grantee: chainConfig?.hostedAddress || "",
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
