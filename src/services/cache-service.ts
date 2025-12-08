/**
 * CacheService - Simplified in-memory cache with TTL expiry
 *
 * Design: Map-based storage with TTL expiration only
 * - No LRU eviction
 * - No size limits
 * - Pattern-based invalidation
 * - Per-entry TTL configuration
 */

import { PluginError, ErrorCode } from '../types/errors';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number; // milliseconds
}

export class CacheService {
	private cache: Map<string, CacheEntry<unknown>>;

	constructor() {
		this.cache = new Map();
	}

	/**
	 * Get cached data if not expired
	 * @returns Cached data or null if expired/not found
	 */
	get<T>(key: string): T | null {
		const entry = this.cache.get(key) as CacheEntry<T> | undefined;

		if (!entry) {
			return null;
		}

		const now = Date.now();
		const age = now - entry.timestamp;

		if (age > entry.ttl) {
			// Expired - remove and return null
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	/**
	 * Store data in cache with TTL
	 */
	set<T>(key: string, data: T, ttl: number): void {
		if (ttl <= 0) {
			throw new PluginError(
				'Cache TTL must be positive',
				ErrorCode.CACHE,
				true
			);
		}

		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl,
		});
	}

	/**
	 * Invalidate specific cache entry
	 */
	invalidate(key: string): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Invalidate all entries matching pattern
	 * Uses simple prefix matching for now
	 * @example invalidatePattern('atom:') clears all atom cache entries
	 */
	invalidatePattern(pattern: string): number {
		let count = 0;
		const keysToDelete: string[] = [];

		// Collect keys to delete
		for (const key of this.cache.keys()) {
			if (key.startsWith(pattern)) {
				keysToDelete.push(key);
			}
		}

		// Delete collected keys
		for (const key of keysToDelete) {
			this.cache.delete(key);
			count++;
		}

		return count;
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getStats(): { size: number; keys: string[] } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys()),
		};
	}

	/**
	 * Clean up expired entries (can be called periodically)
	 * @returns Number of entries removed
	 */
	cleanup(): number {
		let removed = 0;
		const now = Date.now();
		const keysToDelete: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			const age = now - entry.timestamp;
			if (age > entry.ttl) {
				keysToDelete.push(key);
			}
		}

		for (const key of keysToDelete) {
			this.cache.delete(key);
			removed++;
		}

		return removed;
	}
}
