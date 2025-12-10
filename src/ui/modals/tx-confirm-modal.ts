import { App, Modal } from 'obsidian';
import { formatEther } from 'viem';
import type IntuitionPlugin from '../../main';
import type {
	ClaimDraft,
	StakeConfig,
	TransactionPlan,
	TransactionStep,
} from '../../types';
import { NETWORKS } from '../../types/networks';

/**
 * Modal for final confirmation and execution of transactions
 *
 * Shows the complete transaction plan and executes each step
 * with real-time status updates.
 */
export class TxConfirmModal extends Modal {
	plugin: IntuitionPlugin;
	private draft: ClaimDraft;
	private stakeConfig: StakeConfig;
	private plan: TransactionPlan;

	private isExecuting: boolean = false;
	private stepsEl: HTMLElement;
	private executeButton: HTMLButtonElement;

	constructor(
		app: App,
		plugin: IntuitionPlugin,
		draft: ClaimDraft,
		stakeConfig: StakeConfig,
		plan: TransactionPlan
	) {
		super(app);
		this.plugin = plugin;
		this.draft = draft;
		this.stakeConfig = stakeConfig;
		this.plan = plan;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('intuition-tx-confirm-modal');

		// Header
		contentEl.createEl('h2', { text: 'Confirm Transactions' });

		// Warning message
		const warning = contentEl.createDiv({ cls: 'tx-confirm-warning' });
		warning.createEl('p', {
			text: 'You are about to sign and submit the following transactions. Please review carefully before continuing.',
		});

		// Transaction steps
		this.stepsEl = contentEl.createDiv({ cls: 'tx-steps' });
		this.renderSteps();

		// Total cost
		const costSection = contentEl.createDiv({ cls: 'tx-cost-section' });
		costSection.createEl('h4', { text: 'Total Cost' });
		const costDiv = costSection.createDiv({ cls: 'tx-total-cost' });
		costDiv.createSpan({ text: 'Total: ' });
		costDiv.createSpan({
			text: `${formatEther(this.plan.totalCost)} TRUST`,
			cls: 'cost-amount',
		});

		// Actions
		this.renderActions(contentEl);
	}

	/**
	 * Render the transaction steps list
	 */
	private renderSteps(): void {
		this.stepsEl.empty();

		this.stepsEl.createEl('h4', { text: 'Transaction Steps' });

		const stepsList = this.stepsEl.createEl('div', { cls: 'tx-steps-list' });

		for (const step of this.plan.steps) {
			const stepDiv = stepsList.createDiv({
				cls: `tx-step status-${step.status}`,
			});

			// Status icon
			const icon = stepDiv.createSpan({ cls: 'tx-step-icon' });
			icon.setText(this.getStatusIcon(step.status));

			// Description
			const description = stepDiv.createDiv({ cls: 'tx-step-description' });
			description.setText(step.description);

			// Transaction hash (if available)
			if (step.hash) {
				const network = NETWORKS[this.plugin.settings.network];
				const hashLink = description.createEl('a', {
					cls: 'tx-step-hash',
					text: `${step.hash.substring(0, 10)}...${step.hash.substring(step.hash.length - 8)}`,
					href: `${network.explorerUrl}/tx/${step.hash}`,
				});
				hashLink.setAttribute('target', '_blank');
				hashLink.setAttribute('rel', 'noopener noreferrer');
			}

			// Error message (if failed)
			if (step.error) {
				const error = stepDiv.createDiv({ cls: 'tx-step-error' });
				error.setText(`Error: ${step.error}`);
			}
		}
	}

	/**
	 * Get status icon for a step
	 */
	private getStatusIcon(
		status: TransactionStep['status']
	): string {
		switch (status) {
			case 'pending':
				return '⏳';
			case 'signing':
				return '✍️';
			case 'confirming':
				return '⏱️';
			case 'confirmed':
				return '✅';
			case 'failed':
				return '❌';
		}
	}

	/**
	 * Render action buttons
	 */
	private renderActions(container: HTMLElement): void {
		const actions = container.createDiv({ cls: 'tx-confirm-actions' });

		const cancelBtn = actions.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			if (!this.isExecuting) {
				this.close();
			}
		});

		this.executeButton = actions.createEl('button', {
			text: 'Sign Transactions',
			cls: 'mod-cta',
		});
		this.executeButton.addEventListener('click', () =>
			this.executeTransactions()
		);
	}

	/**
	 * Execute the transaction plan
	 */
	private async executeTransactions(): Promise<void> {
		this.isExecuting = true;
		this.executeButton.disabled = true;
		this.executeButton.setText('Executing...');

		// Execute the plan
		const result = await this.plugin.transactionService.executeTransactionPlan(
			this.draft,
			this.stakeConfig,
			this.plan,
			(_step) => {
				// Update UI on each step change
				this.renderSteps();
			}
		);

		if (result.success) {
			this.plugin.noticeManager.success('Claim published successfully!');

			// Refresh wallet balance
			await this.plugin.walletService.refreshBalance();

			// TODO: Annotate note if enabled in settings
			// if (this.plugin.settings.ui.annotateOnPublish && result.tripleId) {
			//   // Add claim reference to note
			// }

			this.close();
		} else {
			this.plugin.noticeManager.error(
				`Transaction failed: ${result.error}`
			);

			// Re-enable button to allow retry or cancel
			this.isExecuting = false;
			this.executeButton.disabled = false;
			this.executeButton.setText('Retry');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
