/**
 * Tests for fuzzy matching utility
 */

import { describe, it, expect } from 'vitest';
import { fuzzyMatch, sortByFuzzyScore } from './fuzzy-match';

describe('fuzzyMatch', () => {
	it('should return null for empty inputs', () => {
		expect(fuzzyMatch('', 'test')).toBeNull();
		expect(fuzzyMatch('test', '')).toBeNull();
	});

	it('should score exact match as 1.0', () => {
		const result = fuzzyMatch('test', 'test');
		expect(result).not.toBeNull();
		expect(result?.score).toBe(1);
	});

	it('should score exact match case-insensitively', () => {
		const result = fuzzyMatch('Test', 'test');
		expect(result).not.toBeNull();
		expect(result?.score).toBe(1);
	});

	it('should score starts-with match as 0.9', () => {
		const result = fuzzyMatch('eth', 'Ethereum');
		expect(result).not.toBeNull();
		expect(result?.score).toBe(0.9);
	});

	it('should score contains match as 0.7', () => {
		const result = fuzzyMatch('coin', 'Bitcoin');
		expect(result).not.toBeNull();
		expect(result?.score).toBe(0.7);
	});

	it('should score fuzzy match below 0.7', () => {
		const result = fuzzyMatch('btc', 'bitcoin');
		expect(result).not.toBeNull();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(result!.score).toBeLessThan(0.7);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(result!.score).toBeGreaterThan(0);
	});

	it('should return null for non-matching text', () => {
		const result = fuzzyMatch('xyz', 'abc');
		expect(result).toBeNull();
	});

	it('should find character-by-character matches', () => {
		const result = fuzzyMatch('btc', 'biTCoin');
		expect(result).not.toBeNull();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(result!.score).toBeGreaterThan(0);
	});

	it('should return match positions for exact match', () => {
		const result = fuzzyMatch('test', 'test');
		expect(result).not.toBeNull();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(result!.matches).toEqual([{ start: 0, end: 4 }]);
	});

	it('should return match positions for starts-with', () => {
		const result = fuzzyMatch('eth', 'Ethereum');
		expect(result).not.toBeNull();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(result!.matches).toEqual([{ start: 0, end: 3 }]);
	});

	it('should return match positions for contains', () => {
		const result = fuzzyMatch('coin', 'Bitcoin');
		expect(result).not.toBeNull();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(result!.matches).toEqual([{ start: 3, end: 7 }]);
	});

	it('should handle partial matches at end of text', () => {
		const result = fuzzyMatch('end', 'backend');
		expect(result).not.toBeNull();
		expect(result?.score).toBe(0.7);
	});

	it('should require all query characters to match', () => {
		const result = fuzzyMatch('xyz', 'xya'); // Missing 'z'
		expect(result).toBeNull();
	});

	it('should be case-insensitive', () => {
		const result1 = fuzzyMatch('ETH', 'ethereum');
		const result2 = fuzzyMatch('eth', 'ETHEREUM');
		const result3 = fuzzyMatch('EtH', 'EtHeReUm');

		expect(result1).not.toBeNull();
		expect(result2).not.toBeNull();
		expect(result3).not.toBeNull();
	});
});

describe('sortByFuzzyScore', () => {
	const items = [
		{ name: 'Bitcoin' },
		{ name: 'Ethereum' },
		{ name: 'Cardano' },
		{ name: 'Polkadot' },
	];

	it('should return only matching items', () => {
		const results = sortByFuzzyScore(items, 'eth', (item) => item.name);
		expect(results.length).toBe(1);
		expect(results[0].item.name).toBe('Ethereum');
	});

	it('should sort by score descending', () => {
		const testItems = [
			{ name: 'test' }, // Exact match: 1.0
			{ name: 'testing' }, // Starts with: 0.9
			{ name: 'attest' }, // Contains: 0.7
		];

		const results = sortByFuzzyScore(
			testItems,
			'test',
			(item) => item.name
		);

		expect(results[0].item.name).toBe('test');
		expect(results[1].item.name).toBe('testing');
		expect(results[2].item.name).toBe('attest');
	});

	it('should include scores in results', () => {
		const results = sortByFuzzyScore(items, 'eth', (item) => item.name);
		expect(results[0].result.score).toBe(0.9); // "Ethereum" starts with "eth"
	});

	it('should return empty array when no matches', () => {
		const results = sortByFuzzyScore(items, 'xyz', (item) => item.name);
		expect(results).toEqual([]);
	});

	it('should work with custom getText function', () => {
		const customItems = [
			{ label: 'Apple', value: 1 },
			{ label: 'Application', value: 2 },
			{ label: 'Apply', value: 3 },
		];

		const results = sortByFuzzyScore(
			customItems,
			'app',
			(item) => item.label
		);

		// All three start with "app" so should all match with score 0.9
		expect(results.length).toBe(3);
		expect(results[0].result.score).toBe(0.9);
		// Verify all results have labels that start with "app"
		expect(
			results.every((r) => r.item.label.toLowerCase().startsWith('app'))
		).toBe(true);
	});

	it('should handle single character queries', () => {
		const results = sortByFuzzyScore(items, 'e', (item) => item.name);
		expect(results.length).toBeGreaterThan(0);
	});

	it('should handle special characters in query', () => {
		const specialItems = [{ name: 'test-case' }, { name: 'testcase' }];

		const results = sortByFuzzyScore(
			specialItems,
			'test',
			(item) => item.name
		);

		expect(results.length).toBe(2);
	});
});
