import { App, Modal } from 'obsidian';
import type IntuitionPlugin from '../../main';

export class BudgetWarningModal extends Modal {
	private plugin: IntuitionPlugin;
	private currentUsage: number;
	private monthlyBudget: number;
	private estimatedCost: number;
	private onContinue: () => void;
	private onCancel: () => void;

	constructor(
		app: App,
		plugin: IntuitionPlugin,
		currentUsage: number,
		monthlyBudget: number,
		estimatedCost: number,
		onContinue: () => void,
		onCancel: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.currentUsage = currentUsage;
		this.monthlyBudget = monthlyBudget;
		this.estimatedCost = estimatedCost;
		this.onContinue = onContinue;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('budget-warning-modal');

		// Header
		contentEl.createEl('h2', { text: '⚠️ Budget Warning' });

		// Usage stats
		const usagePercentage = Math.round((this.currentUsage / this.monthlyBudget) * 100);
		const usageSection = contentEl.createDiv({ cls: 'budget-usage-section' });

		usageSection.createEl('p', {
			text: `You've used ${usagePercentage}% of your monthly budget.`
		});

		// Progress bar
		const progressBar = usageSection.createDiv({ cls: 'budget-progress-bar' });
		const progressFill = progressBar.createDiv({ cls: 'budget-progress-fill' });
		progressFill.style.width = `${Math.min(usagePercentage, 100)}%`;

		// Current usage
		usageSection.createEl('p', {
			text: `Current usage: $${this.currentUsage.toFixed(4)} / $${this.monthlyBudget.toFixed(2)}`,
			cls: 'budget-usage-text'
		});

		// Estimated cost
		const costSection = contentEl.createDiv({ cls: 'budget-cost-section' });
		costSection.createEl('p', {
			text: `This operation will cost approximately $${this.estimatedCost.toFixed(4)}.`
		});

		// Days until reset
		const resetDate = this.getResetDate();
		const daysUntilReset = this.getDaysUntilReset();
		contentEl.createEl('p', {
			text: `Budget resets in ${daysUntilReset} days (${resetDate.toLocaleDateString()})`,
			cls: 'budget-reset-info'
		});

		// Don't ask again checkbox
		const checkboxContainer = contentEl.createDiv({ cls: 'budget-checkbox-container' });
		const checkbox = checkboxContainer.createEl('input', {
			type: 'checkbox',
			cls: 'budget-dismiss-checkbox'
		});
		checkbox.id = 'budget-dismiss';
		checkboxContainer.createEl('label', {
			text: "Don't ask again this session",
			attr: { for: 'budget-dismiss' }
		});

		// Settings link
		const settingsLink = contentEl.createDiv({ cls: 'budget-settings-link' });
		settingsLink.createEl('a', {
			text: 'Adjust budget in settings',
			href: '#'
		}).addEventListener('click', (e) => {
			e.preventDefault();
			// @ts-ignore - settingTab exists on plugin
			this.plugin.settingTab?.display();
			this.close();
		});

		// Actions
		const actionsEl = contentEl.createDiv({ cls: 'budget-actions' });

		const cancelBtn = actionsEl.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.handleCancel();
		});

		const continueBtn = actionsEl.createEl('button', {
			text: 'Continue Anyway',
			cls: 'mod-warning'
		});
		continueBtn.addEventListener('click', () => {
			this.handleContinue(checkbox.checked);
		});
	}

	private handleContinue(dismissSession: boolean): void {
		if (dismissSession) {
			// Set session flag to not show again
			this.plugin.llmService.sessionWarningDismissed = true;
		}
		this.close();
		this.onContinue();
	}

	private handleCancel(): void {
		this.close();
		this.onCancel();
	}

	private getResetDate(): Date {
		const lastReset = this.plugin.settings.llm.usageStats.lastReset;
		const resetDate = new Date(lastReset);
		resetDate.setMonth(resetDate.getMonth() + 1);
		return resetDate;
	}

	private getDaysUntilReset(): number {
		const now = Date.now();
		const resetDate = this.getResetDate();
		const diff = resetDate.getTime() - now;
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	}
}
