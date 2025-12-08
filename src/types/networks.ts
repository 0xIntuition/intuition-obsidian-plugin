/**
 * Network configuration types and constants
 *
 * Network data sourced from official Intuition packages:
 * - @0xintuition/protocol: Chain configs and MultiVault addresses
 * - @0xintuition/graphql: GraphQL API endpoints
 */

import {
	intuitionTestnet,
	intuitionMainnet,
	getMultiVaultAddressFromChainId,
} from '@0xintuition/protocol';
import { API_URL_DEV, API_URL_PROD } from '@0xintuition/graphql';
import type { Chain } from 'viem';

export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
	chainId: number;
	name: string;
	rpcUrl: string;
	explorerUrl: string;
	graphqlUrl: string;
	multiVaultAddress: `0x${string}`;
}

/**
 * Converts a viem Chain object to NetworkConfig format
 *
 * @param chain - Viem chain configuration from @0xintuition/protocol
 * @param graphqlUrl - GraphQL endpoint URL from @0xintuition/graphql
 * @returns NetworkConfig object compatible with existing interface
 * @throws Error if required chain properties are missing
 */
function createNetworkConfig(
	chain: Chain,
	graphqlUrl: string
): NetworkConfig {
	// Validate required chain properties exist
	if (!chain.blockExplorers?.default?.url) {
		throw new Error(
			`Chain ${chain.name} (${chain.id}) missing block explorer configuration`
		);
	}

	if (!chain.rpcUrls?.default?.http?.[0]) {
		throw new Error(
			`Chain ${chain.name} (${chain.id}) missing RPC URL configuration`
		);
	}

	// Get multiVault address for this chain
	const multiVaultAddress = getMultiVaultAddressFromChainId(chain.id);

	if (!multiVaultAddress) {
		throw new Error(
			`No MultiVault address found for chain ${chain.name} (${chain.id})`
		);
	}

	return {
		chainId: chain.id,
		name: chain.name,
		rpcUrl: chain.rpcUrls.default.http[0],
		explorerUrl: chain.blockExplorers.default.url,
		graphqlUrl,
		multiVaultAddress: multiVaultAddress as `0x${string}`,
	};
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
	testnet: createNetworkConfig(intuitionTestnet, API_URL_DEV),
	mainnet: createNetworkConfig(intuitionMainnet, API_URL_PROD),
} as const;
