import type { IntuitionPluginSettings } from '../../src/types/settings';

// Default test settings (testnet)
export const DEFAULT_TEST_SETTINGS: IntuitionPluginSettings = {
	version: '1.0.0',
	initialized: true,
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
		showStatusBar: true,
		showRibbonIcon: true,
		theme: 'auto',
		compactMode: false,
		decorationPosition: 'inline',
	},
};

// Test settings with wallet configured
export const TEST_SETTINGS_WITH_WALLET: IntuitionPluginSettings = {
	...DEFAULT_TEST_SETTINGS,
	wallet: {
		hasWallet: true,
		encryptedPrivateKey: 'mock-encrypted-key',
		encryptionSalt: 'mock-salt',
		address: '0x1234567890123456789012345678901234567890',
	},
};

// Test settings for mainnet
export const TEST_SETTINGS_MAINNET: IntuitionPluginSettings = {
	...DEFAULT_TEST_SETTINGS,
	network: 'mainnet',
};

// Invalid settings examples for testing validation
export const INVALID_SETTINGS_INVALID_NETWORK: Partial<IntuitionPluginSettings> = {
	...DEFAULT_TEST_SETTINGS,
	network: 'invalid-network' as any,
};

export const INVALID_SETTINGS_INVALID_CACHE_TTL: Partial<IntuitionPluginSettings> = {
	...DEFAULT_TEST_SETTINGS,
	cache: {
		atomTTL: -1000,
		vaultTTL: -1000,
		searchTTL: -1000,
		maxCacheSize: 100,
	},
};

// Corrupted settings for repair testing
export const CORRUPTED_SETTINGS_MISSING_FIELDS: Partial<IntuitionPluginSettings> = {
	network: 'testnet',
	// Missing other required fields
};

export const CORRUPTED_SETTINGS_NULL_VALUES: any = {
	version: null,
	initialized: null,
	network: null,
	customRpcUrl: null,
	wallet: null,
	features: null,
	cache: null,
	ui: null,
};

// Settings with cache disabled (minimal TTLs)
export const TEST_SETTINGS_NO_CACHE: IntuitionPluginSettings = {
	...DEFAULT_TEST_SETTINGS,
	cache: {
		atomTTL: 0,
		vaultTTL: 0,
		searchTTL: 0,
		maxCacheSize: 0,
	},
};

// Settings with compact UI
export const TEST_SETTINGS_COMPACT_UI: IntuitionPluginSettings = {
	...DEFAULT_TEST_SETTINGS,
	ui: {
		showStatusBar: false,
		showRibbonIcon: false,
		compactMode: true,
		theme: 'dark',
		decorationPosition: 'gutter',
	},
};

// Helper function to create test settings
export function createTestSettings(overrides: Partial<IntuitionPluginSettings> = {}): IntuitionPluginSettings {
	return {
		...DEFAULT_TEST_SETTINGS,
		...overrides,
	};
}

// Helper function to create settings with nested overrides
export function createTestSettingsDeep(overrides: Partial<IntuitionPluginSettings> = {}): IntuitionPluginSettings {
	const base = { ...DEFAULT_TEST_SETTINGS };

	if (overrides.wallet) {
		base.wallet = { ...base.wallet, ...overrides.wallet };
	}

	if (overrides.features) {
		base.features = { ...base.features, ...overrides.features };
	}

	if (overrides.cache) {
		base.cache = { ...base.cache, ...overrides.cache };
	}

	if (overrides.ui) {
		base.ui = { ...base.ui, ...overrides.ui };
	}

	return { ...base, ...overrides };
}
