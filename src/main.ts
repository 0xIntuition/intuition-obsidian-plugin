import { Plugin } from 'obsidian';
import { IntuitionPluginSettings, DEFAULT_SETTINGS } from './types';
import { NoticeManager, IntuitionSettingTab, WalletStatusBar, ClaimModal } from './ui';
import { SettingsService, WalletService, IntuitionService, ClaimParserService, LLMService, TransactionService } from './services';
import { deepMergeSettings } from './utils';

export default class IntuitionPlugin extends Plugin {
	settings: IntuitionPluginSettings;
	noticeManager: NoticeManager;
	settingsService: SettingsService;
	walletService: WalletService;
	transactionService: TransactionService;
	intuitionService: IntuitionService;
	claimParserService: ClaimParserService;
	llmService: LLMService;
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

		// Initialize transaction service
		this.transactionService = new TransactionService(this);
		await this.transactionService.initialize();

		// Initialize LLM service
		this.llmService = new LLMService(this);
		await this.llmService.initialize();

		// Initialize Intuition service
		this.intuitionService = new IntuitionService(
			this,
			this.walletService
		);
		await this.intuitionService.initialize();

		// Initialize Claim Parser service
		this.claimParserService = new ClaimParserService(this);
		await this.claimParserService.initialize();

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

		// Register claim structuring command
		this.addCommand({
			id: 'structure-claim',
			name: 'Structure claim for Intuition',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
			editorCallback: (editor, view) => {
				const selection = editor.getSelection();
				if (!selection || selection.trim().length === 0) {
					this.noticeManager.warning('Please select text first');
					return;
				}

				// Validate text is suitable for claim
				const validation = this.claimParserService.validateClaim(selection);
				if (!validation.isValid) {
					this.noticeManager.error(`Invalid claim: ${validation.errors[0]}`);
					return;
				}

				new ClaimModal(
					this.app,
					this,
					selection,
					view.file?.path || 'unknown'
				).open();
			},
		});
	}

	onunload() {
		if (this.walletStatusBar) {
			this.walletStatusBar.unload();
		}
		if (this.claimParserService) {
			this.claimParserService.cleanup();
		}
		if (this.intuitionService) {
			this.intuitionService.cleanup();
		}
		if (this.transactionService) {
			this.transactionService.cleanup();
		}
		if (this.llmService) {
			this.llmService.cleanup();
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
