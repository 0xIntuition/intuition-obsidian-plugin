import { Plugin } from 'obsidian';
import { IntuitionPluginSettings, DEFAULT_SETTINGS } from './types';
import { NoticeManager } from './ui/notice-manager';

export default class IntuitionPlugin extends Plugin {
	settings: IntuitionPluginSettings;
	noticeManager: NoticeManager;

	async onload() {
		await this.loadSettings();
		this.noticeManager = new NoticeManager();

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

		console.log('Intuition plugin loaded');
	}

	onunload() {
		console.log('Intuition plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
