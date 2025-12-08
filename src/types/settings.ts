/**
 * Comprehensive plugin settings interfaces
 */

import { NetworkType } from './networks';

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
    atomTTL: 3600000,      // 1 hour
    vaultTTL: 300000,      // 5 minutes
    searchTTL: 600000,     // 10 minutes
    maxCacheSize: 50 * 1024 * 1024, // 50MB
  },

  ui: {
    defaultStakeAmount: '0.001',
    showStakePreview: true,
    annotateOnPublish: true,
    decorationPosition: 'inline',
  },
};
