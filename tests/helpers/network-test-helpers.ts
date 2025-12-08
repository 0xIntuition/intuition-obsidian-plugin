/**
 * Test helpers for real network integration tests
 */

import { AtomData } from '../../src/types/intuition';
import { expect } from 'vitest';
import { wait } from './async-utils';

/**
 * Wait for network operation with timeout
 *
 * @param operation - Promise to wait for
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise that resolves with operation result or rejects on timeout
 *
 * @example
 * const result = await withNetworkTimeout(
 *   service.searchAtoms({ label: 'ethereum' }),
 *   5000
 * );
 */
export async function withNetworkTimeout<T>(
	operation: Promise<T>,
	timeoutMs: number = 10000
): Promise<T> {
	return Promise.race([
		operation,
		new Promise<T>((_, reject) =>
			setTimeout(
				() => reject(new Error(`Network timeout after ${timeoutMs}ms`)),
				timeoutMs
			)
		),
	]);
}

/**
 * Retry network operation on failure with exponential backoff
 *
 * @param operation - Function that returns a Promise
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000)
 * @returns Promise that resolves with operation result or rejects after all retries exhausted
 *
 * @example
 * const result = await retryNetworkOperation(
 *   () => service.semanticSearchAtoms('ethereum', 5),
 *   3
 * );
 */
export async function retryNetworkOperation<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	initialDelayMs: number = 1000
): Promise<T> {
	let lastError: Error;

	for (let i = 0; i < maxRetries; i++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			console.warn(
				`Network operation failed (attempt ${i + 1}/${maxRetries}):`,
				error
			);

			// Don't wait after last attempt
			if (i < maxRetries - 1) {
				const delay = initialDelayMs * Math.pow(2, i); // Exponential backoff
				console.log(`Retrying in ${delay}ms...`);
				await wait(delay);
			}
		}
	}

	throw new Error(
		`Network operation failed after ${maxRetries} attempts: ${lastError!.message}`
	);
}

/**
 * Verify atom structure from API response
 *
 * @param atom - Atom data to verify
 *
 * @example
 * const results = await service.searchAtoms({ label: 'ethereum' });
 * results.forEach(atom => verifyAtomStructure(atom));
 */
export function verifyAtomStructure(atom: AtomData): void {
	// Required fields
	expect(atom.id, 'atom.id should be defined').toBeDefined();
	expect(typeof atom.id, 'atom.id should be string').toBe('string');
	expect(atom.id.length, 'atom.id should not be empty').toBeGreaterThan(0);

	expect(atom.label, 'atom.label should be defined').toBeDefined();
	expect(typeof atom.label, 'atom.label should be string').toBe('string');
	expect(
		atom.label.length,
		'atom.label should not be empty'
	).toBeGreaterThan(0);

	expect(atom.type, 'atom.type should be defined').toBeDefined();
	expect(
		['Person', 'Thing', 'Organization', 'Book', 'Account', 'TextObject', 'ByteObject', 'JsonObject', 'CAIP10', 'Caip22'].includes(
			atom.type
		),
		`atom.type should be valid enum value, got: ${atom.type}`
	).toBe(true);

	expect(
		atom.createdAt,
		'atom.createdAt should be defined'
	).toBeDefined();
	expect(
		typeof atom.createdAt,
		'atom.createdAt should be number'
	).toBe('number');
	expect(
		atom.createdAt,
		'atom.createdAt should be positive'
	).toBeGreaterThan(0);

	// Optional fields (should be correct type if present)
	if (atom.emoji !== undefined && atom.emoji !== null) {
		expect(typeof atom.emoji, 'atom.emoji should be string').toBe('string');
	}

	if (atom.image !== undefined && atom.image !== null) {
		expect(typeof atom.image, 'atom.image should be string').toBe('string');
	}

	if (atom.creatorId !== undefined) {
		expect(typeof atom.creatorId, 'atom.creatorId should be string').toBe(
			'string'
		);
	}
}

/**
 * Verify that search results match query expectations
 *
 * @param results - Search results to verify
 * @param query - Original search query
 * @param options - Verification options
 *
 * @example
 * const results = await service.searchAtoms({ label: 'ethereum', limit: 5 });
 * verifySearchResults(results, 'ethereum', {
 *   minResults: 1,
 *   maxResults: 5,
 *   shouldContainQuery: true
 * });
 */
export function verifySearchResults(
	results: AtomData[],
	query: string,
	options: {
		minResults?: number;
		maxResults?: number;
		shouldContainQuery?: boolean;
		exactMatch?: boolean;
	} = {}
): void {
	const {
		minResults,
		maxResults,
		shouldContainQuery = false,
		exactMatch = false,
	} = options;

	// Verify it's an array
	expect(Array.isArray(results), 'results should be an array').toBe(true);

	// Verify result count constraints
	if (minResults !== undefined) {
		expect(
			results.length,
			`should have at least ${minResults} results`
		).toBeGreaterThanOrEqual(minResults);
	}

	if (maxResults !== undefined) {
		expect(
			results.length,
			`should have at most ${maxResults} results`
		).toBeLessThanOrEqual(maxResults);
	}

	// Verify each result structure
	results.forEach((atom, index) => {
		try {
			verifyAtomStructure(atom);
		} catch (error) {
			throw new Error(`Result ${index} failed validation: ${error}`);
		}
	});

	// Verify query matching if requested
	if (shouldContainQuery && query) {
		const queryLower = query.toLowerCase();
		results.forEach((atom, index) => {
			const labelLower = atom.label.toLowerCase();

			if (exactMatch) {
				expect(
					labelLower,
					`Result ${index} should exactly match query "${query}"`
				).toBe(queryLower);
			} else {
				expect(
					labelLower.includes(queryLower),
					`Result ${index} label "${atom.label}" should contain query "${query}"`
				).toBe(true);
			}
		});
	}
}

/**
 * Measure execution time of an async operation
 *
 * @param operation - Async operation to measure
 * @returns Object with result and duration in milliseconds
 *
 * @example
 * const { result, durationMs } = await measureExecutionTime(
 *   () => service.semanticSearchAtoms('ethereum', 5)
 * );
 * console.log(`Search took ${durationMs}ms`);
 */
export async function measureExecutionTime<T>(
	operation: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
	const startTime = Date.now();
	const result = await operation();
	const durationMs = Date.now() - startTime;

	return { result, durationMs };
}

/**
 * Check if network is available by attempting a simple operation
 *
 * @param checkOperation - Operation to test network connectivity
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns true if network is available, false otherwise
 *
 * @example
 * const isAvailable = await isNetworkAvailable(
 *   () => service.checkConnection()
 * );
 * if (!isAvailable) {
 *   console.log('Skipping integration tests - network unavailable');
 * }
 */
export async function isNetworkAvailable(
	checkOperation: () => Promise<unknown>,
	timeoutMs: number = 5000
): Promise<boolean> {
	try {
		await withNetworkTimeout(checkOperation(), timeoutMs);
		return true;
	} catch (error) {
		console.warn('Network availability check failed:', error);
		return false;
	}
}

/**
 * Create a mock fetch wrapper that logs all calls
 *
 * @returns Object with fetch wrapper and call log
 *
 * @example
 * const { wrappedFetch, calls } = createFetchLogger();
 * global.fetch = wrappedFetch;
 * // ... perform operations ...
 * expect(calls.some(c => c.url.includes('testnet'))).toBe(true);
 */
export function createFetchLogger(): {
	wrappedFetch: typeof fetch;
	calls: Array<{ url: string; options?: RequestInit }>;
} {
	const calls: Array<{ url: string; options?: RequestInit }> = [];
	const originalFetch = global.fetch;

	const wrappedFetch = (async (
		url: string | Request | URL,
		options?: RequestInit
	) => {
		const urlString = url.toString();
		calls.push({ url: urlString, options });
		return originalFetch(url, options);
	}) as typeof fetch;

	return { wrappedFetch, calls };
}
