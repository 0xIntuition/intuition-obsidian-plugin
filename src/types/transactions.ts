import type { Hex } from 'viem';

/**
 * Type of transaction that can be executed
 */
export type TransactionType = 'createAtom' | 'createTriple' | 'depositTriple';

/**
 * Single step in a transaction plan
 */
export interface TransactionStep {
	/** Unique identifier for this step */
	id: string;
	/** Type of transaction */
	type: TransactionType;
	/** Human-readable description */
	description: string;
	/** Current status of the step */
	status: 'pending' | 'signing' | 'confirming' | 'confirmed' | 'failed';
	/** Transaction hash (available after signing) */
	hash?: Hex;
	/** Error message (if status is 'failed') */
	error?: string;
}

/**
 * Complete plan for publishing a claim
 */
export interface TransactionPlan {
	/** Steps to execute in order */
	steps: TransactionStep[];
	/** Total cost including stake and fees (in wei) */
	totalCost: bigint;
	/** Estimated gas cost (in wei) */
	estimatedGas: bigint;
}

/**
 * Result of publishing a claim
 */
export interface PublishResult {
	/** Whether the publish was successful */
	success: boolean;
	/** ID of the created/deposited triple */
	tripleId?: Hex;
	/** List of atoms created (transaction hashes) */
	atomsCreated: Hex[];
	/** All transaction hashes executed */
	transactionHashes: Hex[];
	/** Shares received from deposit */
	sharesReceived?: bigint;
	/** Error message (if success is false) */
	error?: string;
}
