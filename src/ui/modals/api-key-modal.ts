import { App, Modal, Setting } from 'obsidian';
import type IntuitionPlugin from '../../main';

export type ApiKeyAction = 'save' | 'change' | 'remove';

/**
 * ApiKeyModal - Modal for managing LLM API keys
 * Handles save, change, and remove operations with password protection
 */
export class ApiKeyModal extends Modal {
	private plugin: IntuitionPlugin;
	private action: ApiKeyAction;
	private onSuccess?: () => void;
	private apiKey = '';
	private password = '';

	constructor(
		app: App,
		plugin: IntuitionPlugin,
		action: ApiKeyAction,
		onSuccess?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.action = action;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Title
		const title =
			this.action === 'remove'
				? 'Remove API Key'
				: this.action === 'change'
					? 'Change API Key'
					: 'Save API Key';
		contentEl.createEl('h2', { text: title });

		// API key input (only for save/change)
		if (this.action !== 'remove') {
			new Setting(contentEl).setName('API Key').addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('sk-...')
					.onChange((value) => (this.apiKey = value));

				// Auto-focus API key field
				setTimeout(() => text.inputEl.focus(), 50);

				// Allow Enter key to submit
				text.inputEl.addEventListener('keypress', (e) => {
					if (e.key === 'Enter') {
						this.handleSubmit();
					}
				});
			});
		}

		// Password input
		new Setting(contentEl)
			.setName(this.action === 'remove' ? 'Confirm Password' : 'Password')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Enter password')
					.onChange((value) => (this.password = value));

				// Auto-focus password field if no API key field
				if (this.action === 'remove') {
					setTimeout(() => text.inputEl.focus(), 50);
				}

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
			.addButton((button) => {
				const buttonText =
					this.action === 'remove' ? 'Remove' : 'Save';
				const buttonConfig = button
					.setButtonText(buttonText)
					.onClick(() => this.handleSubmit());

				if (this.action === 'remove') {
					buttonConfig.setWarning();
				} else {
					buttonConfig.setCta();
				}
			});
	}

	private async handleSubmit() {
		// Validate password
		if (!this.password || this.password.length < 8) {
			this.plugin.noticeManager.error(
				'Password must be at least 8 characters'
			);
			return;
		}

		// Validate API key for save/change
		if (this.action !== 'remove') {
			if (!this.apiKey || this.apiKey.trim().length === 0) {
				this.plugin.noticeManager.error('API key is required');
				return;
			}
		}

		try {
			if (this.action === 'remove') {
				await this.plugin.llmService.removeApiKey(this.password);
			} else {
				await this.plugin.llmService.saveApiKey(
					this.apiKey,
					this.password
				);
			}

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
		this.apiKey = '';
		this.password = '';
	}
}
