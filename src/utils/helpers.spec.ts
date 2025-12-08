import { describe, it, expect } from 'vitest';
import {
	formatTimestamp,
	deepMergeSettings,
	truncateAddress,
	createDeterministicCacheKey,
} from './helpers';

describe('formatTimestamp', () => {
	it('should format a timestamp to locale string', () => {
		const timestamp = 1640000000000; // December 20, 2021
		const result = formatTimestamp(timestamp);
		expect(result).toContain('2021');
		expect(typeof result).toBe('string');
	});

	it('should handle current timestamp', () => {
		const now = Date.now();
		const result = formatTimestamp(now);
		expect(result).toBeDefined();
		expect(typeof result).toBe('string');
	});
});

describe('truncateAddress', () => {
	it('should truncate long addresses with default length', () => {
		const address = '0x1234567890abcdef1234567890abcdef12345678';
		const result = truncateAddress(address);
		expect(result).toBe('0x1234...345678');
	});

	it('should truncate addresses with custom length', () => {
		const address = '0x1234567890abcdef1234567890abcdef12345678';
		const result = truncateAddress(address, 4);
		expect(result).toBe('0x12...5678');
	});

	it('should return original address if too short', () => {
		const address = '0x1234';
		const result = truncateAddress(address, 6);
		expect(result).toBe('0x1234');
	});

	it('should handle empty string', () => {
		const result = truncateAddress('');
		expect(result).toBe('');
	});

	it('should handle null/undefined inputs', () => {
		expect(truncateAddress(null as any)).toBe('');
		expect(truncateAddress(undefined as any)).toBe('');
	});
});

describe('deepMergeSettings', () => {
	it('should merge nested objects correctly', () => {
		const defaults = {
			network: 'base',
			cacheSettings: {
				enabled: true,
				ttl: 300000,
				maxSize: 100,
			},
		};

		const saved = {
			network: 'base-sepolia',
			cacheSettings: {
				ttl: 600000,
			},
		} as any;

		const result = deepMergeSettings(defaults, saved);

		expect(result.network).toBe('base-sepolia');
		expect(result.cacheSettings.enabled).toBe(true); // From defaults
		expect(result.cacheSettings.ttl).toBe(600000); // From saved
		expect(result.cacheSettings.maxSize).toBe(100); // From defaults
	});

	it('should handle null values in saved settings', () => {
		const defaults = {
			network: 'base',
			rpcUrl: 'https://default.com',
		};

		const saved = {
			network: 'base-sepolia',
			rpcUrl: null,
		} as any;

		const result = deepMergeSettings(defaults, saved);

		expect(result.network).toBe('base-sepolia');
		expect(result.rpcUrl).toBeNull(); // Null from saved overrides default
	});

	it('should handle array replacement (not merge)', () => {
		const defaults = {
			items: [1, 2, 3],
			name: 'test',
		};

		const saved = {
			items: [4, 5],
		};

		const result = deepMergeSettings(defaults, saved);

		expect(result.items).toEqual([4, 5]); // Arrays are replaced, not merged
		expect(result.name).toBe('test');
	});

	it('should handle deeply nested objects', () => {
		const defaults = {
			level1: {
				level2: {
					level3: {
						value: 'default',
						other: 'keep',
					},
				},
			},
		};

		const saved = {
			level1: {
				level2: {
					level3: {
						value: 'saved',
					},
				},
			},
		} as any;

		const result = deepMergeSettings(defaults, saved);

		expect(result.level1.level2.level3.value).toBe('saved');
		expect(result.level1.level2.level3.other).toBe('keep');
	});

	it('should handle empty saved settings', () => {
		const defaults = {
			network: 'base',
			rpcUrl: 'https://default.com',
		};

		const result = deepMergeSettings(defaults, {});

		expect(result).toEqual(defaults);
	});
});

describe('createDeterministicCacheKey', () => {
	it('should create deterministic keys regardless of property order', () => {
		const obj1 = { label: 'test', type: 'Thing', creatorId: '0x123' };
		const obj2 = { type: 'Thing', creatorId: '0x123', label: 'test' };

		const key1 = createDeterministicCacheKey('search:', obj1);
		const key2 = createDeterministicCacheKey('search:', obj2);

		expect(key1).toBe(key2);
	});

	it('should filter out undefined values', () => {
		const obj = { label: 'test', type: undefined, creatorId: '0x123' };
		const key = createDeterministicCacheKey('search:', obj);

		expect(key).toBe('search:creatorId:0x123,label:test');
		expect(key).not.toContain('type');
	});

	it('should sort keys alphabetically', () => {
		const obj = { z: 'last', a: 'first', m: 'middle' };
		const key = createDeterministicCacheKey('test:', obj);

		expect(key).toBe('test:a:first,m:middle,z:last');
	});

	it('should handle empty objects', () => {
		const key = createDeterministicCacheKey('test:', {});
		expect(key).toBe('test:');
	});

	it('should convert values to strings', () => {
		const obj = { number: 42, boolean: true, string: 'test' };
		const key = createDeterministicCacheKey('test:', obj);

		expect(key).toContain('number:42');
		expect(key).toContain('boolean:true');
		expect(key).toContain('string:test');
	});

	it('should handle null values (not filtered like undefined)', () => {
		const obj = { a: 'test', b: null, c: 'value' };
		const key = createDeterministicCacheKey('test:', obj);

		expect(key).toContain('b:null');
	});
});
