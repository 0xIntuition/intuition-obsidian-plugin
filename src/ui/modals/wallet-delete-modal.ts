import { App, Modal, Setting } from 'obsidian';
import type IntuitionPlugin from '../../main';

/**
 * WalletDeleteModal - Confirmation modal for wallet deletion
 */
export class WalletDeleteModal extends Modal {
	plugin: IntuitionPlugin;
	private password: string = '';
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
		contentEl.addClass('intuition-wallet-delete');

		contentEl.createEl('h2', { text: 'Delete Wallet' });

		// Warning messages
		const warningSection = contentEl.createEl('div', {
			cls: 'intuition-warning',
		});

		warningSection.createEl('p', {
			text: '⚠️ This will permanently delete your wallet.',
			cls: 'intuition-warning-text',
		});

		warningSection.createEl('p', {
			text: '⚠️ This cannot be undone.',
		});

		warningSection.createEl('p', {
			text: '⚠️ Make sure you have backed up your private key.',
		});

		// Password confirmation
		new Setting(contentEl)
			.setName('Confirm Password')
			.setDesc('Enter your password to confirm deletion')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Enter password')
					.onChange((value) => (this.password = value));

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
					.setButtonText('Delete Wallet')
					.setWarning()
					.onClick(() => this.handleSubmit())
			);
	}

	private async handleSubmit() {
		if (!this.password) {
			this.plugin.noticeManager.error('Please enter password');
			return;
		}

		try {
			await this.plugin.walletService.deleteWallet(this.password);
			this.plugin.noticeManager.success('Wallet deleted');
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
