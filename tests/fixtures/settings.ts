import type { IntuitionSettings } from '../../src/types/settings';

// Default test settings
export const DEFAULT_TEST_SETTINGS: IntuitionSettings = {
	network: 'base-sepolia',
	rpcUrl: 'https://sepolia.base.org',
	graphqlApiUrl: 'https://api.intuition.systems/graphql',
	minimumStakeAmount: '0.0001',
	walletEncrypted: null,
	walletAddress: null,
	autoRefreshInterval: 30000,
	cacheSettings: {
		enabled: true,
		ttl: 300000,
		maxSize: 100,
	},
	uiSettings: {
		showStatusBar: true,
		showRibbonIcon: true,
		compactMode: false,
		theme: 'auto',
	},
	advancedSettings: {
		debugMode: false,
		customHeaders: {},
		timeout: 30000,
	},
};

// Test settings with wallet configured
export const TEST_SETTINGS_WITH_WALLET: IntuitionSettings = {
	...DEFAULT_TEST_SETTINGS,
	walletEncrypted: 'mock-encrypted-key:salt:iv',
	walletAddress: '0x1234567890123456789012345678901234567890',
};

// Test settings for mainnet
export const TEST_SETTINGS_MAINNET: IntuitionSettings = {
	...DEFAULT_TEST_SETTINGS,
	network: 'base',
	rpcUrl: 'https://mainnet.base.org',
	graphqlApiUrl: 'https://api.intuition.systems/graphql',
};

// Invalid settings examples for testing validation
export const INVALID_SETTINGS_NO_RPC: Partial<IntuitionSettings> = {
	...DEFAULT_TEST_SETTINGS,
	rpcUrl: '',
};

export const INVALID_SETTINGS_INVALID_NETWORK: Partial<IntuitionSettings> = {
	...DEFAULT_TEST_SETTINGS,
	network: 'invalid-network' as any,
};

export const INVALID_SETTINGS_NEGATIVE_STAKE: Partial<IntuitionSettings> = {
	...DEFAULT_TEST_SETTINGS,
	minimumStakeAmount: '-0.001',
};

export const INVALID_SETTINGS_INVALID_CACHE_TTL: Partial<IntuitionSettings> = {
	...DEFAULT_TEST_SETTINGS,
	cacheSettings: {
		enabled: true,
		ttl: -1000,
		maxSize: 100,
	},
};

// Corrupted settings for repair testing
export const CORRUPTED_SETTINGS_MISSING_FIELDS: Partial<IntuitionSettings> = {
	network: 'base-sepolia',
	// Missing rpcUrl and other required fields
};

export const CORRUPTED_SETTINGS_NULL_VALUES: any = {
	network: null,
	rpcUrl: null,
	graphqlApiUrl: null,
	minimumStakeAmount: null,
	walletEncrypted: null,
	walletAddress: null,
};

// Settings with custom advanced options
export const TEST_SETTINGS_CUSTOM_ADVANCED: IntuitionSettings = {
	...DEFAULT_TEST_SETTINGS,
	advancedSettings: {
		debugMode: true,
		customHeaders: {
			'X-Custom-Header': 'test-value',
			'Authorization': 'Bearer test-token',
		},
		timeout: 60000,
	},
};

// Settings with cache disabled
export const TEST_SETTINGS_NO_CACHE: IntuitionSettings = {
	...DEFAULT_TEST_SETTINGS,
	cacheSettings: {
		enabled: false,
		ttl: 0,
		maxSize: 0,
	},
};

// Settings with compact UI
export const TEST_SETTINGS_COMPACT_UI: IntuitionSettings = {
	...DEFAULT_TEST_SETTINGS,
	uiSettings: {
		showStatusBar: false,
		showRibbonIcon: false,
		compactMode: true,
		theme: 'dark',
	},
};

// Helper function to create test settings
export function createTestSettings(overrides: Partial<IntuitionSettings> = {}): IntuitionSettings {
	return {
		...DEFAULT_TEST_SETTINGS,
		...overrides,
	};
}

// Helper function to create settings with nested overrides
export function createTestSettingsDeep(overrides: Partial<IntuitionSettings> = {}): IntuitionSettings {
	const base = { ...DEFAULT_TEST_SETTINGS };

	if (overrides.cacheSettings) {
		base.cacheSettings = { ...base.cacheSettings, ...overrides.cacheSettings };
	}

	if (overrides.uiSettings) {
		base.uiSettings = { ...base.uiSettings, ...overrides.uiSettings };
	}

	if (overrides.advancedSettings) {
		base.advancedSettings = { ...base.advancedSettings, ...overrides.advancedSettings };
	}

	return { ...base, ...overrides };
}
