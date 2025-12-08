/**
 * Fuzzy matching utilities for text search with scoring
 */

/**
 * Result of a fuzzy match operation
 */
export interface FuzzyMatchResult {
	score: number; // Match quality score (0-1, higher is better)
	matches: Array<{ start: number; end: number }>; // Character ranges that matched
}

/**
 * Performs fuzzy matching between query and text with scoring
 *
 * Scoring:
 * - Exact match: 1.0
 * - Starts with: 0.9
 * - Contains: 0.7
 * - Fuzzy (character-by-character): 0.3-0.5
 * - No match: null
 *
 * @param query - The search query
 * @param text - The text to search in
 * @returns Match result with score and positions, or null if no match
 *
 * @example
 * fuzzyMatch('test', 'test') // { score: 1.0, matches: [...] }
 * fuzzyMatch('eth', 'Ethereum') // { score: 0.9, matches: [...] }
 * fuzzyMatch('btc', 'bitcoin') // { score: 0.4, matches: [...] }
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatchResult | null {
	if (!query || !text) return null;

	const queryLower = query.toLowerCase();
	const textLower = text.toLowerCase();

	// Exact match gets highest score
	if (textLower === queryLower) {
		return { score: 1, matches: [{ start: 0, end: text.length }] };
	}

	// Starts with query
	if (textLower.startsWith(queryLower)) {
		return { score: 0.9, matches: [{ start: 0, end: query.length }] };
	}

	// Contains query
	const index = textLower.indexOf(queryLower);
	if (index !== -1) {
		return { score: 0.7, matches: [{ start: index, end: index + query.length }] };
	}

	// Fuzzy character-by-character matching
	let queryIndex = 0;
	let score = 0;
	const matches: Array<{ start: number; end: number }> = [];
	let matchStart = -1;

	for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
		if (textLower[i] === queryLower[queryIndex]) {
			if (matchStart === -1) matchStart = i;
			queryIndex++;
			score += 1 / (i + 1); // Earlier matches score higher
		} else if (matchStart !== -1) {
			matches.push({ start: matchStart, end: i });
			matchStart = -1;
		}
	}

	// Add final match if still open
	if (matchStart !== -1) {
		matches.push({ start: matchStart, end: matchStart + 1 });
	}

	// All query characters must be found
	if (queryIndex < queryLower.length) {
		return null;
	}

	return {
		score: (score / query.length) * 0.5, // Normalize and cap at 0.5 for fuzzy
		matches,
	};
}

/**
 * Sorts an array of items by fuzzy match score
 *
 * @param items - Array of items to sort
 * @param query - Search query
 * @param getText - Function to extract text from each item
 * @returns Sorted array with items and their match results
 *
 * @example
 * const items = [
 *   { name: 'Bitcoin' },
 *   { name: 'Ethereum' },
 *   { name: 'Cardano' }
 * ];
 * const sorted = sortByFuzzyScore(items, 'eth', item => item.name);
 * // Returns Ethereum first
 */
export function sortByFuzzyScore<T>(
	items: T[],
	query: string,
	getText: (item: T) => string
): Array<{ item: T; result: FuzzyMatchResult }> {
	const results: Array<{ item: T; result: FuzzyMatchResult }> = [];

	for (const item of items) {
		const result = fuzzyMatch(query, getText(item));
		if (result) {
			results.push({ item, result });
		}
	}

	return results.sort((a, b) => b.result.score - a.result.score);
}
