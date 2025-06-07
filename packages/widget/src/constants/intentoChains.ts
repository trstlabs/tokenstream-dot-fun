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
  hostedICAAddress: string;
  hostedAddress: string;
}

/**
 * List of chains that support Intento hosted accounts for AuthZ MsgExec
 * These chains can use the AuthZ MsgExec flow instead of PFM
 */
export const intentoHostedAccountSupportedChains = [
  "osmosis-1", // Osmosis mainnet
  "osmo-test-5", // Osmosis testnet
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
    hostedICAAddress: import.meta.env.VITE_HOSTED_ICA_ADDRESS || "",
    hostedAddress: import.meta.env.VITE_HOSTED_ADDRESS || "",
  },
  "osmo-test-5": {
    chainId: "osmo-test-5",
    intentoChannelToDest: import.meta.env.VITE_CHANNEL_ID_INTO_OSMO || "",
    channelDestToIntento: import.meta.env.VITE_CHANNEL_ID_OSMO_INTO || "",
    displayName: "Osmosis Testnet",
    isTestnet: true,
    denom: "uosmo",
    denomOnIntento: import.meta.env.VITE_IBC_DENOM_OSMO || "",
    hostedICAAddress: import.meta.env.VITE_HOSTED_ICA_ADDRESS || "",
    hostedAddress: import.meta.env.VITE_HOSTED_ADDRESS || "",
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
