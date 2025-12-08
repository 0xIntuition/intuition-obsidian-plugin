import { Component } from 'obsidian';
import type IntuitionPlugin from '../../main';
import { truncateAddress } from '../../utils/helpers';
import { WalletManagementModal } from '../modals/wallet-management-modal';

/**
 * WalletStatusBar - Status bar widget showing wallet state
 */
export class WalletStatusBar extends Component {
	private plugin: IntuitionPlugin;
	private statusBarItem: HTMLElement;

	constructor(plugin: IntuitionPlugin, statusBarItem: HTMLElement) {
		super();
		this.plugin = plugin;
		this.statusBarItem = statusBarItem;
	}

	onload() {
		this.refresh();

		// Refresh every 5 seconds
		this.registerInterval(
			window.setInterval(() => this.refresh(), 5000)
		);

		// Click to open management modal
		this.statusBarItem.onclick = () => {
			new WalletManagementModal(
				this.plugin.app,
				this.plugin
			).open();
		};

		// Add cursor pointer to indicate clickable
		this.statusBarItem.style.cursor = 'pointer';
	}

	refresh() {
		const wallet = this.plugin.walletService;

		if (!wallet || !wallet.getState().isInitialized) {
			this.statusBarItem.setText('💼 No wallet');
			return;
		}

		if (!wallet.isUnlocked()) {
			this.statusBarItem.setText('🔒 Wallet locked');
			return;
		}

		const address = wallet.getAddress();
		const balance = wallet.getFormattedBalance();
		const network = this.plugin.settings.network;
		this.statusBarItem.setText(
			`💼 ${truncateAddress(address || '', 4)} | ${balance} TRUST (${network})`
		);
	}
}
