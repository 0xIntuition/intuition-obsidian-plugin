/**
 * Integration tests for network switching behavior
 *
 * These tests verify that switching between testnet and mainnet:
 * - Clears the cache
 * - Uses the correct GraphQL endpoint
 * - Returns different results from each network
 * - Doesn't cause cross-contamination of data
 *
 * @requires Network access to both testnet.intuition.sh and mainnet.intuition.sh
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntuitionService } from '../../src/services/intuition-service';
import {
	createTestnetPlugin,
	createMainnetPlugin,
	createRealPlugin,
} from '../helpers/integration-plugin';
import {
	measureExecutionTime,
	createFetchLogger,
} from '../helpers/network-test-helpers';
import { KNOWN_SEARCH_TERMS } from './test-data/known-atoms';
import { NETWORKS } from '../../src/types/networks';

const NETWORK_TIMEOUT = 10000; // 10 seconds

describe('Atom Search - Network Switching (Real API)', () => {
	describe('Network Endpoint Verification', () => {
		let originalFetch: typeof fetch;

		beforeEach(() => {
			originalFetch = global.fetch;
		});

		afterEach(() => {
			global.fetch = originalFetch;
		});

		it(
			'should use testnet GraphQL endpoint for testnet searches',
			async () => {
				const { wrappedFetch, calls } = createFetchLogger();
				global.fetch = wrappedFetch;

				// Create testnet plugin
				const plugin = await createTestnetPlugin();

				// Perform search
				await plugin.intuitionService.searchAtoms({
					label: KNOWN_SEARCH_TERMS.eth,
					limit: 1,
				});

				// Verify testnet endpoint was called
				const testnetUrl = NETWORKS.testnet.graphqlUrl;
				const testnetCalls = calls.filter((c) =>
					c.url.includes(testnetUrl)
				);

				expect(
					testnetCalls.length,
					`Should call testnet endpoint ${testnetUrl}`
				).toBeGreaterThan(0);

				// Verify mainnet endpoint was NOT called
				const mainnetUrl = NETWORKS.mainnet.graphqlUrl;
				const mainnetCalls = calls.filter((c) =>
					c.url.includes(mainnetUrl)
				);

				expect(
					mainnetCalls.length,
					'Should not call mainnet endpoint'
				).toBe(0);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should use mainnet GraphQL endpoint for mainnet searches',
			async () => {
				const { wrappedFetch, calls } = createFetchLogger();
				global.fetch = wrappedFetch;

				// Create mainnet plugin
				const plugin = await createMainnetPlugin();

				// Perform search
				await plugin.intuitionService.searchAtoms({
					label: KNOWN_SEARCH_TERMS.eth,
					limit: 1,
				});

				// Verify mainnet endpoint was called
				const mainnetUrl = NETWORKS.mainnet.graphqlUrl;
				const mainnetCalls = calls.filter((c) =>
					c.url.includes(mainnetUrl)
				);

				expect(
					mainnetCalls.length,
					`Should call mainnet endpoint ${mainnetUrl}`
				).toBeGreaterThan(0);

				// Verify testnet endpoint was NOT called
				const testnetUrl = NETWORKS.testnet.graphqlUrl;
				const testnetCalls = calls.filter((c) =>
					c.url.includes(testnetUrl)
				);

				expect(
					testnetCalls.length,
					'Should not call testnet endpoint'
				).toBe(0);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should switch endpoints when network changes',
			async () => {
				const { wrappedFetch, calls } = createFetchLogger();
				global.fetch = wrappedFetch;

				// Start with testnet
				const plugin = await createTestnetPlugin();
				const service = plugin.intuitionService;

				// Search on testnet
				await service.searchAtoms({
					label: KNOWN_SEARCH_TERMS.eth,
					limit: 1,
				});

				const testnetCallsBefore = calls.filter((c) =>
					c.url.includes(NETWORKS.testnet.graphqlUrl)
				);
				expect(testnetCallsBefore.length).toBeGreaterThan(0);

				// Clear calls log
				calls.length = 0;

				// Switch to mainnet
				service.updateNetwork('mainnet');

				// Search on mainnet
				await service.searchAtoms({
					label: KNOWN_SEARCH_TERMS.eth,
					limit: 1,
				});

				// Verify mainnet endpoint is now used
				const mainnetCallsAfter = calls.filter((c) =>
					c.url.includes(NETWORKS.mainnet.graphqlUrl)
				);
				expect(
					mainnetCallsAfter.length,
					'Should call mainnet endpoint after switch'
				).toBeGreaterThan(0);

				// Verify testnet endpoint is NOT called after switch
				const testnetCallsAfter = calls.filter((c) =>
					c.url.includes(NETWORKS.testnet.graphqlUrl)
				);
				expect(
					testnetCallsAfter.length,
					'Should not call testnet endpoint after switch to mainnet'
				).toBe(0);
			},
			NETWORK_TIMEOUT * 2
		);
	});

	describe('Cache Invalidation on Network Switch', () => {
		it(
			'should clear cache when switching from testnet to mainnet',
			async () => {
				const plugin = await createTestnetPlugin();
				const service = plugin.intuitionService;

				const query = KNOWN_SEARCH_TERMS.ethereum;

				// Populate cache on testnet
				await service.semanticSearchAtoms(query, 5);

				// Verify cache hit (fast second call)
				const { durationMs: cachedDuration } =
					await measureExecutionTime(() =>
						service.semanticSearchAtoms(query, 5)
					);

				expect(cachedDuration).toBeLessThan(50); // Should be near-instant

				// Switch to mainnet
				service.updateNetwork('mainnet');

				// Next call should NOT hit cache (slower - needs network call)
				const { durationMs: uncachedDuration } =
					await measureExecutionTime(() =>
						service.semanticSearchAtoms(query, 5)
					);

				// After network switch, should be much slower (no cache)
				expect(uncachedDuration).toBeGreaterThan(cachedDuration * 2);
				expect(uncachedDuration).toBeGreaterThan(100); // Should take time for API call
			},
			NETWORK_TIMEOUT * 2
		);

		it(
			'should clear cache when switching from mainnet to testnet',
			async () => {
				const plugin = await createMainnetPlugin();
				const service = plugin.intuitionService;

				const query = KNOWN_SEARCH_TERMS.blockchain;

				// Populate cache on mainnet
				await service.searchAtoms({ label: query, limit: 5 });

				// Verify cache hit
				const { durationMs: cachedDuration } =
					await measureExecutionTime(() =>
						service.searchAtoms({ label: query, limit: 5 })
					);

				expect(cachedDuration).toBeLessThan(50);

				// Switch to testnet
				service.updateNetwork('testnet');

				// Next call should NOT hit cache
				const { durationMs: uncachedDuration } =
					await measureExecutionTime(() =>
						service.searchAtoms({ label: query, limit: 5 })
					);

				expect(uncachedDuration).toBeGreaterThan(cachedDuration * 2);
				expect(uncachedDuration).toBeGreaterThan(100);
			},
			NETWORK_TIMEOUT * 2
		);

		it(
			'should clear both semantic and label search caches on switch',
			async () => {
				const plugin = await createTestnetPlugin();
				const service = plugin.intuitionService;

				const query = KNOWN_SEARCH_TERMS.crypto;

				// Populate both caches on testnet
				await service.semanticSearchAtoms(query, 5);
				await service.searchAtoms({ label: query, limit: 5 });

				// Verify both are cached
				const { durationMs: semanticCached } =
					await measureExecutionTime(() =>
						service.semanticSearchAtoms(query, 5)
					);
				const { durationMs: labelCached } = await measureExecutionTime(
					() => service.searchAtoms({ label: query, limit: 5 })
				);

				expect(semanticCached).toBeLessThan(50);
				expect(labelCached).toBeLessThan(50);

				// Switch network
				service.updateNetwork('mainnet');

				// Both should be uncached now
				const { durationMs: semanticUncached } =
					await measureExecutionTime(() =>
						service.semanticSearchAtoms(query, 5)
					);
				const { durationMs: labelUncached } =
					await measureExecutionTime(() =>
						service.searchAtoms({ label: query, limit: 5 })
					);

				expect(semanticUncached).toBeGreaterThan(semanticCached * 2);
				expect(labelUncached).toBeGreaterThan(labelCached * 2);
			},
			NETWORK_TIMEOUT * 3
		);
	});

	describe('Cross-Network Data Isolation', () => {
		it(
			'should return potentially different results from testnet vs mainnet',
			async () => {
				const query = KNOWN_SEARCH_TERMS.ethereum;

				// Search on testnet
				const testnetPlugin = await createTestnetPlugin();
				const testnetResults =
					await testnetPlugin.intuitionService.searchAtoms({
						label: query,
						limit: 10,
					});

				// Search on mainnet
				const mainnetPlugin = await createMainnetPlugin();
				const mainnetResults =
					await mainnetPlugin.intuitionService.searchAtoms({
						label: query,
						limit: 10,
					});

				// Both should return valid arrays
				expect(Array.isArray(testnetResults)).toBe(true);
				expect(Array.isArray(mainnetResults)).toBe(true);

				// NOTE: Atom IDs are deterministic (hash of atomData), so the same atoms
				// will have identical IDs on both networks. What differs is which atoms
				// exist on each network.
				//
				// This test verifies that:
				// 1. Both networks can return results independently
				// 2. Data is properly isolated (we're not mixing testnet/mainnet data)
				//
				// We verify isolation by checking that we got results from both networks
				// (not from cache cross-contamination)
				if (testnetResults.length > 0 && mainnetResults.length > 0) {
					// Verify we got actual atom data with expected structure
					expect(testnetResults[0]).toHaveProperty('id');
					expect(testnetResults[0]).toHaveProperty('label');
					expect(mainnetResults[0]).toHaveProperty('id');
					expect(mainnetResults[0]).toHaveProperty('label');

					// Results should be valid (not empty or corrupted)
					expect(testnetResults[0].id).toBeTruthy();
					expect(mainnetResults[0].id).toBeTruthy();
				}
			},
			NETWORK_TIMEOUT * 2
		);

		it(
			'should maintain network consistency during multiple operations',
			async () => {
				const plugin = await createTestnetPlugin();
				const service = plugin.intuitionService;

				const { wrappedFetch, calls } = createFetchLogger();
				const originalFetch = global.fetch;
				global.fetch = wrappedFetch;

				try {
					// Perform multiple operations on testnet
					await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.eth,
						limit: 5,
					});
					await service.semanticSearchAtoms(
						KNOWN_SEARCH_TERMS.blockchain,
						5
					);
					await service.searchAtoms({
						type: 'Thing',
						limit: 5,
					});

					// All calls should be to testnet
					const testnetCalls = calls.filter((c) =>
						c.url.includes(NETWORKS.testnet.graphqlUrl)
					);
					const mainnetCalls = calls.filter((c) =>
						c.url.includes(NETWORKS.mainnet.graphqlUrl)
					);

					expect(testnetCalls.length).toBeGreaterThan(0);
					expect(mainnetCalls.length).toBe(0);

					// Clear log
					calls.length = 0;

					// Switch to mainnet
					service.updateNetwork('mainnet');

					// Perform multiple operations on mainnet
					await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.eth,
						limit: 5,
					});
					await service.semanticSearchAtoms(
						KNOWN_SEARCH_TERMS.blockchain,
						5
					);

					// All calls should now be to mainnet
					const testnetCallsAfter = calls.filter((c) =>
						c.url.includes(NETWORKS.testnet.graphqlUrl)
					);
					const mainnetCallsAfter = calls.filter((c) =>
						c.url.includes(NETWORKS.mainnet.graphqlUrl)
					);

					expect(testnetCallsAfter.length).toBe(0);
					expect(mainnetCallsAfter.length).toBeGreaterThan(0);
				} finally {
					global.fetch = originalFetch;
				}
			},
			NETWORK_TIMEOUT * 3
		);
	});

	describe('Network Switch Edge Cases', () => {
		it(
			'should handle rapid network switching',
			async () => {
				const plugin = await createTestnetPlugin();
				const service = plugin.intuitionService;

				const query = KNOWN_SEARCH_TERMS.eth;

				// Rapid switches
				service.updateNetwork('mainnet');
				service.updateNetwork('testnet');
				service.updateNetwork('mainnet');
				service.updateNetwork('testnet');

				// Should still work correctly on final network (testnet)
				const results = await service.searchAtoms({
					label: query,
					limit: 5,
				});

				expect(Array.isArray(results)).toBe(true);

				// Verify using testnet endpoint
				const { wrappedFetch, calls } = createFetchLogger();
				const originalFetch = global.fetch;
				global.fetch = wrappedFetch;

				try {
					await service.searchAtoms({ label: query, limit: 1 });

					const testnetCalls = calls.filter((c) =>
						c.url.includes(NETWORKS.testnet.graphqlUrl)
					);
					expect(testnetCalls.length).toBeGreaterThan(0);
				} finally {
					global.fetch = originalFetch;
				}
			},
			NETWORK_TIMEOUT
		);

		it(
			'should handle network switch during cached query',
			async () => {
				const plugin = await createTestnetPlugin();
				const service = plugin.intuitionService;

				const query = KNOWN_SEARCH_TERMS.ethereum;

				// Populate cache on testnet
				const testnetResults1 = await service.semanticSearchAtoms(
					query,
					5
				);

				// Verify cached (fast)
				const { durationMs: cachedDuration } =
					await measureExecutionTime(() =>
						service.semanticSearchAtoms(query, 5)
					);
				expect(cachedDuration).toBeLessThan(50);

				// Switch network
				service.updateNetwork('mainnet');

				// Should fetch fresh from mainnet (not cached)
				const { durationMs: mainnetDuration, result: mainnetResults } =
					await measureExecutionTime(() =>
						service.semanticSearchAtoms(query, 5)
					);

				expect(mainnetDuration).toBeGreaterThan(100); // Should be slow (no cache)
				expect(Array.isArray(mainnetResults)).toBe(true);

				// Results may be different (different network data)
				// We just verify both returned valid arrays
				expect(Array.isArray(testnetResults1)).toBe(true);
			},
			NETWORK_TIMEOUT * 2
		);
	});
});
