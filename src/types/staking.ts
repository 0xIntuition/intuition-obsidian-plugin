/**
 * Configuration for a stake on a claim
 */
export interface StakeConfig {
	/** Amount to stake in wei */
	amount: bigint;
	/** Position to take on the claim */
	position: 'for' | 'against';
}

/**
 * Preview of the impact a stake will have
 */
export interface ImpactPreview {
	/** Current consensus percentage (0-100) */
	currentConsensus: number;
	/** New consensus after stake (0-100) */
	newConsensus: number;
	/** Change in consensus (delta) */
	consensusChange: number;

	/** Shares you will receive */
	yourShares: bigint;
	/** Your ownership percentage of the vault (0-100) */
	yourOwnershipPercent: number;

	/** Current share price in wei */
	currentSharePrice: bigint;
	/** Estimated value if you exit immediately (in wei) */
	estimatedExitValue: bigint;

	/** Estimated monthly fees (not yet implemented) */
	estimatedMonthlyFees: bigint;
	/** Months to break even (null if no activity) */
	breakEvenMonths: number | null;
}
