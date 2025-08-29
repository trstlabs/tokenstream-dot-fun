// intentoChains.ts
// This file contains constants related to Intento supported chains and their configurations

/**
 * Channel configuration for chains that support Intento hosted accounts
 */
interface ChainChannelConfig {
  chainId: string;
  intentoChannelToDest: string;
  channelDestToIntento: string;
  displayName: string;
  isTestnet: boolean;
  denom: string;
  denomOnIntento: string;
  trustlessAgentICAAddress: string;
  trustlessAgentAddress: string;
  trustlessAgentFee: string;
}

/**
 * List of chains that support Intento hosted accounts for AuthZ MsgExec
 * These chains can use the AuthZ MsgExec flow instead of PFM
 */
export const intentoTrustlessAgentSupportedChains = [
  "osmosis-1", // Osmosis mainnet
  "osmo-test-5", // Osmosis testnet
  "cosmoshub-4", // Cosmos Hub mainnet
];

/**
 * Channel configurations for supported chains for pfm or AuthZ streaming
 * Maps chainId to its channel configuration
 */
export const chainChannelConfigs: Record<string, ChainChannelConfig> = {
  "osmosis-1": {
    chainId: "osmosis-1",
    intentoChannelToDest: import.meta.env.VITE_CHANNEL_ID_INTO_OSMO || "",
    channelDestToIntento: import.meta.env.VITE_CHANNEL_ID_OSMO_INTO || "",
    displayName: "Osmosis",
    isTestnet: false,
    denom: "uosmo",
    denomOnIntento: import.meta.env.VITE_IBC_DENOM_OSMO || "",
    trustlessAgentICAAddress:
      import.meta.env.VITE_TRUSTLESS_AGENT_ICA_ADDRESS_OSMO || "",
    trustlessAgentAddress:
      import.meta.env.VITE_TRUSTLESS_AGENT_ADDRESS_OSMO || "",
    trustlessAgentFee:
      import.meta.env.VITE_TRUSTLESS_AGENT_FEE_LIMIT_OSMO || "",
  },
  "osmo-test-5": {
    chainId: "osmo-test-5",
    intentoChannelToDest: import.meta.env.VITE_CHANNEL_ID_INTO_OSMO || "",
    channelDestToIntento: import.meta.env.VITE_CHANNEL_ID_OSMO_INTO || "",
    displayName: "Osmosis Testnet",
    isTestnet: true,
    denom: "uosmo",
    denomOnIntento: import.meta.env.VITE_IBC_DENOM_OSMO || "",
    trustlessAgentICAAddress:
      import.meta.env.VITE_TRUSTLESS_AGENT_ICA_ADDRESS_OSMO || "",
    trustlessAgentAddress:
      import.meta.env.VITE_TRUSTLESS_AGENT_ADDRESS_OSMO || "",
    trustlessAgentFee:
      import.meta.env.VITE_TRUSTLESS_AGENT_FEE_LIMIT_OSMO || "",
  },
  "cosmoshub-4": {
    chainId: "cosmoshub-4",
    intentoChannelToDest: import.meta.env.VITE_CHANNEL_ID_INTO_ATOM || "",
    channelDestToIntento: import.meta.env.VITE_CHANNEL_ID_ATOM_INTO || "",
    displayName: "Cosmos Hub",
    isTestnet: false,
    denom: "uatom",
    denomOnIntento: import.meta.env.VITE_IBC_DENOM_ATOM || "",
    trustlessAgentICAAddress:
      import.meta.env.VITE_TRUSTLESS_AGENT_ICA_ADDRESS_ATOM || "",
    trustlessAgentAddress:
      import.meta.env.VITE_TRUSTLESS_AGENT_ADDRESS_ATOM || "",
    trustlessAgentFee:
      import.meta.env.VITE_TRUSTLESS_AGENT_FEE_LIMIT_ATOM || "",
  },
};

/**
 * Gets the channel configuration for a given chain ID
 * @param chainId The chain ID to get the configuration for
 * @returns The channel configuration or undefined if not found
 */
export function getChainChannelConfig(
  chainId: string
): ChainChannelConfig | undefined {
  return chainChannelConfigs[chainId];
}
