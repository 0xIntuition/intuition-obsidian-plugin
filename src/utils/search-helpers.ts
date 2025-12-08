/**
 * Helper functions for merging and ranking search results
 */

import { AtomData } from '../types';
import { fuzzyMatch } from './fuzzy-match';

/**
 * Search result with score
 */
export interface ScoredAtom {
	item: AtomData;
	score: number;
}

/**
 * Merges semantic and label search results, deduplicates, and ranks by relevance
 *
 * Ranking priority:
 * 1. Exact label match → score 1.0
 * 2. Semantic search results → score 0.8
 * 3. Fuzzy label matches → score 0.3-0.7
 * 4. Timestamp tiebreaker → newer first
 *
 * @param semanticResults - Results from semantic search
 * @param labelResults - Results from label-based search
 * @param query - Original search query
 * @returns Sorted and deduplicated array of scored atoms
 *
 * @example
 * const merged = mergeSearchResults(
 *   semanticResults,
 *   labelResults,
 *   'ethereum'
 * );
 * // Returns results sorted by relevance
 */
export function mergeSearchResults(
	semanticResults: AtomData[],
	labelResults: AtomData[],
	query: string
): ScoredAtom[] {
	const queryLower = query.toLowerCase();
	const atomMap = new Map<string, ScoredAtom>();

	// Process semantic results (score: 0.8 by default)
	for (const atom of semanticResults) {
		const exactMatch = atom.label.toLowerCase() === queryLower;
		const score = exactMatch ? 1.0 : 0.8;

		atomMap.set(atom.id, { item: atom, score });
	}

	// Process label results with fuzzy matching
	for (const atom of labelResults) {
		const existing = atomMap.get(atom.id);

		// Check for exact match first
		if (atom.label.toLowerCase() === queryLower) {
			if (!existing || existing.score < 1.0) {
				atomMap.set(atom.id, { item: atom, score: 1.0 });
			}
			continue;
		}

		// Use fuzzy matching for scoring
		const fuzzyResult = fuzzyMatch(query, atom.label);
		const score = fuzzyResult?.score || 0;

		// Only add/update if this is a better score
		if (!existing || existing.score < score) {
			atomMap.set(atom.id, { item: atom, score });
		}
	}

	// Convert to array and sort
	const results = Array.from(atomMap.values());

	return results.sort((a, b) => {
		// Primary sort: score (descending)
		if (a.score !== b.score) {
			return b.score - a.score;
		}

		// Tiebreaker: timestamp (newer first)
		return b.item.createdAt - a.item.createdAt;
	});
}
