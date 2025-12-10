import { App, Modal, Setting } from 'obsidian';
import { formatEther, parseEther } from 'viem';
import type IntuitionPlugin from '../../main';
import type {
	ClaimDraft,
	ImpactPreview,
	TransactionPlan,
	VaultData,
} from '../../types';
import { ImpactCalculator, debounce } from '../../utils';
import { NETWORKS } from '../../types/networks';
import { TxConfirmModal } from './tx-confirm-modal';

/**
 * Modal for configuring stake on a claim
 *
 * Allows user to:
 * - Set stake amount
 * - Choose position (for/against)
 * - Preview impact on consensus
 * - See transaction plan and costs
 */
export class StakeModal extends Modal {
	plugin: IntuitionPlugin;
	private draft: ClaimDraft;
	private impactCalculator: ImpactCalculator;

	private stakeAmount: string;
	private position: 'for' | 'against' = 'for';
	private impact: ImpactPreview | null = null;
	private plan: TransactionPlan | null = null;
	private isCalculating = false;

	private impactEl: HTMLElement;
	private planEl: HTMLElement;
	private submitButton: HTMLButtonElement;
	private calculateImpactDebounced: ReturnType<typeof debounce>;

	constructor(app: App, plugin: IntuitionPlugin, draft: ClaimDraft) {
		super(app);
		this.plugin = plugin;
		this.draft = draft;

		// Initialize impact calculator
		const publicClient = this.plugin.walletService.getPublicClient();
		const network = NETWORKS[this.plugin.settings.network];
		this.impactCalculator = new ImpactCalculator(
			publicClient,
			network.multiVaultAddress
		);

		// Set default stake amount from settings
		this.stakeAmount = this.plugin.settings.ui.defaultStakeAmount;

		// Create debounced version of calculateImpact (300ms delay)
		this.calculateImpactDebounced = debounce(
			() => this.calculateImpact(),
			300
		);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('intuition-stake-modal');

		contentEl.createEl('h2', { text: 'Stake on Claim' });

		// Show claim summary
		this.renderClaimSummary(contentEl);

		// Stake configuration
		this.renderStakeInput(contentEl);

		// Impact preview section
		this.impactEl = contentEl.createDiv({ cls: 'impact-section' });

		// Transaction plan section
		this.planEl = contentEl.createDiv({ cls: 'plan-section' });

		// Actions
		this.renderActions(contentEl);

		// Initial calculation
		this.calculateImpact().catch((error) => {
			console.error('Failed to calculate initial impact:', error);
		});
	}

	/**
	 * Render claim summary
	 */
	private renderClaimSummary(container: HTMLElement): void {
		const summary = container.createDiv({ cls: 'claim-summary' });

		// Triple display
		const tripleText = `[${this.draft.subject?.label}] → [${this.draft.predicate?.label}] → [${this.draft.object?.label}]`;
		summary.createEl('p', { text: tripleText, cls: 'triple-display' });

		// Current consensus (if exists)
		if (this.draft.consensus) {
			const forPercentage = Math.round(this.draft.consensus.consensusRatio * 100);
			const consensusText = `Current consensus: ${forPercentage}% For`;
			summary.createEl('small', { text: consensusText });
		}
	}

	/**
	 * Render stake input section
	 */
	private renderStakeInput(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'stake-input-section' });

		// Amount input
		new Setting(section)
			.setName('Stake Amount')
			.setDesc(
				`Balance: ${this.plugin.walletService.getFormattedBalance()} TRUST`
			)
			.addText((text) =>
				text
					.setPlaceholder('0.001')
					.setValue(this.stakeAmount)
					.onChange((value) => {
						this.stakeAmount = value;
						this.calculateImpactDebounced();
					})
			);

		// Position selector
		new Setting(section)
			.setName('Position')
			.setDesc('Choose your position on this claim')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('for', 'For (agree with claim)')
					.addOption('against', 'Against (disagree with claim)')
					.setValue(this.position)
					.onChange((value: 'for' | 'against') => {
						this.position = value;
						this.calculateImpactDebounced();
					})
			);
	}

	/**
	 * Calculate impact preview
	 */
	private async calculateImpact(): Promise<void> {
		let amount: bigint;
		try {
			amount = parseEther(this.stakeAmount || '0');
		} catch {
			// Invalid input - clear impact and plan
			this.impact = null;
			this.plan = null;
			this.isCalculating = false;
			this.renderImpact();
			this.renderPlan();
			return;
		}

		if (amount <= BigInt(0)) {
			this.impact = null;
			this.plan = null;
			this.isCalculating = false;
			this.renderImpact();
			this.renderPlan();
			return;
		}

		// Set loading state
		this.isCalculating = true;
		this.renderImpact();
		this.renderPlan();

		try {
			// Get vault data
			const { forVault, againstVault } = await this.getVaultData();

			// Calculate impact
			this.impact = await this.impactCalculator.calculateImpact(
				forVault,
				againstVault,
				amount,
				this.position
			);

			// Build transaction plan
			this.plan = await this.plugin.transactionService.buildTransactionPlan(
				this.draft,
				{ amount, position: this.position }
			);

			this.isCalculating = false;
			this.renderImpact();
			this.renderPlan();
		} catch (error) {
			this.isCalculating = false;
			this.renderImpact();
			this.renderPlan();
			console.error('Impact calculation failed:', error);
			this.plugin.noticeManager.error(
				`Failed to calculate impact: ${(error as Error).message}`
			);
		}
	}

	/**
	 * Get vault data for impact calculations
	 */
	private async getVaultData(): Promise<{
		forVault: VaultData;
		againstVault: VaultData;
	}> {
		if (this.draft.existingTriple && this.draft.consensus) {
			// Query vault data for existing triple
			try {
				const forVault = await this.plugin.intuitionService.getVaultState(
					this.draft.consensus.forVaultId
				);
				const againstVault = await this.plugin.intuitionService.getVaultState(
					this.draft.consensus.againstVaultId
				);

				return {
					forVault: forVault || this.getEmptyVault(),
					againstVault: againstVault || this.getEmptyVault(),
				};
			} catch (error) {
				console.error('Failed to fetch vault data:', error);
				// Fall through to empty vaults
			}
		}

		// New claim or failed to fetch - use empty vaults
		return {
			forVault: this.getEmptyVault(),
			againstVault: this.getEmptyVault(),
		};
	}

	/**
	 * Create empty vault data for new claims
	 */
	private getEmptyVault(): VaultData {
		return {
			id: '0',
			totalAssets: BigInt(0),
			totalShares: BigInt(0),
			currentSharePrice: BigInt(Math.floor(1e18)), // 1:1 ratio
			positionCount: 0,
			atomId: null,
			tripleId: null,
		};
	}

	/**
	 * Render impact preview
	 */
	private renderImpact(): void {
		this.impactEl.empty();

		if (this.isCalculating) {
			this.impactEl.createEl('h4', { text: 'Impact Preview' });
			this.impactEl.createDiv({
				text: 'Calculating...',
				cls: 'loading-indicator',
			});
			return;
		}

		if (!this.impact) return;

		this.impactEl.createEl('h4', { text: 'Impact Preview' });

		const grid = this.impactEl.createDiv({ cls: 'impact-grid' });

		// Consensus change
		const consensusRow = grid.createDiv({ cls: 'impact-row' });
		consensusRow.createSpan({ text: 'Consensus Change' });
		const change = this.impact.consensusChange;
		const changeText =
			change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
		const changeClass = change >= 0 ? 'positive' : 'negative';
		consensusRow.createSpan({
			text: `${this.impact.currentConsensus.toFixed(1)}% → ${this.impact.newConsensus.toFixed(1)}% (${changeText})`,
			cls: changeClass,
		});

		// Your shares
		const sharesRow = grid.createDiv({ cls: 'impact-row' });
		sharesRow.createSpan({ text: 'Your Shares' });
		sharesRow.createSpan({
			text: formatEther(this.impact.yourShares),
		});

		// Ownership
		const ownershipRow = grid.createDiv({ cls: 'impact-row' });
		ownershipRow.createSpan({ text: 'Your Ownership' });
		ownershipRow.createSpan({
			text: `${this.impact.yourOwnershipPercent.toFixed(4)}%`,
		});

		// Exit value
		const exitRow = grid.createDiv({ cls: 'impact-row' });
		exitRow.createSpan({ text: 'Estimated Exit Value' });
		exitRow.createSpan({
			text: `${formatEther(this.impact.estimatedExitValue)} TRUST`,
		});
	}

	/**
	 * Render transaction plan
	 */
	private renderPlan(): void {
		this.planEl.empty();

		if (this.isCalculating) {
			this.planEl.createEl('h4', { text: 'Transaction Steps' });
			this.planEl.createDiv({
				text: 'Building plan...',
				cls: 'loading-indicator',
			});
			return;
		}

		if (!this.plan) return;

		this.planEl.createEl('h4', { text: 'Transaction Steps' });

		const list = this.planEl.createEl('ol', { cls: 'plan-steps' });

		for (const step of this.plan.steps) {
			const item = list.createEl('li');
			item.createSpan({ text: step.description });
		}

		// Total cost
		const costDiv = this.planEl.createDiv({ cls: 'total-cost' });
		costDiv.createSpan({ text: 'Total Cost (incl. fees): ' });
		costDiv.createSpan({
			text: `${formatEther(this.plan.totalCost)} TRUST`,
			cls: 'cost-amount',
		});
	}

	/**
	 * Render action buttons
	 */
	private renderActions(container: HTMLElement): void {
		const actions = container.createDiv({ cls: 'stake-actions' });

		const cancelBtn = actions.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		this.submitButton = actions.createEl('button', {
			text: 'Confirm & Sign',
			cls: 'mod-cta',
		});
		this.submitButton.addEventListener('click', () =>
			this.handleSubmit()
		);
	}

	/**
	 * Handle submit
	 */
	private async handleSubmit(): Promise<void> {
		if (!this.plan) {
			this.plugin.noticeManager.error('Please enter a valid stake amount');
			return;
		}

		let amount: bigint;
		try {
			amount = parseEther(this.stakeAmount || '0');
		} catch {
			this.plugin.noticeManager.error('Invalid stake amount format');
			return;
		}

		if (amount <= BigInt(0)) {
			this.plugin.noticeManager.error('Invalid stake amount');
			return;
		}

		// Check wallet is unlocked
		if (!this.plugin.walletService.isUnlocked()) {
			this.plugin.noticeManager.error('Please unlock your wallet first');
			return;
		}

		// Check balance
		const balance =
			this.plugin.walletService.getState().balance || BigInt(0);
		if (balance < this.plan.totalCost) {
			this.plugin.noticeManager.error(
				`Insufficient balance. Required: ${formatEther(this.plan.totalCost)} TRUST, Available: ${formatEther(balance)} TRUST`
			);
			return;
		}

		// Open confirmation modal
		new TxConfirmModal(
			this.app,
			this.plugin,
			this.draft,
			{ amount, position: this.position },
			this.plan
		).open();

		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
