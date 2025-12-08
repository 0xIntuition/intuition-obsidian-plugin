# Plan 002: Settings & Configuration System

## Objective
Implement a comprehensive settings system supporting network selection (Testnet/Mainnet), API endpoints, and feature toggles.

## Prerequisites
- Plan 001 (Project Foundation)

## Deliverables
1. Settings interface with all configuration options
2. Settings tab UI with organized sections
3. Network configuration (chain IDs, RPC URLs, contract addresses)
4. Feature toggles for optional functionality
5. Settings validation and migration system

## Files to Create

```
src/
  types/
    settings.ts              # Settings interfaces
    networks.ts              # Network configuration types
  services/
    settings-service.ts      # Settings management
  ui/
    settings-tab.ts          # Settings tab UI
```

## Data Models

```typescript
// src/types/networks.ts
export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  graphqlUrl: string;
  multiVaultAddress: `0x${string}`;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    chainId: 13579,
    name: 'Intuition Testnet',
    rpcUrl: 'https://testnet.rpc.intuition.systems',
    explorerUrl: 'https://testnet.explorer.intuition.systems',
    graphqlUrl: 'https://testnet.intuition.sh/v1/graphql',
    multiVaultAddress: '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91',
  },
  mainnet: {
    chainId: 1155,
    name: 'Intuition Mainnet',
    rpcUrl: 'https://rpc.intuition.systems',
    explorerUrl: 'https://explorer.intuition.systems',
    graphqlUrl: 'https://mainnet.intuition.sh/v1/graphql',
    multiVaultAddress: '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e',
  },
};

// src/types/settings.ts
export interface WalletSettings {
  hasWallet: boolean;
  encryptedPrivateKey: string | null;
  encryptionSalt: string | null;
  address: string | null;
}

export interface FeatureFlags {
  enableDecorations: boolean;
  enableHoverCards: boolean;
  enableClaimIndicators: boolean;
  enableOfflineQueue: boolean;
}

export interface CacheSettings {
  atomTTL: number;      // ms, default 3600000 (1 hour)
  vaultTTL: number;     // ms, default 300000 (5 min)
  searchTTL: number;    // ms, default 600000 (10 min)
  maxCacheSize: number; // bytes, default 50MB
}

export interface UISettings {
  defaultStakeAmount: string;
  showStakePreview: boolean;
  annotateOnPublish: boolean;
  decorationPosition: 'inline' | 'gutter';
}

export interface IntuitionPluginSettings {
  version: string;
  initialized: boolean;

  // Network
  network: NetworkType;
  customRpcUrl: string | null;

  // Wallet (encrypted data)
  wallet: WalletSettings;

  // Features
  features: FeatureFlags;

  // Cache
  cache: CacheSettings;

  // UI preferences
  ui: UISettings;
}

export const DEFAULT_SETTINGS: IntuitionPluginSettings = {
  version: '1.0.0',
  initialized: false,

  network: 'testnet',
  customRpcUrl: null,

  wallet: {
    hasWallet: false,
    encryptedPrivateKey: null,
    encryptionSalt: null,
    address: null,
  },

  features: {
    enableDecorations: true,
    enableHoverCards: true,
    enableClaimIndicators: false,
    enableOfflineQueue: true,
  },

  cache: {
    atomTTL: 3600000,
    vaultTTL: 300000,
    searchTTL: 600000,
    maxCacheSize: 50 * 1024 * 1024,
  },

  ui: {
    defaultStakeAmount: '0.001',
    showStakePreview: true,
    annotateOnPublish: true,
    decorationPosition: 'inline',
  },
};
```

## Implementation

### Settings Tab UI (src/ui/settings-tab.ts)

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import IntuitionPlugin from '../main';
import { NETWORKS, NetworkType } from '../types/networks';

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
        .onChange(async (value: NetworkType) => {
          this.plugin.settings.network = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Custom RPC URL')
      .setDesc('Override default RPC URL (leave empty for default)')
      .addText(text => text
        .setPlaceholder('https://...')
        .setValue(this.plugin.settings.customRpcUrl || '')
        .onChange(async (value) => {
          this.plugin.settings.customRpcUrl = value || null;
          await this.plugin.saveSettings();
        }));
  }

  private addWalletSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Wallet' });

    const walletStatus = this.plugin.settings.wallet.hasWallet
      ? `Connected: ${this.plugin.settings.wallet.address?.slice(0, 6)}...${this.plugin.settings.wallet.address?.slice(-4)}`
      : 'No wallet configured';

    new Setting(containerEl)
      .setName('Wallet Status')
      .setDesc(walletStatus)
      .addButton(button => button
        .setButtonText(this.plugin.settings.wallet.hasWallet ? 'Manage Wallet' : 'Setup Wallet')
        .onClick(() => {
          // Opens wallet setup modal (Plan 003)
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
  }

  private addAdvancedSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Advanced' });

    const network = NETWORKS[this.plugin.settings.network];

    new Setting(containerEl)
      .setName('Current Network Info')
      .setDesc(`Chain ID: ${network.chainId} | MultiVault: ${network.multiVaultAddress.slice(0, 10)}...`);

    new Setting(containerEl)
      .setName('Clear Cache')
      .setDesc('Clear all cached data')
      .addButton(button => button
        .setButtonText('Clear Cache')
        .setWarning()
        .onClick(async () => {
          // Clear cache implementation
        }));
  }
}
```

## Acceptance Criteria
- [ ] Settings tab displays all configuration sections
- [ ] Network dropdown shows Testnet/Mainnet options
- [ ] Network change updates displayed info
- [ ] Custom RPC URL field saves correctly
- [ ] Feature toggles persist between sessions
- [ ] UI settings save and load correctly
- [ ] Settings validation prevents invalid values
- [ ] Clear cache button works

## Testing
1. Open Obsidian settings
2. Navigate to Intuition plugin settings
3. Change network to Mainnet, verify info updates
4. Toggle each feature flag, reload plugin, verify persistence
5. Change default stake amount, verify it persists
6. Enter invalid RPC URL, verify validation

## Estimated Effort
Low - Standard Obsidian settings pattern
