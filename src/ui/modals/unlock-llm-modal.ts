import { App, Modal, Setting } from 'obsidian';
import type IntuitionPlugin from '../../main';

/**
 * UnlockLLMModal - Simple password entry to unlock LLM service
 */
export class UnlockLLMModal extends Modal {
	plugin: IntuitionPlugin;
	private password = '';
	private onSuccess?: () => void;

	constructor(
		app: App,
		plugin: IntuitionPlugin,
		onSuccess?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Unlock LLM Service' });

		// Password input
		new Setting(contentEl).setName('Password').addText((text) => {
			text.inputEl.type = 'password';
			text
				.setPlaceholder('Enter password')
				.onChange((value) => (this.password = value));

			// Auto-focus password field
			setTimeout(() => text.inputEl.focus(), 50);

			// Allow Enter key to submit
			text.inputEl.addEventListener('keypress', (e) => {
				if (e.key === 'Enter') {
					this.handleSubmit();
				}
			});
		});

		// Actions
		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton((button) =>
				button
					.setButtonText('Unlock')
					.setCta()
					.onClick(() => this.handleSubmit())
			);
	}

	private async handleSubmit() {
		if (!this.password) {
			this.plugin.noticeManager.error('Please enter password');
			return;
		}

		try {
			await this.plugin.llmService.unlock(this.password);
			this.plugin.noticeManager.success('LLM service unlocked');
			this.close();

			// Call success callback if provided
			if (this.onSuccess) {
				this.onSuccess();
			}
		} catch (error) {
			this.plugin.noticeManager.error(
				`Error: ${error.message || 'Unknown error'}`
			);
			// Keep modal open for retry
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Clear sensitive data
		this.password = '';
	}
}
