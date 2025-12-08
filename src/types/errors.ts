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
