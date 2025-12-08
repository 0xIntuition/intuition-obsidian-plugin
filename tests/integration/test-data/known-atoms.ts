/**
 * Well-known atoms and queries for integration testing
 *
 * These are popular concepts that are likely to exist on both testnet and mainnet.
 * Tests verify that results are returned, not that specific atom IDs match between networks.
 */

/**
 * Common search terms that should return results on both networks
 */
export const KNOWN_SEARCH_TERMS = {
	// Blockchain/Crypto terms
	ethereum: 'ethereum',
	bitcoin: 'bitcoin',
	blockchain: 'blockchain',
	crypto: 'crypto',
	web3: 'web3',

	// Short queries for partial matching
	eth: 'eth',
	btc: 'btc',
} as const;

/**
 * Semantic search queries that should return relevant results
 * These test the AI-powered semantic search functionality
 */
export const SEMANTIC_QUERIES = [
	'digital currency',
	'decentralized',
	'smart contract',
	'cryptocurrency',
	'distributed ledger',
] as const;

/**
 * Atom types to test filtering
 */
export const ATOM_TYPES = {
	person: 'Person',
	thing: 'Thing',
	organization: 'Organization',
	book: 'Book',
	account: 'Account',
} as const;

/**
 * Edge case queries for error handling tests
 */
export const EDGE_CASE_QUERIES = {
	empty: '',
	whitespace: '   ',
	veryLong: 'ethereum '.repeat(50), // 450 chars
	specialChars: 'web3.js',
	unlikely: 'xyzabc123veryveryunlikely',
	unicode: '🚀 crypto',
} as const;
