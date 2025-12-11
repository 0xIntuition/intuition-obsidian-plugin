import { App, Modal } from 'obsidian';
import type IntuitionPlugin from '../../main';

export class BudgetExceededModal extends Modal {
	private plugin: IntuitionPlugin;

	constructor(app: App, plugin: IntuitionPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('budget-exceeded-modal');

		// Header
		contentEl.createEl('h2', { text: '❌ Monthly Budget Exceeded' });

		// Message
		const budget = this.plugin.settings.llm.costManagement.monthlyBudgetUSD || 0;
		const usage = this.plugin.settings.llm.usageStats.totalCostUSD;

		contentEl.createEl('p', {
			text: `You've exceeded your monthly budget of $${budget.toFixed(2)}.`
		});

		contentEl.createEl('p', {
			text: `Current usage: $${usage.toFixed(4)}`,
			cls: 'budget-exceeded-usage'
		});

		// Fallback message
		const fallbackMsg = contentEl.createDiv({ cls: 'budget-fallback-message' });
		fallbackMsg.createEl('p', {
			text: 'AI features are disabled until your budget resets.'
		});
		fallbackMsg.createEl('p', {
			text: 'The plugin will continue working with regex-based extraction.'
		});

		// Reset date
		const resetDate = this.getResetDate();
		contentEl.createEl('p', {
			text: `Budget resets on ${resetDate.toLocaleDateString()}`,
			cls: 'budget-reset-info'
		});

		// Actions
		const actionsEl = contentEl.createDiv({ cls: 'budget-actions' });

		const settingsBtn = actionsEl.createEl('button', {
			text: 'Adjust Budget',
			cls: 'mod-cta'
		});
		settingsBtn.addEventListener('click', () => {
			// @ts-ignore - settingTab exists on plugin
			this.plugin.settingTab?.display();
			this.close();
		});

		const okBtn = actionsEl.createEl('button', { text: 'OK' });
		okBtn.addEventListener('click', () => this.close());
	}

	private getResetDate(): Date {
		const lastReset = this.plugin.settings.llm.usageStats.lastReset;
		const resetDate = new Date(lastReset);
		resetDate.setMonth(resetDate.getMonth() + 1);
		return resetDate;
	}
}
