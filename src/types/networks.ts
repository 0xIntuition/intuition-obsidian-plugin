/**
 * Network configuration types and constants
 */

export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  graphqlUrl: string;
  multiVaultAddress: `0x${string}`;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    chainId: 13579,
    name: 'Intuition Testnet',
    rpcUrl: 'https://testnet.rpc.intuition.systems',
    explorerUrl: 'https://testnet.explorer.intuition.systems',
    graphqlUrl: 'https://testnet.intuition.sh/v1/graphql',
    multiVaultAddress: '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91',
  },
  mainnet: {
    chainId: 1155,
    name: 'Intuition Mainnet',
    rpcUrl: 'https://rpc.intuition.systems',
    explorerUrl: 'https://explorer.intuition.systems',
    graphqlUrl: 'https://mainnet.intuition.sh/v1/graphql',
    multiVaultAddress: '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e',
  },
} as const;
