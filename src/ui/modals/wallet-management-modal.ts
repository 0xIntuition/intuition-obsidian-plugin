import { App, Modal, Setting } from 'obsidian';
import type IntuitionPlugin from '../../main';
import { truncateAddress } from '../../utils/helpers';
import { UnlockWalletModal } from './unlock-wallet-modal';
import { WalletDeleteModal } from './wallet-delete-modal';
import { WalletSetupModal } from './wallet-setup-modal';
import { NETWORKS } from '../../types/networks';

/**
 * WalletManagementModal - Central control panel for wallet operations
 */
export class WalletManagementModal extends Modal {
	plugin: IntuitionPlugin;
	private revealPassword = '';
	private showingPrivateKey = false;

	constructor(app: App, plugin: IntuitionPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		this.display();
	}

	display() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('intuition-wallet-management');

		contentEl.createEl('h2', { text: 'Wallet Management' });

		// Check if wallet exists
		if (!this.plugin.settings.wallet.hasWallet) {
			contentEl.createEl('p', {
				text: 'No wallet found. Create or import a wallet to get started.',
			});

			// Setup Wallet button
			new Setting(contentEl).addButton((button) =>
				button
					.setButtonText('Setup Wallet')
					.setCta()
					.onClick(() => {
						new WalletSetupModal(
							this.app,
							this.plugin
						).open();
						this.close();
					})
			);

			// Close button
			new Setting(contentEl).addButton((button) =>
				button.setButtonText('Close').onClick(() => this.close())
			);

			return;
		}

		const isUnlocked = this.plugin.walletService.isUnlocked();
		const address = this.plugin.walletService.getAddress();

		// Address display
		if (address) {
			const network = NETWORKS[this.plugin.settings.network];
			const explorerUrl = `${network.explorerUrl}/address/${address}`;

			new Setting(contentEl)
				.setName('Address')
				.setDesc(truncateAddress(address, 6))
				.addButton((button) =>
					button
						.setButtonText('View on Explorer')
						.onClick(() => {
							window.open(explorerUrl, '_blank');
						})
				);
		}

		// Lock status
		new Setting(contentEl)
			.setName('Status')
			.setDesc(isUnlocked ? '✅ Unlocked' : '🔒 Locked');

		// Balance
		if (isUnlocked) {
			const balance = this.plugin.walletService.getFormattedBalance();
			new Setting(contentEl)
				.setName('Balance')
				.setDesc(`${balance} TRUST`)
				.addButton((button) =>
					button
						.setButtonText('Refresh')
						.onClick(async () => {
							try {
								await this.plugin.walletService.refreshBalance();
								this.plugin.noticeManager.success(
									'Balance refreshed'
								);
								this.display();
							} catch (error) {
								this.plugin.noticeManager.error(
									`Failed to refresh: ${error.message}`
								);
							}
						})
				);
		}

		// Actions section
		contentEl.createEl('h3', { text: 'Actions' });

		// Unlock/Lock button
		if (!isUnlocked) {
			new Setting(contentEl).addButton((button) =>
				button
					.setButtonText('Unlock Wallet')
					.setCta()
					.onClick(() => {
						new UnlockWalletModal(
							this.app,
							this.plugin,
							() => this.display()
						).open();
					})
			);
		} else {
			new Setting(contentEl).addButton((button) =>
				button.setButtonText('Lock Wallet').onClick(() => {
					this.plugin.walletService.lock();
					this.plugin.noticeManager.info('Wallet locked');
					this.display();
				})
			);
		}

		// Private key reveal (only when unlocked)
		if (isUnlocked) {
			const revealSection = contentEl.createEl('div', {
				cls: 'intuition-reveal-key',
			});

			if (!this.showingPrivateKey) {
				new Setting(revealSection)
					.setName('Reveal Private Key')
					.setDesc(
						'⚠️ Never share your private key with anyone'
					)
					.addButton((button) =>
						button
							.setButtonText('Reveal')
							.setWarning()
							.onClick(() => {
								this.showingPrivateKey = true;
								this.display();
							})
					);
			} else {
				// Show password input and reveal logic
				new Setting(revealSection)
					.setName('Confirm Password')
					.setDesc('Enter password to reveal private key')
					.addText((text) => {
						text.inputEl.type = 'password';
						text
							.setPlaceholder('Enter password')
							.onChange(
								(value) => (this.revealPassword = value)
							);
					})
					.addButton((button) =>
						button
							.setButtonText('Show Key')
							.onClick(async () => {
								await this.handleRevealKey();
							})
					);
			}
		}

		// Delete wallet button
		new Setting(contentEl)
			.setName('Delete Wallet')
			.setDesc('⚠️ This cannot be undone')
			.addButton((button) =>
				button
					.setButtonText('Delete Wallet')
					.setWarning()
					.onClick(() => {
						new WalletDeleteModal(
							this.app,
							this.plugin,
							() => this.close()
						).open();
					})
			);

		// Close button
		new Setting(contentEl).addButton((button) =>
			button.setButtonText('Close').onClick(() => this.close())
		);
	}

	private async handleRevealKey() {
		if (!this.revealPassword) {
			this.plugin.noticeManager.error('Please enter password');
			return;
		}

		try {
			// Verify password by attempting unlock (won't re-unlock if already unlocked)
			await this.plugin.walletService.unlock(this.revealPassword);

			// Get the private key using public API
			const privateKey = this.plugin.walletService.getPrivateKey();

			// Clear password immediately
			this.revealPassword = '';

			// Show private key in modal
			const { contentEl } = this;
			const keyDisplay = contentEl.createEl('div', {
				cls: 'intuition-private-key-display',
			});

			keyDisplay.createEl('h4', {
				text: '⚠️ KEEP THIS SECRET',
			});

			const keyText = keyDisplay.createEl('code', {
				text: privateKey,
				cls: 'intuition-private-key',
			});
			keyText.style.fontFamily = 'monospace';
			keyText.style.fontSize = '12px';
			keyText.style.wordBreak = 'break-all';
			keyText.style.display = 'block';
			keyText.style.padding = '10px';
			keyText.style.background = 'var(--background-secondary)';
			keyText.style.borderRadius = '4px';
			keyText.style.marginTop = '10px';

			new Setting(keyDisplay).addButton((button) =>
				button
					.setButtonText('Copy to Clipboard')
					.onClick(() => {
						navigator.clipboard.writeText(privateKey);
						this.plugin.noticeManager.success(
							'Private key copied to clipboard'
						);
					})
			);
		} catch (error) {
			this.plugin.noticeManager.error(
				`Error: ${error.message || 'Unknown error'}`
			);
			this.revealPassword = '';
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Clear sensitive data
		this.revealPassword = '';
		this.showingPrivateKey = false;
	}
}
