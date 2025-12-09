export enum ErrorCode {
	UNKNOWN = 'UNKNOWN',
	NETWORK = 'NETWORK',
	WALLET = 'WALLET',
	VALIDATION = 'VALIDATION',
	TRANSACTION = 'TRANSACTION',
	GRAPHQL = 'GRAPHQL',
	CACHE = 'CACHE',
	// Wallet-specific errors
	WALLET_LOCKED = 'WALLET_LOCKED',
	WALLET_NO_EXISTS = 'WALLET_NO_EXISTS',
	WALLET_ALREADY_EXISTS = 'WALLET_ALREADY_EXISTS',
	ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
	INVALID_PASSWORD = 'INVALID_PASSWORD',
	INVALID_PRIVATE_KEY = 'INVALID_PRIVATE_KEY',
	// LLM-specific errors
	LLM = 'LLM',
	LLM_API_KEY_LOCKED = 'LLM_API_KEY_LOCKED',
	LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
	LLM_BUDGET_EXCEEDED = 'LLM_BUDGET_EXCEEDED',
	LLM_PROVIDER_ERROR = 'LLM_PROVIDER_ERROR',
}

export interface IntuitionError {
	code: ErrorCode;
	message: string;
	details?: unknown;
	recoverable: boolean;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export class PluginError extends Error implements IntuitionError {
	code: ErrorCode;
	details?: unknown;
	recoverable: boolean;

	constructor(
		message: string,
		code: ErrorCode = ErrorCode.UNKNOWN,
		recoverable = false,
		details?: unknown
	) {
		super(message);
		this.name = 'PluginError';
		this.code = code;
		this.recoverable = recoverable;
		this.details = details;
	}
}

/**
 * GraphQL-specific error class
 */
export class GraphQLQueryError extends PluginError {
	constructor(message: string, details?: unknown) {
		super(message, ErrorCode.GRAPHQL, true, details);
		this.name = 'GraphQLQueryError';
	}
}
