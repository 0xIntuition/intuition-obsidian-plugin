/**
 * Search-related types for atom search and selection
 */

import { AtomData } from './intuition';

/**
 * Represents a reference to an atom (either existing or new)
 */
export interface AtomReference {
	type: 'existing' | 'new';
	termId?: string; // Only for existing atoms
	label: string;
	atom?: AtomData; // Full atom data if existing
	confidence: number; // Search relevance score (0-1)
}

/**
 * Internal state for search component
 */
export interface SearchState {
	query: string;
	isSearching: boolean;
	results: AtomData[];
	selectedIndex: number;
	error: string | null;
}

/**
 * Configuration options for atom search component
 */
export interface AtomSearchConfig {
	placeholder: string;
	allowCreate: boolean; // Allow "Create new" option
	minQueryLength: number; // Minimum characters to trigger search
	maxResults: number; // Maximum results to display
	debounceMs: number; // Debounce delay in milliseconds
}

/**
 * Default search configuration
 */
export const DEFAULT_SEARCH_CONFIG: AtomSearchConfig = {
	placeholder: 'Search atoms...',
	allowCreate: true,
	minQueryLength: 2,
	maxResults: 10,
	debounceMs: 300,
};

/**
 * UI timing constants for search component
 */
export const SEARCH_UI_TIMING = {
	/** Delay before hiding dropdown on blur to allow dropdown clicks */
	BLUR_DELAY_MS: 200,
	/** Maximum allowed search query length to prevent injection attacks */
	MAX_QUERY_LENGTH: 200,
} as const;
