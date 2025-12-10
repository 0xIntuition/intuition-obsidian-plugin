import { parseEther, type Hex, bytesToHex, decodeEventLog } from 'viem';
import {
	intuitionTestnet,
	intuitionMainnet,
} from '@0xintuition/protocol';
import { BaseService } from './base-service';
import type {
	ClaimDraft,
	StakeConfig,
	TransactionPlan,
	TransactionStep,
	PublishResult,
} from '../types';
import { NETWORKS } from '../types/networks';
import type IntuitionPlugin from '../main';

/**
 * MultiVault ABI - Full ABI for all contract interactions
 * Also exported for use in ImpactCalculator and other utilities
 */
export const MULTI_VAULT_ABI = [
	{
		name: 'createAtom',
		type: 'function',
		stateMutability: 'payable',
		inputs: [{ name: 'atomUri', type: 'bytes' }],
		outputs: [{ name: 'id', type: 'uint256' }],
	},
	{
		name: 'createTriple',
		type: 'function',
		stateMutability: 'payable',
		inputs: [
			{ name: 'subjectId', type: 'uint256' },
			{ name: 'predicateId', type: 'uint256' },
			{ name: 'objectId', type: 'uint256' },
		],
		outputs: [{ name: 'id', type: 'uint256' }],
	},
	{
		name: 'depositTriple',
		type: 'function',
		stateMutability: 'payable',
		inputs: [
			{ name: 'receiver', type: 'address' },
			{ name: 'id', type: 'uint256' },
		],
		outputs: [{ name: 'shares', type: 'uint256' }],
	},
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
	{
		name: 'getCounterIdFromTripleId',
		type: 'function',
		stateMutability: 'view',
		inputs: [{ name: 'id', type: 'uint256' }],
		outputs: [{ name: 'counterId', type: 'uint256' }],
	},
	// Events
	{
		name: 'AtomCreated',
		type: 'event',
		inputs: [
			{ name: 'id', type: 'uint256', indexed: true },
			{ name: 'creator', type: 'address', indexed: true },
			{ name: 'atomUri', type: 'bytes', indexed: false },
		],
	},
	{
		name: 'TripleCreated',
		type: 'event',
		inputs: [
			{ name: 'id', type: 'uint256', indexed: true },
			{ name: 'creator', type: 'address', indexed: true },
			{ name: 'subjectId', type: 'uint256', indexed: false },
			{ name: 'predicateId', type: 'uint256', indexed: false },
			{ name: 'objectId', type: 'uint256', indexed: false },
		],
	},
	{
		name: 'Deposited',
		type: 'event',
		inputs: [
			{ name: 'sender', type: 'address', indexed: true },
			{ name: 'receiver', type: 'address', indexed: true },
			{ name: 'id', type: 'uint256', indexed: true },
			{ name: 'assets', type: 'uint256', indexed: false },
			{ name: 'shares', type: 'uint256', indexed: false },
		],
	},
] as const;

// Fee constants (in ETH, will be converted to wei)
const ATOM_CREATION_FEE = parseEther('0.0003');
const TRIPLE_CREATION_FEE = parseEther('0.0004');

/**
 * Service for building and executing blockchain transactions
 *
 * Handles the complete publishing flow:
 * 1. Building transaction plans (which steps are needed)
 * 2. Executing plans step-by-step
 * 3. Parsing results from receipts
 * 4. Error handling and recovery
 */
export class TransactionService extends BaseService {
	constructor(plugin: IntuitionPlugin) {
		super(plugin);
	}

	/**
	 * Initialize the service (no-op for this service)
	 */
	async initialize(): Promise<void> {
		// No initialization needed
	}

	/**
	 * Clean up the service (no-op for this service)
	 */
	cleanup(): void {
		// No cleanup needed
	}

	/**
	 * Build a transaction plan for publishing a claim
	 *
	 * Analyzes the draft and determines which transactions are needed:
	 * - createAtom for each new atom
	 * - createTriple if claim doesn't exist
	 * - depositTriple to stake on the claim
	 *
	 * @param draft - Claim draft to publish
	 * @param stakeConfig - Stake configuration (amount and position)
	 * @returns Transaction plan with steps and cost estimates
	 */
	async buildTransactionPlan(
		draft: ClaimDraft,
		stakeConfig: StakeConfig
	): Promise<TransactionPlan> {
		const steps: TransactionStep[] = [];
		let totalCost = stakeConfig.amount;

		// Check which atoms need to be created
		if (draft.subject?.type === 'new') {
			steps.push({
				id: crypto.randomUUID(),
				type: 'createAtom',
				description: `Create atom: ${draft.subject.label}`,
				status: 'pending',
			});
			totalCost += ATOM_CREATION_FEE;
		}

		if (draft.predicate?.type === 'new') {
			steps.push({
				id: crypto.randomUUID(),
				type: 'createAtom',
				description: `Create atom: ${draft.predicate.label}`,
				status: 'pending',
			});
			totalCost += ATOM_CREATION_FEE;
		}

		if (draft.object?.type === 'new') {
			steps.push({
				id: crypto.randomUUID(),
				type: 'createAtom',
				description: `Create atom: ${draft.object.label}`,
				status: 'pending',
			});
			totalCost += ATOM_CREATION_FEE;
		}

		// Create triple if it doesn't exist
		if (!draft.existingTriple) {
			steps.push({
				id: crypto.randomUUID(),
				type: 'createTriple',
				description: 'Create triple claim',
				status: 'pending',
			});
			totalCost += TRIPLE_CREATION_FEE;
		}

		// Always deposit stake
		const stakeAmountEth = Number(stakeConfig.amount) / 1e18;
		steps.push({
			id: crypto.randomUUID(),
			type: 'depositTriple',
			description: `Stake ${stakeAmountEth.toFixed(4)} TRUST (${stakeConfig.position})`,
			status: 'pending',
		});

		// Estimate gas (rough estimate based on step count)
		const estimatedGas = BigInt(steps.length * 200000);

		return {
			steps,
			totalCost,
			estimatedGas,
		};
	}

	/**
	 * Execute a transaction plan step-by-step
	 *
	 * Executes each transaction in sequence, calling onStepUpdate after each
	 * status change to allow UI updates.
	 *
	 * @param draft - Claim draft to publish
	 * @param stakeConfig - Stake configuration
	 * @param plan - Transaction plan to execute
	 * @param onStepUpdate - Callback for step status updates
	 * @returns Publish result with success status and transaction hashes
	 */
	async executeTransactionPlan(
		draft: ClaimDraft,
		stakeConfig: StakeConfig,
		plan: TransactionPlan,
		onStepUpdate: (step: TransactionStep) => void
	): Promise<PublishResult> {
		const network = NETWORKS[this.plugin.settings.network];
		const multiVaultAddress = network.multiVaultAddress;
		const walletClient = this.plugin.walletService.getWalletClient();
		const publicClient = this.plugin.walletService.getPublicClient();
		const address = this.plugin.walletService.getAddress();

		if (!address) {
			throw new Error('Wallet address not available');
		}

		// Get the appropriate chain config
		const chain =
			this.plugin.settings.network === 'mainnet'
				? intuitionMainnet
				: intuitionTestnet;

		// Validate balance before starting
		const balance = this.plugin.walletService.getState().balance || BigInt(0);
		if (balance < plan.totalCost) {
			throw new Error(
				`Insufficient balance. Required: ${Number(plan.totalCost) / 1e18} TRUST, Available: ${Number(balance) / 1e18} TRUST`
			);
		}

		const atomsCreated: Hex[] = [];
		const transactionHashes: Hex[] = [];
		let subjectId: bigint | undefined;
		let predicateId: bigint | undefined;
		let objectId: bigint | undefined;
		let tripleId: bigint | undefined;
		let sharesReceived: bigint | undefined;

		try {
			for (const step of plan.steps) {
				step.status = 'signing';
				onStepUpdate(step);

				let hash: Hex;

				switch (step.type) {
					case 'createAtom': {
						// Determine which atom this is
						let atomLabel: string;
						if (!subjectId && draft.subject?.type === 'new') {
							atomLabel = draft.subject.label;
						} else if (!predicateId && draft.predicate?.type === 'new') {
							atomLabel = draft.predicate.label;
						} else if (!objectId && draft.object?.type === 'new') {
							atomLabel = draft.object.label;
						} else {
							throw new Error('Unexpected createAtom step');
						}

						// Simplified atom URI: just encode the label
						// In production, this would be a full IPFS metadata object
						const atomUriBytes = new TextEncoder().encode(atomLabel);
						const atomUri = bytesToHex(atomUriBytes);

						hash = await walletClient.writeContract({
							address: multiVaultAddress,
							abi: MULTI_VAULT_ABI,
							functionName: 'createAtom',
							args: [atomUri],
							value: ATOM_CREATION_FEE,
							account: address,
							chain,
						});

						step.status = 'confirming';
						step.hash = hash;
						onStepUpdate(step);

						const receipt = await publicClient.waitForTransactionReceipt({
							hash,
						});

						// Parse atom ID from AtomCreated event
						const atomCreatedLog = receipt.logs.find((log) => {
							try {
								const decoded = decodeEventLog({
									abi: MULTI_VAULT_ABI,
									data: log.data,
									topics: log.topics,
								});
								return decoded.eventName === 'AtomCreated';
							} catch {
								return false;
							}
						});

						if (!atomCreatedLog) {
							throw new Error(
								`AtomCreated event not found in receipt for atom: ${atomLabel}`
							);
						}

						const decodedAtom = decodeEventLog({
							abi: MULTI_VAULT_ABI,
							data: atomCreatedLog.data,
							topics: atomCreatedLog.topics,
						});

						const atomId = decodedAtom.args.id as bigint;
						atomsCreated.push(hash);

						// Assign to correct field
						if (!subjectId && draft.subject?.type === 'new') {
							subjectId = atomId;
						} else if (!predicateId && draft.predicate?.type === 'new') {
							predicateId = atomId;
						} else {
							objectId = atomId;
						}
						break;
					}

					case 'createTriple': {
						// Get IDs for existing atoms
						if (!subjectId && draft.subject?.type === 'existing') {
							if (!draft.subject.termId) {
								throw new Error('Subject termId is missing');
							}
							subjectId = BigInt(draft.subject.termId);
						}
						if (!predicateId && draft.predicate?.type === 'existing') {
							if (!draft.predicate.termId) {
								throw new Error('Predicate termId is missing');
							}
							predicateId = BigInt(draft.predicate.termId);
						}
						if (!objectId && draft.object?.type === 'existing') {
							if (!draft.object.termId) {
								throw new Error('Object termId is missing');
							}
							objectId = BigInt(draft.object.termId);
						}

						if (!subjectId || !predicateId || !objectId) {
							throw new Error(
								'Missing atom IDs for createTriple transaction'
							);
						}

						hash = await walletClient.writeContract({
							address: multiVaultAddress,
							abi: MULTI_VAULT_ABI,
							functionName: 'createTriple',
							args: [subjectId, predicateId, objectId],
							value: TRIPLE_CREATION_FEE,
							account: address,
							chain,
						});

						step.status = 'confirming';
						step.hash = hash;
						onStepUpdate(step);

						const receipt = await publicClient.waitForTransactionReceipt({
							hash,
						});

						// Parse triple ID from TripleCreated event
						const tripleCreatedLog = receipt.logs.find((log) => {
							try {
								const decoded = decodeEventLog({
									abi: MULTI_VAULT_ABI,
									data: log.data,
									topics: log.topics,
								});
								return decoded.eventName === 'TripleCreated';
							} catch {
								return false;
							}
						});

						if (!tripleCreatedLog) {
							throw new Error('TripleCreated event not found in receipt');
						}

						const decodedTriple = decodeEventLog({
							abi: MULTI_VAULT_ABI,
							data: tripleCreatedLog.data,
							topics: tripleCreatedLog.topics,
						});

						tripleId = decodedTriple.args.id as bigint;
						break;
					}

					case 'depositTriple': {
						// Get triple ID
						if (!tripleId && draft.existingTriple) {
							tripleId = BigInt(draft.existingTriple.id);
						}

						if (!tripleId) {
							throw new Error('Triple ID is not available for deposit');
						}

						// Determine vault ID based on position
						let vaultId: bigint;
						if (stakeConfig.position === 'for') {
							// For position uses the triple's vault ID directly
							vaultId = tripleId;
						} else {
							// Against position uses the counter vault
							// Always get from contract as the source of truth
							const counterVaultId = (await publicClient.readContract({
								address: multiVaultAddress,
								abi: MULTI_VAULT_ABI,
								functionName: 'getCounterIdFromTripleId',
								args: [tripleId],
							})) as bigint;
							vaultId = counterVaultId;
						}

						hash = await walletClient.writeContract({
							address: multiVaultAddress,
							abi: MULTI_VAULT_ABI,
							functionName: 'depositTriple',
							args: [address, vaultId],
							value: stakeConfig.amount,
							account: address,
							chain,
						});

						step.status = 'confirming';
						step.hash = hash;
						onStepUpdate(step);

						const receipt = await publicClient.waitForTransactionReceipt({
							hash,
						});

						// Parse shares received from Deposited event
						const depositedLog = receipt.logs.find((log) => {
							try {
								const decoded = decodeEventLog({
									abi: MULTI_VAULT_ABI,
									data: log.data,
									topics: log.topics,
								});
								return decoded.eventName === 'Deposited';
							} catch {
								return false;
							}
						});

						if (!depositedLog) {
							throw new Error('Deposited event not found in receipt');
						}

						const decodedDeposit = decodeEventLog({
							abi: MULTI_VAULT_ABI,
							data: depositedLog.data,
							topics: depositedLog.topics,
						});

						// Type assertion: we know this is a Deposited event which has shares
						sharesReceived = (
							decodedDeposit.args as {
								sender: `0x${string}`;
								receiver: `0x${string}`;
								id: bigint;
								assets: bigint;
								shares: bigint;
							}
						).shares;
						break;
					}
				}

				step.status = 'confirmed';
				transactionHashes.push(hash);
				onStepUpdate(step);
			}

			return {
				success: true,
				tripleId: tripleId ? (`0x${tripleId.toString(16)}` as Hex) : undefined,
				atomsCreated,
				transactionHashes,
				sharesReceived,
			};
		} catch (error) {
			// Mark the failed step
			const failedStep = plan.steps.find(
				(s) => s.status === 'signing' || s.status === 'confirming'
			);
			if (failedStep) {
				failedStep.status = 'failed';
				failedStep.error = (error as Error).message;
				onStepUpdate(failedStep);
			}

			return {
				success: false,
				atomsCreated,
				transactionHashes,
				error: (error as Error).message,
			};
		}
	}
}
