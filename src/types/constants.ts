/**
 * Application-wide constants
 * Centralizes magic strings/numbers for maintainability and future i18n
 */

// UI Display Constants
export const UI_CONSTANTS = {
	ADDRESS_TRUNCATE_LENGTH: 6,

	NETWORK_NAMES: {
		testnet: 'Testnet (recommended for testing)',
		mainnet: 'Mainnet (real transactions)',
	},

	DECORATION_POSITIONS: {
		inline: 'Inline with text',
		gutter: 'In editor gutter',
	},
} as const;

// Validation Error Messages
export const VALIDATION_ERRORS = {
	RPC_URL_EMPTY: 'RPC URL cannot be empty',
	RPC_URL_INVALID: 'Invalid URL format',
	RPC_URL_PROTOCOL: 'RPC URL must use http or https protocol',

	STAKE_EMPTY: 'Stake amount cannot be empty',
	STAKE_INVALID: 'Stake amount must be a valid number',
	STAKE_POSITIVE: 'Stake amount must be positive',

	TTL_INVALID: 'TTL must be a number',
	TTL_POSITIVE: 'TTL must be positive',

	CACHE_SIZE_POSITIVE: 'Cache size must be positive',
	NETWORK_INVALID: 'Invalid network type',

	SETTINGS_AUTO_REPAIRED: 'Some settings were invalid and have been automatically repaired',
} as const;

// Setting Names & Descriptions
export const SETTING_NAMES = {
	NETWORK: 'Network',
	CUSTOM_RPC: 'Custom RPC URL',
	WALLET_STATUS: 'Wallet Status',

	ENTITY_DECORATIONS: 'Entity Decorations',
	HOVER_CARDS: 'Hover Cards',
	CLAIM_INDICATORS: 'Claim Indicators',
	OFFLINE_QUEUE: 'Offline Queue',

	DEFAULT_STAKE: 'Default Stake Amount',
	STAKE_PREVIEW: 'Show Stake Preview',
	ANNOTATE_ON_PUBLISH: 'Annotate on Publish',
	DECORATION_POSITION: 'Decoration Position',

	NETWORK_INFO: 'Current Network Info',
	CLEAR_CACHE: 'Clear Cache',
} as const;

export const FEATURE_DESCRIPTIONS = {
	DECORATIONS: 'Show trust scores on entities in notes',
	HOVER_CARDS: 'Show detailed info when hovering on entities',
	CLAIM_INDICATORS: 'Detect and verify claims in your notes',
	OFFLINE_QUEUE: 'Queue transactions when offline',
	STAKE_PREVIEW: 'Show impact preview before staking',
	ANNOTATE_ON_PUBLISH: 'Add claim reference to note after publishing',
} as const;

export const PLACEHOLDER_MESSAGES = {
	CACHE_CLEAR: 'Cache clearing will be available once cache is implemented',
} as const;

// Wallet Error Messages
export const WALLET_ERRORS = {
	NO_WALLET: 'No wallet configured. Please setup a wallet first.',
	WALLET_LOCKED: 'Wallet is locked. Please unlock to continue.',
	INVALID_PASSWORD: 'Incorrect password. Please try again.',
	INVALID_PRIVATE_KEY:
		'Invalid private key format. Must be 66 characters starting with 0x.',
	PASSWORD_MISMATCH: 'Passwords do not match.',
	PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
	ENCRYPTION_FAILED: 'Failed to encrypt wallet. Please try again.',
	DECRYPTION_FAILED:
		'Failed to decrypt wallet. Your password may be incorrect.',
	ALREADY_EXISTS: 'Wallet already exists. Delete existing wallet first.',
} as const;
