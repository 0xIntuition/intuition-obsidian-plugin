import { Plugin } from 'obsidian';
import { IntuitionPluginSettings, DEFAULT_SETTINGS } from './types';
import { NoticeManager, IntuitionSettingTab } from './ui';
import { SettingsService } from './services';

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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
