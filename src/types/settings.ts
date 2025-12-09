/**
 * Comprehensive plugin settings interfaces
 */

import { NetworkType } from './networks';
import { LLMProvider, LLMUsageStats } from './llm';

/**
 * Wallet settings with encrypted private key storage
 *
 * SECURITY WARNINGS:
 * - Private keys are encrypted but stored on disk in Obsidian's data.json
 * - data.json may sync to cloud services (Dropbox, iCloud, etc.)
 * - Encryption uses browser's SubtleCrypto API with user-provided password
 * - Password is NOT stored - lost password = lost access to wallet
 * - For maximum security, consider hardware wallet or browser extension
 * - This storage method is convenient but has inherent risks
 * - Only store small amounts for testing/low-value transactions
 *
 * PLAN 003 CONSIDERATIONS:
 * - Support for hardware wallets (Ledger, Trezor)
 * - Support for browser extension wallets (MetaMask)
 * - Option to store in system keychain instead
 * - Multi-signature support for high-value operations
 */
export interface WalletSettings {
  hasWallet: boolean;
  encryptedPrivateKey: string | null;  // AES-GCM encrypted, base64 encoded
  encryptionSalt: string | null;        // Random salt for key derivation
  address: string | null;               // Public address (not sensitive)
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

/**
 * LLM (AI) settings
 *
 * SECURITY WARNINGS:
 * - API keys are encrypted but stored on disk in Obsidian's data.json
 * - data.json may sync to cloud services (Dropbox, iCloud, etc.)
 * - Encryption uses browser's SubtleCrypto API with user-provided password
 * - Password is NOT stored - lost password = lost access to API key
 * - Only use for testing/low-value API keys
 * - Auto-locks after 30 minutes of inactivity
 */
export interface LLMSettings {
  enabled: boolean;
  provider: LLMProvider;
  modelId: string;
  encryptedApiKey: string | null;  // JSON.stringify(EncryptedKeyData)
  encryptionSalt: string | null;
  customBaseUrl: string | null;
  costManagement: {
    trackUsage: boolean;              // Default: false (opt-in)
    monthlyBudgetUSD: number | null;  // Default: null (unlimited)
    warningThresholdPercent: number;  // Default: 80
    requireConfirmation: boolean;     // Default: false
  };
  usageStats: LLMUsageStats;
  features: {
    claimExtraction: boolean;         // Default: true
    entityDisambiguation: boolean;    // Default: true (not used in 006-2a)
    predicateSuggestion: boolean;     // Default: true (not used in 006-2a)
    batchAnalysis: boolean;           // Default: true (not used in 006-2a)
    knowledgeQA: boolean;             // Default: true (not used in 006-2a)
    claimImprovement: boolean;        // Default: true (not used in 006-2a)
    autoTagging: boolean;             // Default: true (not used in 006-2a)
    relationshipDiscovery: boolean;   // Default: true (not used in 006-2a)
    summaryGeneration: boolean;       // Default: true (not used in 006-2a)
    factChecking: boolean;            // Default: true (not used in 006-2a)
  };
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

  // LLM (AI) settings
  llm: LLMSettings;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  enabled: false,
  provider: 'anthropic',
  modelId: 'claude-haiku-3-5-20241022',
  encryptedApiKey: null,
  encryptionSalt: null,
  customBaseUrl: null,
  costManagement: {
    trackUsage: false,
    monthlyBudgetUSD: null,
    warningThresholdPercent: 80,
    requireConfirmation: false,
  },
  usageStats: {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    requestsByModel: {},
    lastReset: Date.now(),
  },
  features: {
    claimExtraction: true,
    entityDisambiguation: true,
    predicateSuggestion: true,
    batchAnalysis: true,
    knowledgeQA: true,
    claimImprovement: true,
    autoTagging: true,
    relationshipDiscovery: true,
    summaryGeneration: true,
    factChecking: true,
  },
};

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

  llm: DEFAULT_LLM_SETTINGS,
};
