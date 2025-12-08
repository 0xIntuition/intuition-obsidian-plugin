/**
 * Settings tab UI
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import IntuitionPlugin from '../main';
import { NETWORKS, NetworkType } from '../types/networks';
import { truncateAddress } from '../utils/helpers';

export class IntuitionSettingTab extends PluginSettingTab {
  plugin: IntuitionPlugin;

  constructor(app: App, plugin: IntuitionPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl('h1', { text: 'Intuition Settings' });

    // Network Section
    this.addNetworkSection(containerEl);

    // Wallet Section
    this.addWalletSection(containerEl);

    // Features Section
    this.addFeaturesSection(containerEl);

    // UI Section
    this.addUISection(containerEl);

    // Advanced Section
    this.addAdvancedSection(containerEl);
  }

  private addNetworkSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Network' });

    new Setting(containerEl)
      .setName('Network')
      .setDesc('Select Intuition network')
      .addDropdown(dropdown => dropdown
        .addOption('testnet', 'Testnet (recommended for testing)')
        .addOption('mainnet', 'Mainnet (real transactions)')
        .setValue(this.plugin.settings.network)
        .onChange(async (value: string) => {
          this.plugin.settings.network = value as NetworkType;
          await this.plugin.saveSettings();
          // Refresh display to update network info
          this.display();
        }));

    new Setting(containerEl)
      .setName('Custom RPC URL')
      .setDesc('Override default RPC URL (leave empty for default)')
      .addText(text => text
        .setPlaceholder('https://...')
        .setValue(this.plugin.settings.customRpcUrl || '')
        .onChange(async (value) => {
          const trimmedValue = value.trim();

          // Validate if not empty
          if (trimmedValue !== '') {
            const validation = this.plugin.settingsService.validateRpcUrl(trimmedValue);
            if (!validation.valid) {
              this.plugin.noticeManager.error(validation.errors.join(', '));
              return;
            }
          }

          this.plugin.settings.customRpcUrl = trimmedValue || null;
          await this.plugin.saveSettings();
        }));
  }

  private addWalletSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Wallet' });

    const walletStatus = this.plugin.settings.wallet.hasWallet
      ? `Connected: ${truncateAddress(this.plugin.settings.wallet.address || '', 6)}`
      : 'No wallet configured';

    new Setting(containerEl)
      .setName('Wallet Status')
      .setDesc(walletStatus)
      .addButton(button => button
        .setButtonText(this.plugin.settings.wallet.hasWallet ? 'Manage Wallet' : 'Setup Wallet')
        .onClick(() => {
          // Placeholder for Plan 003: Opens wallet setup modal
          this.plugin.noticeManager.info('Wallet setup will be available in the next update');
        }));
  }

  private addFeaturesSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Features' });

    new Setting(containerEl)
      .setName('Entity Decorations')
      .setDesc('Show trust scores on entities in notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableDecorations)
        .onChange(async (value) => {
          this.plugin.settings.features.enableDecorations = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Hover Cards')
      .setDesc('Show detailed info when hovering on entities')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableHoverCards)
        .onChange(async (value) => {
          this.plugin.settings.features.enableHoverCards = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Claim Indicators')
      .setDesc('Detect and verify claims in your notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableClaimIndicators)
        .onChange(async (value) => {
          this.plugin.settings.features.enableClaimIndicators = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Offline Queue')
      .setDesc('Queue transactions when offline')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableOfflineQueue)
        .onChange(async (value) => {
          this.plugin.settings.features.enableOfflineQueue = value;
          await this.plugin.saveSettings();
        }));
  }

  private addUISection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'User Interface' });

    new Setting(containerEl)
      .setName('Default Stake Amount')
      .setDesc('Default amount in TRUST for new stakes')
      .addText(text => text
        .setValue(this.plugin.settings.ui.defaultStakeAmount)
        .onChange(async (value) => {
          const validation = this.plugin.settingsService.validateStakeAmount(value);
          if (!validation.valid) {
            this.plugin.noticeManager.error(validation.errors.join(', '));
            return;
          }

          this.plugin.settings.ui.defaultStakeAmount = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show Stake Preview')
      .setDesc('Show impact preview before staking')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ui.showStakePreview)
        .onChange(async (value) => {
          this.plugin.settings.ui.showStakePreview = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Annotate on Publish')
      .setDesc('Add claim reference to note after publishing')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ui.annotateOnPublish)
        .onChange(async (value) => {
          this.plugin.settings.ui.annotateOnPublish = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Decoration Position')
      .setDesc('Where to display entity decorations')
      .addDropdown(dropdown => dropdown
        .addOption('inline', 'Inline with text')
        .addOption('gutter', 'In editor gutter')
        .setValue(this.plugin.settings.ui.decorationPosition)
        .onChange(async (value: string) => {
          this.plugin.settings.ui.decorationPosition = value as 'inline' | 'gutter';
          await this.plugin.saveSettings();
        }));
  }

  private addAdvancedSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Advanced' });

    const network = NETWORKS[this.plugin.settings.network];

    new Setting(containerEl)
      .setName('Current Network Info')
      .setDesc(
        `Chain ID: ${network.chainId} | MultiVault: ${network.multiVaultAddress.slice(0, 10)}...`
      );

    new Setting(containerEl)
      .setName('GraphQL Endpoint')
      .setDesc(network.graphqlUrl);

    new Setting(containerEl)
      .setName('RPC Endpoint')
      .setDesc(this.plugin.settingsService.getEffectiveRpcUrl());

    new Setting(containerEl)
      .setName('Clear Cache')
      .setDesc('Clear all cached data')
      .addButton(button => button
        .setButtonText('Clear Cache')
        .setWarning()
        .onClick(async () => {
          // Placeholder for Plan 008: Clear cache implementation
          this.plugin.noticeManager.info('Cache clearing will be available once cache is implemented');
        }));
  }
}
