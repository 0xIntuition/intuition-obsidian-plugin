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

// LLM Error Messages
export const LLM_ERRORS = {
	NO_API_KEY: 'No API key configured. Please setup LLM provider first.',
	API_KEY_LOCKED: 'API key is locked. Please unlock to use LLM features.',
	INVALID_PROVIDER: 'Invalid LLM provider selected.',
	INVALID_MODEL: 'Invalid model selected for provider.',
	RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please wait before retrying.',
	BUDGET_EXCEEDED: 'Monthly budget limit reached. Increase budget or wait for reset.',
	CONNECTION_FAILED: 'Failed to connect to LLM provider. Please check your API key.',
	SUSPICIOUS_INPUT: 'Suspicious input detected. Please revise your request.',
	ENCRYPTION_FAILED: 'Failed to encrypt API key. Please try again.',
	DECRYPTION_FAILED: 'Failed to decrypt API key. Your password may be incorrect.',
	CUSTOM_ENDPOINT_INVALID: 'Custom endpoint must use HTTPS protocol.',
	CUSTOM_ENDPOINT_INTERNAL: 'Cannot use internal IP addresses for custom endpoint.',
} as const;

// LLM Setting Names
export const LLM_SETTING_NAMES = {
	ENABLED: 'Enable AI Features',
	PROVIDER: 'LLM Provider',
	MODEL: 'Model',
	API_KEY: 'API Key',
	CUSTOM_ENDPOINT: 'Custom Endpoint',
	COST_TRACKING: 'Track Usage & Costs',
	BUDGET: 'Monthly Budget (USD)',
	WARNING_THRESHOLD: 'Budget Warning Threshold',
	REQUIRE_CONFIRMATION: 'Require Confirmation for Requests',
	USAGE_STATS: 'Usage Statistics',
	RESET_STATS: 'Reset Statistics',
	FEATURE_CLAIM_EXTRACTION: 'Claim Extraction',
	FEATURE_ENTITY_DISAMBIGUATION: 'Entity Disambiguation',
	FEATURE_PREDICATE_SUGGESTION: 'Predicate Suggestion',
	FEATURE_BATCH_ANALYSIS: 'Batch Note Analysis',
	FEATURE_KNOWLEDGE_QA: 'Knowledge Q&A',
	FEATURE_CLAIM_IMPROVEMENT: 'Claim Improvement',
	FEATURE_AUTO_TAGGING: 'Auto-Tagging',
	FEATURE_RELATIONSHIP_DISCOVERY: 'Relationship Discovery',
	FEATURE_SUMMARY_GENERATION: 'Summary Generation',
	FEATURE_FACT_CHECKING: 'Fact Checking',
} as const;
