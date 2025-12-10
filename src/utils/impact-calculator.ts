import type { PublicClient, Address } from 'viem';
import type { VaultData, ImpactPreview } from '../types';

/**
 * MultiVault ABI - partial ABI for read-only functions
 * Full ABI is in transaction-service.ts
 */
const MULTI_VAULT_ABI_READ = [
	{
		name: 'previewDeposit',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'id', type: 'uint256' },
			{ name: 'assets', type: 'uint256' },
		],
		outputs: [{ name: 'shares', type: 'uint256' }],
	},
] as const;

/**
 * Utility class for calculating the impact of a stake on claim consensus
 *
 * This is a pure utility (not a service) that performs calculations based on
 * current vault state and proposed stake amounts.
 */
export class ImpactCalculator {
	constructor(
		private publicClient: PublicClient,
		private multiVaultAddress: Address
	) {}

	/**
	 * Calculate the impact of a stake on a claim
	 *
	 * @param forVault - Vault for the "for" position
	 * @param againstVault - Vault for the "against" position
	 * @param stakeAmount - Amount to stake (in wei)
	 * @param position - Position to take ("for" or "against")
	 * @returns Impact preview with consensus change, shares, ownership, etc.
	 */
	async calculateImpact(
		forVault: VaultData,
		againstVault: VaultData,
		stakeAmount: bigint,
		position: 'for' | 'against'
	): Promise<ImpactPreview> {
		const targetVault = position === 'for' ? forVault : againstVault;

		// 1. Get shares from contract using previewDeposit
		// For new vaults (id: '0'), we can still call preview with a mock ID
		// The contract will return 1:1 ratio for first deposit
		const vaultIdForPreview = targetVault.id === '0' ? BigInt(1) : BigInt(targetVault.id);

		const yourShares = await this.publicClient.readContract({
			address: this.multiVaultAddress,
			abi: MULTI_VAULT_ABI_READ,
			functionName: 'previewDeposit',
			args: [vaultIdForPreview, stakeAmount],
		}) as bigint;

		// 2. Calculate current consensus
		const currentForAssets = forVault.totalAssets;
		const currentAgainstAssets = againstVault.totalAssets;
		const currentTotal = currentForAssets + currentAgainstAssets;

		// Default to 50% if no stakes yet
		const currentConsensus =
			currentTotal > BigInt(0)
				? Number((currentForAssets * BigInt(10000)) / currentTotal) / 100
				: 50;

		// 3. Calculate new consensus after stake
		const newForAssets =
			position === 'for' ? currentForAssets + stakeAmount : currentForAssets;
		const newAgainstAssets =
			position === 'against'
				? currentAgainstAssets + stakeAmount
				: currentAgainstAssets;
		const newTotal = newForAssets + newAgainstAssets;

		const newConsensus =
			newTotal > BigInt(0) ? Number((newForAssets * BigInt(10000)) / newTotal) / 100 : 50;

		// 4. Calculate ownership percentage
		const newTotalShares = targetVault.totalShares + yourShares;
		const yourOwnershipPercent =
			newTotalShares > BigInt(0)
				? Number((yourShares * BigInt(10000)) / newTotalShares) / 100
				: 100; // 100% if first staker

		// 5. Calculate estimated exit value
		// Exit value = shares * share price / 1e18
		const currentSharePrice = targetVault.currentSharePrice;
		const estimatedExitValue = (yourShares * currentSharePrice) / BigInt(Math.floor(1e18));

		// 6. Fee estimation (not yet implemented)
		const estimatedMonthlyFees = BigInt(0);
		const breakEvenMonths = null;

		return {
			currentConsensus,
			newConsensus,
			consensusChange: newConsensus - currentConsensus,
			yourShares,
			yourOwnershipPercent,
			currentSharePrice,
			estimatedExitValue,
			estimatedMonthlyFees,
			breakEvenMonths,
		};
	}
}
