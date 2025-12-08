export enum ErrorCode {
	UNKNOWN = 'UNKNOWN',
	NETWORK = 'NETWORK',
	WALLET = 'WALLET',
	VALIDATION = 'VALIDATION',
	TRANSACTION = 'TRANSACTION',
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
