import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from './cache-service';
import { PluginError, ErrorCode } from '../types/errors';

describe('CacheService', () => {
	let cache: CacheService;

	beforeEach(() => {
		cache = new CacheService();
		vi.useRealTimers(); // Use real timers by default
	});

	describe('set and get', () => {
		it('should store and retrieve data', () => {
			cache.set('test-key', { value: 'test' }, 1000);
			const result = cache.get<{ value: string }>('test-key');

			expect(result).toEqual({ value: 'test' });
		});

		it('should return null for non-existent key', () => {
			const result = cache.get('non-existent');
			expect(result).toBeNull();
		});

		it('should return null for expired data', () => {
			vi.useFakeTimers();

			cache.set('test-key', 'value', 1000);

			// Advance time past TTL
			vi.advanceTimersByTime(1001);

			const result = cache.get('test-key');
			expect(result).toBeNull();

			vi.useRealTimers();
		});

		it('should return data before expiration', () => {
			vi.useFakeTimers();

			cache.set('test-key', 'value', 1000);

			// Advance time but not past TTL
			vi.advanceTimersByTime(500);

			const result = cache.get('test-key');
			expect(result).toBe('value');

			vi.useRealTimers();
		});

		it('should throw error for non-positive TTL', () => {
			expect(() => cache.set('key', 'value', 0)).toThrow(PluginError);
			expect(() => cache.set('key', 'value', 0)).toThrow('Cache TTL must be positive');
		});

		it('should throw error with correct error code for invalid TTL', () => {
			try {
				cache.set('key', 'value', -1000);
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(PluginError);
				expect((error as PluginError).code).toBe(ErrorCode.CACHE);
				expect((error as PluginError).recoverable).toBe(true);
			}
		});

		it('should handle complex objects', () => {
			const complexData = {
				nested: {
					array: [1, 2, 3],
					object: { key: 'value' },
				},
				number: 42,
				string: 'test',
			};

			cache.set('complex', complexData, 1000);
			const result = cache.get('complex');

			expect(result).toEqual(complexData);
		});

		it('should remove expired entry when accessed', () => {
			vi.useFakeTimers();

			cache.set('test-key', 'value', 1000);

			// Verify it's in cache
			let stats = cache.getStats();
			expect(stats.size).toBe(1);

			// Advance past expiration
			vi.advanceTimersByTime(1001);

			// Access it (should be removed)
			cache.get('test-key');

			// Verify it's removed
			stats = cache.getStats();
			expect(stats.size).toBe(0);

			vi.useRealTimers();
		});
	});

	describe('invalidate', () => {
		it('should remove specific entry', () => {
			cache.set('key1', 'value1', 1000);
			cache.set('key2', 'value2', 1000);

			const result = cache.invalidate('key1');

			expect(result).toBe(true);
			expect(cache.get('key1')).toBeNull();
			expect(cache.get('key2')).toBe('value2');
		});

		it('should return false for non-existent key', () => {
			const result = cache.invalidate('non-existent');
			expect(result).toBe(false);
		});
	});

	describe('invalidatePattern', () => {
		it('should remove all entries matching prefix', () => {
			cache.set('atom:1', 'value1', 1000);
			cache.set('atom:2', 'value2', 1000);
			cache.set('triple:1', 'value3', 1000);

			const count = cache.invalidatePattern('atom:');

			expect(count).toBe(2);
			expect(cache.get('atom:1')).toBeNull();
			expect(cache.get('atom:2')).toBeNull();
			expect(cache.get('triple:1')).toBe('value3');
		});

		it('should return 0 if no matches', () => {
			cache.set('key1', 'value1', 1000);
			const count = cache.invalidatePattern('nonexistent:');
			expect(count).toBe(0);
		});

		it('should handle empty cache', () => {
			const count = cache.invalidatePattern('atom:');
			expect(count).toBe(0);
		});

		it('should handle complex patterns', () => {
			cache.set('search:label:test', 'value1', 1000);
			cache.set('search:type:Thing', 'value2', 1000);
			cache.set('atom:123', 'value3', 1000);

			const count = cache.invalidatePattern('search:');

			expect(count).toBe(2);
			expect(cache.get('search:label:test')).toBeNull();
			expect(cache.get('search:type:Thing')).toBeNull();
			expect(cache.get('atom:123')).toBe('value3');
		});
	});

	describe('clear', () => {
		it('should remove all entries', () => {
			cache.set('key1', 'value1', 1000);
			cache.set('key2', 'value2', 1000);
			cache.set('key3', 'value3', 1000);

			cache.clear();

			expect(cache.get('key1')).toBeNull();
			expect(cache.get('key2')).toBeNull();
			expect(cache.get('key3')).toBeNull();
			expect(cache.getStats().size).toBe(0);
		});

		it('should handle empty cache', () => {
			cache.clear();
			expect(cache.getStats().size).toBe(0);
		});
	});

	describe('cleanup', () => {
		it('should remove only expired entries', () => {
			vi.useFakeTimers();

			cache.set('expired1', 'value1', 1000);
			cache.set('expired2', 'value2', 1000);
			cache.set('valid', 'value3', 5000);

			// Advance time to expire first two
			vi.advanceTimersByTime(1001);

			const removed = cache.cleanup();

			expect(removed).toBe(2);
			expect(cache.get('expired1')).toBeNull();
			expect(cache.get('expired2')).toBeNull();
			expect(cache.get('valid')).toBe('value3');

			vi.useRealTimers();
		});

		it('should return 0 if no expired entries', () => {
			cache.set('key1', 'value1', 10000);
			cache.set('key2', 'value2', 10000);

			const removed = cache.cleanup();

			expect(removed).toBe(0);
			expect(cache.getStats().size).toBe(2);
		});

		it('should handle empty cache', () => {
			const removed = cache.cleanup();
			expect(removed).toBe(0);
		});
	});

	describe('getStats', () => {
		it('should return size and keys', () => {
			cache.set('key1', 'value1', 1000);
			cache.set('key2', 'value2', 1000);

			const stats = cache.getStats();

			expect(stats.size).toBe(2);
			expect(stats.keys).toEqual(['key1', 'key2']);
		});

		it('should return empty stats for empty cache', () => {
			const stats = cache.getStats();

			expect(stats.size).toBe(0);
			expect(stats.keys).toEqual([]);
		});
	});
});
