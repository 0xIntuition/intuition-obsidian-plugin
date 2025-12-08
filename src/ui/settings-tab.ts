/**
 * Settings tab UI
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import IntuitionPlugin from '../main';
import { NETWORKS, NetworkType } from '../types/networks';
import { truncateAddress } from '../utils/helpers';
import {
	UI_CONSTANTS,
	SETTING_NAMES,
	FEATURE_DESCRIPTIONS,
	PLACEHOLDER_MESSAGES,
} from '../types/constants';
import { WalletSetupModal } from './modals/wallet-setup-modal';
import { WalletManagementModal } from './modals/wallet-management-modal';

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
      .setName(SETTING_NAMES.NETWORK)
      .setDesc('Select Intuition network')
      .addDropdown(dropdown => dropdown
        .addOption('testnet', UI_CONSTANTS.NETWORK_NAMES.testnet)
        .addOption('mainnet', UI_CONSTANTS.NETWORK_NAMES.mainnet)
        .setValue(this.plugin.settings.network)
        .onChange(async (value: string) => {
          const oldNetwork = this.plugin.settings.network;
          this.plugin.settings.network = value as NetworkType;

          // Lock wallet if network changed and unlocked
          if (
            oldNetwork !== value &&
            this.plugin.walletService?.isUnlocked()
          ) {
            this.plugin.walletService.lock();
            this.plugin.noticeManager.warning(
              'Wallet locked due to network change. Please unlock to use new network.'
            );
          }

          await this.plugin.saveSettings();
          // Refresh display to update network info
          this.display();
        }));

    // Store previous valid value for reversion
    let previousValidRpcUrl = this.plugin.settings.customRpcUrl || '';

    new Setting(containerEl)
      .setName(SETTING_NAMES.CUSTOM_RPC)
      .setDesc('Override default RPC URL (leave empty for default)')
      .addText(text => {
        text
          .setPlaceholder('https://...')
          .setValue(this.plugin.settings.customRpcUrl || '');

        // Validate on blur instead of every keystroke
        text.inputEl.addEventListener('blur', async () => {
          const value = text.getValue().trim();

          // Empty is valid (use default)
          if (value === '') {
            this.plugin.settings.customRpcUrl = null;
            await this.plugin.saveSettings();
            previousValidRpcUrl = '';
            return;
          }

          // Validate non-empty values
          const validation = this.plugin.settingsService.validateRpcUrl(value);
          if (!validation.valid) {
            this.plugin.noticeManager.error(validation.errors.join(', '));
            // Revert to previous valid value
            text.setValue(previousValidRpcUrl);
            this.plugin.settings.customRpcUrl = previousValidRpcUrl || null;
            return;
          }

          // Valid - save and update previous value
          this.plugin.settings.customRpcUrl = value;
          await this.plugin.saveSettings();
          previousValidRpcUrl = value;
        });
      });
  }

  private addWalletSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Wallet' });

    const hasWallet = this.plugin.settings.wallet.hasWallet;
    const isUnlocked = this.plugin.walletService?.isUnlocked();
    const address = this.plugin.settings.wallet.address;

    // Wallet status
    const statusDesc = hasWallet
      ? `Address: ${truncateAddress(address || '', 6)}`
      : 'No wallet configured';

    new Setting(containerEl)
      .setName(SETTING_NAMES.WALLET_STATUS)
      .setDesc(statusDesc)
      .addButton((button) =>
        button
          .setButtonText(hasWallet ? 'Manage Wallet' : 'Setup Wallet')
          .onClick(() => {
            if (hasWallet) {
              new WalletManagementModal(this.app, this.plugin).open();
            } else {
              new WalletSetupModal(this.app, this.plugin).open();
            }
          })
      );

    // Balance display (if wallet exists)
    if (hasWallet) {
      const balance = isUnlocked
        ? this.plugin.walletService.getFormattedBalance() + ' TRUST'
        : 'Locked';

      new Setting(containerEl)
        .setName('Balance')
        .setDesc(balance)
        .addButton((button) =>
          button
            .setButtonText('Refresh')
            .setDisabled(!isUnlocked)
            .onClick(async () => {
              try {
                await this.plugin.walletService.refreshBalance();
                this.plugin.noticeManager.success('Balance refreshed');
                this.display();
              } catch (error) {
                this.plugin.noticeManager.error(
                  `Failed to refresh: ${error.message}`
                );
              }
            })
        );
    }
  }

  private addFeaturesSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Features' });

    new Setting(containerEl)
      .setName(SETTING_NAMES.ENTITY_DECORATIONS)
      .setDesc(FEATURE_DESCRIPTIONS.DECORATIONS)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableDecorations)
        .onChange(async (value) => {
          this.plugin.settings.features.enableDecorations = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(SETTING_NAMES.HOVER_CARDS)
      .setDesc(FEATURE_DESCRIPTIONS.HOVER_CARDS)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableHoverCards)
        .onChange(async (value) => {
          this.plugin.settings.features.enableHoverCards = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(SETTING_NAMES.CLAIM_INDICATORS)
      .setDesc(FEATURE_DESCRIPTIONS.CLAIM_INDICATORS)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableClaimIndicators)
        .onChange(async (value) => {
          this.plugin.settings.features.enableClaimIndicators = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(SETTING_NAMES.OFFLINE_QUEUE)
      .setDesc(FEATURE_DESCRIPTIONS.OFFLINE_QUEUE)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.features.enableOfflineQueue)
        .onChange(async (value) => {
          this.plugin.settings.features.enableOfflineQueue = value;
          await this.plugin.saveSettings();
        }));
  }

  private addUISection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'User Interface' });

    // Store previous valid value for reversion
    let previousValidStakeAmount = this.plugin.settings.ui.defaultStakeAmount;

    new Setting(containerEl)
      .setName(SETTING_NAMES.DEFAULT_STAKE)
      .setDesc('Default amount in TRUST for new stakes')
      .addText(text => {
        text.setValue(this.plugin.settings.ui.defaultStakeAmount);

        // Validate on blur instead of every keystroke
        text.inputEl.addEventListener('blur', async () => {
          const value = text.getValue();
          const validation = this.plugin.settingsService.validateStakeAmount(value);

          if (!validation.valid) {
            this.plugin.noticeManager.error(validation.errors.join(', '));
            // Revert to previous valid value
            text.setValue(previousValidStakeAmount);
            this.plugin.settings.ui.defaultStakeAmount = previousValidStakeAmount;
            return;
          }

          // Valid - save and update previous value
          this.plugin.settings.ui.defaultStakeAmount = value;
          await this.plugin.saveSettings();
          previousValidStakeAmount = value;
        });
      });

    new Setting(containerEl)
      .setName(SETTING_NAMES.STAKE_PREVIEW)
      .setDesc(FEATURE_DESCRIPTIONS.STAKE_PREVIEW)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ui.showStakePreview)
        .onChange(async (value) => {
          this.plugin.settings.ui.showStakePreview = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(SETTING_NAMES.ANNOTATE_ON_PUBLISH)
      .setDesc(FEATURE_DESCRIPTIONS.ANNOTATE_ON_PUBLISH)
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ui.annotateOnPublish)
        .onChange(async (value) => {
          this.plugin.settings.ui.annotateOnPublish = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(SETTING_NAMES.DECORATION_POSITION)
      .setDesc('Where to display entity decorations')
      .addDropdown(dropdown => dropdown
        .addOption('inline', UI_CONSTANTS.DECORATION_POSITIONS.inline)
        .addOption('gutter', UI_CONSTANTS.DECORATION_POSITIONS.gutter)
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
      .setName(SETTING_NAMES.NETWORK_INFO)
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
      .setName(SETTING_NAMES.CLEAR_CACHE)
      .setDesc('Clear all cached data')
      .addButton(button => button
        .setButtonText('Clear Cache')
        .setWarning()
        .onClick(async () => {
          // Placeholder for Plan 008: Clear cache implementation
          this.plugin.noticeManager.info(PLACEHOLDER_MESSAGES.CACHE_CLEAR);
        }));
  }
}
