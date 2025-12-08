import { Plugin } from 'obsidian';
import { IntuitionPluginSettings, DEFAULT_SETTINGS } from './types';
import { NoticeManager, IntuitionSettingTab } from './ui';
import { SettingsService } from './services';
import { deepMergeSettings } from './utils';

export default class IntuitionPlugin extends Plugin {
	settings: IntuitionPluginSettings;
	noticeManager: NoticeManager;
	settingsService: SettingsService;

	async onload() {
		await this.loadSettings();
		this.noticeManager = new NoticeManager();

		// Initialize settings service
		this.settingsService = new SettingsService(this);
		await this.settingsService.initialize();

		// Validate and repair settings after service is available
		this.settings = this.settingsService.validateAndRepairSettings(this.settings);
		await this.saveSettings();

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
