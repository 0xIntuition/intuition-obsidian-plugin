/**
 * Intuition-specific types for atoms, triples, vaults, and positions
 * These represent the core data structures from the Intuition protocol
 */

import type { Address } from 'viem';

/**
 * Atom types define the semantic meaning of an atom
 */
export enum AtomType {
	ACCOUNT = 'Account',
	THING = 'Thing',
	PERSON = 'Person',
	ORGANIZATION = 'Organization',
	BOOK = 'Book',
}

/**
 * Atom - A semantic unit in the knowledge graph
 * Can represent entities, concepts, or data points
 */
export interface AtomData {
	id: string; // termId (numeric string)
	vaultId: string; // Vault ID for this atom
	label: string; // Human-readable label
	emoji: string | null; // Optional emoji representation
	type: AtomType; // Semantic type
	image: string | null; // Optional image URL
	creatorId: string; // Creator's address
	blockTimestamp: number; // When created (Unix timestamp)
}

/**
 * Triple - A relationship between atoms (subject-predicate-object)
 * Forms the edges of the knowledge graph
 */
export interface TripleData {
	id: string; // Triple ID (numeric string)
	vaultId: string; // Vault ID for this triple
	subjectId: string; // Subject atom ID
	predicateId: string; // Predicate atom ID
	objectId: string; // Object atom ID
	subjectLabel: string; // Resolved subject label
	predicateLabel: string; // Resolved predicate label
	objectLabel: string; // Resolved object label
	creatorId: string; // Creator's address
	blockTimestamp: number; // When created
	counterVaultId: string | null; // Counter-claim vault ID if exists
}

/**
 * Vault - Staking pool for an atom or triple
 * Represents market consensus on claims
 */
export interface VaultData {
	id: string; // Vault ID (numeric string)
	atomId: string | null; // Associated atom ID (if atom vault)
	tripleId: string | null; // Associated triple ID (if triple vault)
	totalShares: bigint; // Total shares in vault
	currentSharePrice: bigint; // Current share price in wei
	totalAssets: bigint; // Total assets deposited (calculated)
	positionCount: number; // Number of positions
}

/**
 * Position - User's stake in a vault
 */
export interface PositionData {
	id: string; // Position ID
	vaultId: string; // Vault staked in
	accountId: Address; // User's address
	shares: bigint; // Number of shares owned
	value: bigint; // Current value in wei (calculated)
}

/**
 * Consensus data - For/against voting on a claim
 */
export interface ConsensusData {
	forVaultId: string;
	againstVaultId: string;
	forShares: bigint;
	againstShares: bigint;
	forAssets: bigint;
	againstAssets: bigint;
	consensusRatio: number; // 0-1, where >0.5 means "for" is winning
}

/**
 * Search filters for atom queries
 */
export interface AtomSearchFilters {
	label?: string; // Search by label (partial match)
	type?: AtomType; // Filter by type
	creatorId?: Address; // Filter by creator
	limit?: number; // Max results (default: 10)
	offset?: number; // Pagination offset
}
