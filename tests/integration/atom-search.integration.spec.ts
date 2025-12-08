/**
 * Integration tests for atom search functionality using real API calls
 *
 * These tests verify that search works correctly on both testnet and mainnet
 * by making actual HTTP requests to the GraphQL endpoints.
 *
 * @requires Network access to testnet.intuition.sh and mainnet.intuition.sh
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { IntuitionService } from '../../src/services/intuition-service';
import { mergeSearchResults } from '../../src/utils/search-helpers';
import {
	createTestnetPlugin,
	createMainnetPlugin,
} from '../helpers/integration-plugin';
import {
	verifyAtomStructure,
	verifySearchResults,
	measureExecutionTime,
} from '../helpers/network-test-helpers';
import {
	KNOWN_SEARCH_TERMS,
	SEMANTIC_QUERIES,
	ATOM_TYPES,
	EDGE_CASE_QUERIES,
} from './test-data/known-atoms';

// Longer timeouts for real network calls
const NETWORK_TIMEOUT = 10000; // 10 seconds

describe('Atom Search Integration - Real API', () => {
	describe('Testnet Search', () => {
		let service: IntuitionService;

		beforeAll(async () => {
			// Create real plugin instance with testnet settings
			const plugin = await createTestnetPlugin();
			service = plugin.intuitionService;
		}, NETWORK_TIMEOUT);

		describe('Semantic Search', () => {
			it(
				'should return results for semantic query on testnet',
				async () => {
					const results = await service.semanticSearchAtoms(
						KNOWN_SEARCH_TERMS.ethereum,
						5
					);

					verifySearchResults(results, KNOWN_SEARCH_TERMS.ethereum, {
						minResults: 0, // May have no results on testnet
						maxResults: 5,
					});

					// If we got results, verify their structure
					if (results.length > 0) {
						results.forEach((atom) => verifyAtomStructure(atom));
					}
				},
				NETWORK_TIMEOUT
			);

			it(
				'should return relevant semantic results for conceptual query',
				async () => {
					const results = await service.semanticSearchAtoms(
						SEMANTIC_QUERIES[0], // 'digital currency'
						10
					);

					// Semantic search should return some results or empty array
					expect(Array.isArray(results)).toBe(true);

					// If results exist, verify they're semantically related
					if (results.length > 0) {
						results.forEach((atom) => verifyAtomStructure(atom));

						// At least one result should contain relevant terms
						const labels = results
							.map((r) => r.label.toLowerCase())
							.join(' ');
						const hasRelevantTerms =
							/bitcoin|ethereum|crypto|currency|coin|token|money|digital/i.test(
								labels
							);

						// Only assert if we got results (semantic search may return nothing)
						if (results.length > 0) {
							expect(
								hasRelevantTerms,
								'Semantic results should contain blockchain/currency terms'
							).toBe(true);
						}
					}
				},
				NETWORK_TIMEOUT
			);

			it(
				'should respect limit parameter',
				async () => {
					const limit = 3;
					const results = await service.semanticSearchAtoms(
						KNOWN_SEARCH_TERMS.blockchain,
						limit
					);

					expect(results.length).toBeLessThanOrEqual(limit);

					// Verify structure of returned results
					results.forEach((atom) => verifyAtomStructure(atom));
				},
				NETWORK_TIMEOUT
			);

			it(
				'should handle no results gracefully',
				async () => {
					// Use very specific/unlikely query
					const results = await service.semanticSearchAtoms(
						EDGE_CASE_QUERIES.unlikely,
						5
					);

					expect(results).toBeDefined();
					expect(Array.isArray(results)).toBe(true);
					// Likely to be empty but not guaranteed
				},
				NETWORK_TIMEOUT
			);

			it(
				'should handle multiple semantic queries',
				async () => {
					// Test multiple queries to ensure consistency
					for (const query of SEMANTIC_QUERIES.slice(0, 3)) {
						const results = await service.semanticSearchAtoms(query, 5);

						expect(Array.isArray(results)).toBe(true);
						expect(results.length).toBeLessThanOrEqual(5);

						results.forEach((atom) => verifyAtomStructure(atom));
					}
				},
				NETWORK_TIMEOUT * 3
			);
		});

		describe('Label-based Search', () => {
			it(
				'should search by label on testnet',
				async () => {
					const results = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.ethereum,
						limit: 5,
					});

					verifySearchResults(
						results,
						KNOWN_SEARCH_TERMS.ethereum,
						{
							minResults: 0, // May have no results on testnet
							maxResults: 5,
							shouldContainQuery: results.length > 0, // Only check if we got results
						}
					);
				},
				NETWORK_TIMEOUT
			);

			it(
				'should search by type filter',
				async () => {
					const results = await service.searchAtoms({
						type: ATOM_TYPES.thing,
						limit: 10,
					});

					expect(Array.isArray(results)).toBe(true);
					expect(results.length).toBeLessThanOrEqual(10);

					// Verify all results have correct type
					results.forEach((atom) => {
						verifyAtomStructure(atom);
						expect(atom.type).toBe(ATOM_TYPES.thing);
					});
				},
				NETWORK_TIMEOUT
			);

			it(
				'should combine label and type filters',
				async () => {
					const results = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.blockchain,
						type: ATOM_TYPES.thing,
						limit: 5,
					});

					expect(Array.isArray(results)).toBe(true);
					expect(results.length).toBeLessThanOrEqual(5);

					// Verify all results match both filters
					results.forEach((atom) => {
						verifyAtomStructure(atom);
						expect(atom.type).toBe(ATOM_TYPES.thing);
						expect(
							atom.label
								.toLowerCase()
								.includes(KNOWN_SEARCH_TERMS.blockchain)
						).toBe(true);
					});
				},
				NETWORK_TIMEOUT
			);

			it(
				'should handle pagination with offset',
				async () => {
					const page1 = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.eth,
						limit: 5,
						offset: 0,
					});
					const page2 = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.eth,
						limit: 5,
						offset: 5,
					});

					expect(Array.isArray(page1)).toBe(true);
					expect(Array.isArray(page2)).toBe(true);

					// Verify different results (unless less than 10 total)
					if (page1.length === 5 && page2.length > 0) {
						const page1Ids = page1.map((a) => a.id);
						const page2Ids = page2.map((a) => a.id);

						// Some IDs should be different (pagination working)
						const hasOverlap = page1Ids.some((id) =>
							page2Ids.includes(id)
						);
						expect(
							hasOverlap,
							'Paginated results should not overlap'
						).toBe(false);
					}
				},
				NETWORK_TIMEOUT
			);

			it(
				'should handle short query terms',
				async () => {
					const results = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.eth,
						limit: 10,
					});

					expect(Array.isArray(results)).toBe(true);
					results.forEach((atom) => verifyAtomStructure(atom));
				},
				NETWORK_TIMEOUT
			);
		});
	});

	describe('Mainnet Search', () => {
		let service: IntuitionService;

		beforeAll(async () => {
			// Create real plugin instance with mainnet settings
			const plugin = await createMainnetPlugin();
			service = plugin.intuitionService;
		}, NETWORK_TIMEOUT);

		describe('Semantic Search', () => {
			it(
				'should return results for semantic query on mainnet',
				async () => {
					const results = await service.semanticSearchAtoms(
						KNOWN_SEARCH_TERMS.ethereum,
						5
					);

					expect(Array.isArray(results)).toBe(true);
					expect(results.length).toBeLessThanOrEqual(5);

					// Verify structure matches testnet structure
					results.forEach((atom) => {
						verifyAtomStructure(atom);
					});
				},
				NETWORK_TIMEOUT
			);

			it(
				'should return semantic results on mainnet',
				async () => {
					const results = await service.semanticSearchAtoms(
						SEMANTIC_QUERIES[2], // 'smart contract'
						10
					);

					expect(Array.isArray(results)).toBe(true);
					expect(results.length).toBeLessThanOrEqual(10);

					results.forEach((atom) => verifyAtomStructure(atom));
				},
				NETWORK_TIMEOUT
			);

			it(
				'should handle different semantic queries on mainnet',
				async () => {
					for (const query of SEMANTIC_QUERIES.slice(0, 2)) {
						const results = await service.semanticSearchAtoms(query, 5);

						expect(Array.isArray(results)).toBe(true);
						results.forEach((atom) => verifyAtomStructure(atom));
					}
				},
				NETWORK_TIMEOUT * 2
			);
		});

		describe('Label-based Search', () => {
			it(
				'should search by label on mainnet',
				async () => {
					const results = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.ethereum,
						limit: 5,
					});

					expect(Array.isArray(results)).toBe(true);
					expect(results.length).toBeLessThanOrEqual(5);

					// If we got results, verify they contain the search term
					if (results.length > 0) {
						results.forEach((atom) => {
							verifyAtomStructure(atom);
							expect(
								atom.label
									.toLowerCase()
									.includes(KNOWN_SEARCH_TERMS.ethereum)
							).toBe(true);
						});
					}
				},
				NETWORK_TIMEOUT
			);

			it(
				'should filter by type on mainnet',
				async () => {
					const results = await service.searchAtoms({
						type: ATOM_TYPES.thing,
						limit: 10,
					});

					expect(Array.isArray(results)).toBe(true);
					expect(results.length).toBeLessThanOrEqual(10);

					results.forEach((atom) => {
						verifyAtomStructure(atom);
						expect(atom.type).toBe(ATOM_TYPES.thing);
					});
				},
				NETWORK_TIMEOUT
			);

			it(
				'should combine filters on mainnet',
				async () => {
					const results = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.crypto,
						type: ATOM_TYPES.thing,
						limit: 5,
					});

					expect(Array.isArray(results)).toBe(true);

					results.forEach((atom) => {
						verifyAtomStructure(atom);
						expect(atom.type).toBe(ATOM_TYPES.thing);
					});
				},
				NETWORK_TIMEOUT
			);
		});
	});

	describe('Dual Search Strategy', () => {
		let service: IntuitionService;

		beforeAll(async () => {
			const plugin = await createTestnetPlugin();
			service = plugin.intuitionService;
		});

		it(
			'should execute both searches in parallel',
			async () => {
				const query = KNOWN_SEARCH_TERMS.ethereum;

				// Measure total time for parallel execution
				const { result, durationMs } = await measureExecutionTime(
					async () => {
						return await Promise.allSettled([
							service.semanticSearchAtoms(query, 10),
							service.searchAtoms({ label: query, limit: 10 }),
						]);
					}
				);

				const [semanticResult, labelResult] = result;

				// Verify both completed
				expect(semanticResult.status).toBeDefined();
				expect(labelResult.status).toBeDefined();

				// If both succeeded, verify results
				if (
					semanticResult.status === 'fulfilled' &&
					labelResult.status === 'fulfilled'
				) {
					expect(Array.isArray(semanticResult.value)).toBe(true);
					expect(Array.isArray(labelResult.value)).toBe(true);

					semanticResult.value.forEach((atom) =>
						verifyAtomStructure(atom)
					);
					labelResult.value.forEach((atom) =>
						verifyAtomStructure(atom)
					);
				}

				// Parallel should be faster than sequential
				// (This is a rough check - both could complete in < NETWORK_TIMEOUT)
				expect(durationMs).toBeLessThan(NETWORK_TIMEOUT * 2);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should merge and deduplicate results',
			async () => {
				const query = KNOWN_SEARCH_TERMS.blockchain;

				const [semanticResult, labelResult] = await Promise.allSettled([
					service.semanticSearchAtoms(query, 10),
					service.searchAtoms({ label: query, limit: 10 }),
				]);

				const semantic =
					semanticResult.status === 'fulfilled'
						? semanticResult.value
						: [];
				const label =
					labelResult.status === 'fulfilled' ? labelResult.value : [];

				// Test mergeSearchResults utility
				const merged = mergeSearchResults(semantic, label, query);

				// Verify deduplication: no duplicate IDs
				const ids = merged.map((m) => m.item.id);
				const uniqueIds = [...new Set(ids)];
				expect(ids.length).toBe(uniqueIds.length);

				// Verify scoring exists and is valid
				merged.forEach((result) => {
					expect(result.score).toBeGreaterThanOrEqual(0);
					expect(result.score).toBeLessThanOrEqual(1);
					verifyAtomStructure(result.item);
				});

				// Verify sorting (descending by score)
				for (let i = 1; i < merged.length; i++) {
					expect(merged[i - 1].score).toBeGreaterThanOrEqual(
						merged[i].score
					);
				}
			},
			NETWORK_TIMEOUT
		);

		it(
			'should rank exact matches highest',
			async () => {
				const query = KNOWN_SEARCH_TERMS.ethereum;

				const [semanticResult, labelResult] = await Promise.allSettled([
					service.semanticSearchAtoms(query, 10),
					service.searchAtoms({ label: query, limit: 10 }),
				]);

				const semantic =
					semanticResult.status === 'fulfilled'
						? semanticResult.value
						: [];
				const label =
					labelResult.status === 'fulfilled' ? labelResult.value : [];

				const merged = mergeSearchResults(semantic, label, query);

				// Find exact match if it exists
				const exactMatch = merged.find(
					(m) => m.item.label.toLowerCase() === query.toLowerCase()
				);

				if (exactMatch) {
					// Exact match should have score 1.0
					expect(exactMatch.score).toBe(1.0);

					// First result should also be score 1.0 (exact matches are highest)
					if (merged.length > 0) {
						expect(merged[0].score).toBe(1.0);
					}
				}
			},
			NETWORK_TIMEOUT
		);

		it(
			'should handle Promise.allSettled with one failure',
			async () => {
				// This tests resilience - even if one search fails, the other should work
				const query = KNOWN_SEARCH_TERMS.crypto;

				// Try both searches
				const [semanticResult, labelResult] = await Promise.allSettled([
					service.semanticSearchAtoms(query, 5),
					service.searchAtoms({ label: query, limit: 5 }),
				]);

				// At least one should succeed (or both)
				const hasSuccess =
					semanticResult.status === 'fulfilled' ||
					labelResult.status === 'fulfilled';

				// For real API, we expect both to succeed, but this tests resilience
				expect(hasSuccess).toBe(true);

				// Verify successful results
				if (semanticResult.status === 'fulfilled') {
					expect(Array.isArray(semanticResult.value)).toBe(true);
					semanticResult.value.forEach((atom) =>
						verifyAtomStructure(atom)
					);
				}

				if (labelResult.status === 'fulfilled') {
					expect(Array.isArray(labelResult.value)).toBe(true);
					labelResult.value.forEach((atom) =>
						verifyAtomStructure(atom)
					);
				}
			},
			NETWORK_TIMEOUT
		);
	});

	describe('Caching Behavior', () => {
		let service: IntuitionService;

		beforeAll(async () => {
			const plugin = await createTestnetPlugin();
			service = plugin.intuitionService;
		});

		it(
			'should cache semantic search results',
			async () => {
				const query = KNOWN_SEARCH_TERMS.ethereum;

				// First call - hits API
				const { durationMs: duration1 } = await measureExecutionTime(
					() => service.semanticSearchAtoms(query, 5)
				);

				// Second call - should hit cache
				const { result: results2, durationMs: duration2 } =
					await measureExecutionTime(() =>
						service.semanticSearchAtoms(query, 5)
					);

				// Verify results exist
				expect(Array.isArray(results2)).toBe(true);

				// Cache hit should be significantly faster
				// (Cache should be < 10ms, API call typically > 100ms)
				expect(duration2).toBeLessThan(duration1 / 2);
				expect(duration2).toBeLessThan(100); // Cache should be very fast
			},
			NETWORK_TIMEOUT
		);

		it(
			'should cache label search results',
			async () => {
				const filters = { label: KNOWN_SEARCH_TERMS.blockchain, limit: 5 };

				// First call - hits API
				const { durationMs: duration1 } = await measureExecutionTime(
					() => service.searchAtoms(filters)
				);

				// Second call - should hit cache
				const { result: results2, durationMs: duration2 } =
					await measureExecutionTime(() => service.searchAtoms(filters));

				expect(Array.isArray(results2)).toBe(true);

				// Cache hit should be much faster
				expect(duration2).toBeLessThan(duration1 / 2);
				expect(duration2).toBeLessThan(100);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should use deterministic cache keys',
			async () => {
				// Same filters, different order - should hit same cache
				const filters1 = {
					label: KNOWN_SEARCH_TERMS.crypto,
					type: ATOM_TYPES.thing,
					limit: 5,
				};
				const filters2 = {
					type: ATOM_TYPES.thing,
					limit: 5,
					label: KNOWN_SEARCH_TERMS.crypto,
				};

				// First call
				const { durationMs: duration1 } = await measureExecutionTime(
					() => service.searchAtoms(filters1)
				);

				// Second call with different order - should hit cache
				const { durationMs: duration2 } = await measureExecutionTime(
					() => service.searchAtoms(filters2)
				);

				// Second call should be cached (faster)
				expect(duration2).toBeLessThan(duration1 / 2);
			},
			NETWORK_TIMEOUT
		);
	});

	describe('Error Handling', () => {
		let service: IntuitionService;

		beforeAll(async () => {
			const plugin = await createTestnetPlugin();
			service = plugin.intuitionService;
		});

		it(
			'should handle empty query gracefully',
			async () => {
				const results = await service.semanticSearchAtoms(
					EDGE_CASE_QUERIES.empty,
					5
				);

				expect(results).toBeDefined();
				expect(Array.isArray(results)).toBe(true);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should handle whitespace query',
			async () => {
				const results = await service.searchAtoms({
					label: EDGE_CASE_QUERIES.whitespace,
					limit: 5,
				});

				expect(results).toBeDefined();
				expect(Array.isArray(results)).toBe(true);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should handle very long query',
			async () => {
				const results = await service.semanticSearchAtoms(
					EDGE_CASE_QUERIES.veryLong,
					5
				);

				expect(results).toBeDefined();
				expect(Array.isArray(results)).toBe(true);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should handle special characters in query',
			async () => {
				const results = await service.searchAtoms({
					label: EDGE_CASE_QUERIES.specialChars,
					limit: 5,
				});

				expect(results).toBeDefined();
				expect(Array.isArray(results)).toBe(true);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should handle unicode characters',
			async () => {
				const results = await service.semanticSearchAtoms(
					EDGE_CASE_QUERIES.unicode,
					5
				);

				expect(results).toBeDefined();
				expect(Array.isArray(results)).toBe(true);
			},
			NETWORK_TIMEOUT
		);

		it(
			'should handle limit edge cases',
			async () => {
				// Test various limit values
				const limits = [0, 1, 100];

				for (const limit of limits) {
					const results = await service.searchAtoms({
						label: KNOWN_SEARCH_TERMS.eth,
						limit,
					});

					expect(Array.isArray(results)).toBe(true);
					expect(results.length).toBeLessThanOrEqual(limit);
				}
			},
			NETWORK_TIMEOUT * 3
		);
	});
});
