import { App, Modal, Setting } from 'obsidian';
import type IntuitionPlugin from '../../main';
import { WALLET_ERRORS } from '../../types/constants';

/**
 * WalletSetupModal - Create new wallet or import existing
 */
export class WalletSetupModal extends Modal {
	plugin: IntuitionPlugin;
	private password: string = '';
	private confirmPassword: string = '';
	private mode: 'create' | 'import' = 'create';
	private privateKey: string = '';

	constructor(app: App, plugin: IntuitionPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('intuition-wallet-setup');

		contentEl.createEl('h2', { text: 'Wallet Setup' });

		// Mode selection
		new Setting(contentEl).setName('Setup Mode').addDropdown((dropdown) =>
			dropdown
				.addOption('create', 'Create new wallet')
				.addOption('import', 'Import existing wallet')
				.setValue(this.mode)
				.onChange((value: 'create' | 'import') => {
					this.mode = value;
					this.onOpen(); // Refresh UI
				})
		);

		// Private key input (import mode only)
		if (this.mode === 'import') {
			new Setting(contentEl)
				.setName('Private Key')
				.setDesc('Enter your private key (0x...)')
				.addText((text) =>
					text
						.setPlaceholder('0x...')
						.setValue(this.privateKey)
						.onChange((value) => (this.privateKey = value))
				);
		}

		// Password input
		new Setting(contentEl)
			.setName('Password')
			.setDesc('Password to encrypt your wallet')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Enter password')
					.onChange((value) => (this.password = value));
			});

		// Confirm password
		new Setting(contentEl).setName('Confirm Password').addText((text) => {
			text.inputEl.type = 'password';
			text
				.setPlaceholder('Confirm password')
				.onChange((value) => (this.confirmPassword = value));
		});

		// Warning
		const warning = contentEl.createEl('div', {
			cls: 'intuition-warning',
		});
		warning.createEl('p', {
			text: 'Your private key will be encrypted and stored locally. Never share your password or private key.',
		});

		// Actions
		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton((button) =>
				button
					.setButtonText(
						this.mode === 'create'
							? 'Create Wallet'
							: 'Import Wallet'
					)
					.setCta()
					.onClick(() => this.handleSubmit())
			);
	}

	private async handleSubmit() {
		// Validation
		if (this.password !== this.confirmPassword) {
			this.plugin.noticeManager.error(WALLET_ERRORS.PASSWORD_MISMATCH);
			return;
		}

		if (this.password.length < 8) {
			this.plugin.noticeManager.error(
				WALLET_ERRORS.PASSWORD_TOO_SHORT
			);
			return;
		}

		try {
			if (this.mode === 'create') {
				const address =
					await this.plugin.walletService.createWallet(
						this.password
					);
				this.plugin.noticeManager.success(
					`Wallet created: ${address.slice(0, 8)}...`
				);
			} else {
				if (!this.privateKey.startsWith('0x')) {
					this.plugin.noticeManager.error(
						WALLET_ERRORS.INVALID_PRIVATE_KEY
					);
					return;
				}
				const address =
					await this.plugin.walletService.importWallet(
						this.privateKey as `0x${string}`,
						this.password
					);
				this.plugin.noticeManager.success(
					`Wallet imported: ${address.slice(0, 8)}...`
				);
			}
			this.close();
		} catch (error) {
			this.plugin.noticeManager.error(
				`Error: ${error.message || 'Unknown error'}`
			);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Clear sensitive data
		this.password = '';
		this.confirmPassword = '';
		this.privateKey = '';
	}
}
