export enum ErrorCode {
	UNKNOWN = 'UNKNOWN',
	NETWORK = 'NETWORK',
	WALLET = 'WALLET',
	VALIDATION = 'VALIDATION',
	TRANSACTION = 'TRANSACTION',
	// Wallet-specific errors
	WALLET_LOCKED = 'WALLET_LOCKED',
	WALLET_NO_EXISTS = 'WALLET_NO_EXISTS',
	WALLET_ALREADY_EXISTS = 'WALLET_ALREADY_EXISTS',
	ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
	INVALID_PASSWORD = 'INVALID_PASSWORD',
	INVALID_PRIVATE_KEY = 'INVALID_PRIVATE_KEY',
}

export interface IntuitionError {
	code: ErrorCode;
	message: string;
	details?: unknown;
	recoverable: boolean;
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
