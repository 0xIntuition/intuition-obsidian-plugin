import { describe, it, expect } from 'vitest';
import { NETWORKS, NetworkType } from './networks';

describe('Network Configuration', () => {
	describe('NETWORKS object', () => {
		it('should export testnet configuration', () => {
			expect(NETWORKS.testnet).toBeDefined();
		});

		it('should export mainnet configuration', () => {
			expect(NETWORKS.mainnet).toBeDefined();
		});

		it('should have correct testnet properties', () => {
			const testnet = NETWORKS.testnet;

			expect(testnet.chainId).toBe(13579);
			expect(testnet.name).toBe('Intuition Testnet');
			expect(testnet.rpcUrl).toBe(
				'https://testnet.rpc.intuition.systems/http'
			);
			expect(testnet.explorerUrl).toBe(
				'https://testnet.explorer.intuition.systems'
			);
			expect(testnet.graphqlUrl).toBe(
				'https://testnet.intuition.sh/v1/graphql'
			);
			expect(testnet.multiVaultAddress).toBe(
				'0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91'
			);
		});

		it('should have correct mainnet properties', () => {
			const mainnet = NETWORKS.mainnet;

			expect(mainnet.chainId).toBe(1155);
			expect(mainnet.name).toBe('Intuition');
			expect(mainnet.rpcUrl).toBe(
				'https://rpc.intuition.systems/http'
			);
			expect(mainnet.explorerUrl).toBe(
				'https://explorer.intuition.systems'
			);
			expect(mainnet.graphqlUrl).toBe(
				'https://mainnet.intuition.sh/v1/graphql'
			);
			expect(mainnet.multiVaultAddress).toBe(
				'0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e'
			);
		});

		it('should have /http suffix on RPC URLs', () => {
			expect(NETWORKS.testnet.rpcUrl).toContain('/http');
			expect(NETWORKS.mainnet.rpcUrl).toContain('/http');
		});

		it('should have valid Ethereum addresses for multiVault', () => {
			const addressRegex = /^0x[a-fA-F0-9]{40}$/;

			expect(NETWORKS.testnet.multiVaultAddress).toMatch(addressRegex);
			expect(NETWORKS.mainnet.multiVaultAddress).toMatch(addressRegex);
		});

		it('should have HTTPS URLs for all endpoints', () => {
			Object.values(NETWORKS).forEach((network) => {
				expect(network.rpcUrl).toMatch(/^https:\/\//);
				expect(network.explorerUrl).toMatch(/^https:\/\//);
				expect(network.graphqlUrl).toMatch(/^https:\/\//);
			});
		});
	});

	describe('NetworkConfig interface', () => {
		it('should have all required properties', () => {
			const testnetKeys = Object.keys(NETWORKS.testnet).sort();
			const expectedKeys = [
				'chainId',
				'name',
				'rpcUrl',
				'explorerUrl',
				'graphqlUrl',
				'multiVaultAddress',
			].sort();

			expect(testnetKeys).toEqual(expectedKeys);
		});
	});

	describe('Type exports', () => {
		it('should export NetworkType as union type', () => {
			const testnetType: NetworkType = 'testnet';
			const mainnetType: NetworkType = 'mainnet';

			expect(testnetType).toBe('testnet');
			expect(mainnetType).toBe('mainnet');
		});
	});
});
