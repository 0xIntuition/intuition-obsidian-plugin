import { Plugin } from 'obsidian';
import { IntuitionPluginSettings, DEFAULT_SETTINGS } from './types';
import { NoticeManager, IntuitionSettingTab, WalletStatusBar } from './ui';
import { SettingsService, WalletService, IntuitionService } from './services';
import { deepMergeSettings } from './utils';

export default class IntuitionPlugin extends Plugin {
	settings: IntuitionPluginSettings;
	noticeManager: NoticeManager;
	settingsService: SettingsService;
	walletService: WalletService;
	intuitionService: IntuitionService;
	statusBarEl: HTMLElement;
	walletStatusBar: WalletStatusBar;

	async onload() {
		await this.loadSettings();
		this.noticeManager = new NoticeManager();

		// Initialize settings service
		this.settingsService = new SettingsService(this);
		await this.settingsService.initialize();

		// Validate and repair settings after service is available
		this.settings = this.settingsService.validateAndRepairSettings(this.settings);
		await this.saveSettings();

		// Initialize wallet service
		this.walletService = new WalletService(this);
		await this.walletService.initialize();

		// Initialize Intuition service
		this.intuitionService = new IntuitionService(
			this,
			this.walletService
		);
		await this.intuitionService.initialize();

		// Add status bar
		this.statusBarEl = this.addStatusBarItem();
		this.walletStatusBar = new WalletStatusBar(this, this.statusBarEl);
		this.walletStatusBar.load();

		// Register settings tab
		this.addSettingTab(new IntuitionSettingTab(this.app, this));

		// Register ribbon icon
		this.addRibbonIcon('network', 'Intuition', () => {
			this.noticeManager.info('Intuition plugin active');
		});

		// Register commands (placeholder)
		this.addCommand({
			id: 'publish-claim',
			name: 'Publish claim to Intuition',
			callback: () => {
				this.noticeManager.info('Claim publishing coming soon');
			}
		});
	}

	onunload() {
		if (this.walletStatusBar) {
			this.walletStatusBar.unload();
		}
		if (this.intuitionService) {
			this.intuitionService.cleanup();
		}
		if (this.walletService) {
			this.walletService.cleanup();
		}
		if (this.settingsService) {
			this.settingsService.cleanup();
		}
	}

	async loadSettings() {
		const savedData = await this.loadData();
		// Deep merge to preserve nested properties during migration
		this.settings = deepMergeSettings(DEFAULT_SETTINGS, savedData || {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
