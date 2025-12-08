import { describe, it, expect } from 'vitest';
import { ErrorCode, PluginError, GraphQLQueryError } from './errors';

describe('PluginError', () => {
	it('should create error with message', () => {
		const error = new PluginError('Test error');

		expect(error.message).toBe('Test error');
		expect(error.name).toBe('PluginError');
		expect(error.code).toBe(ErrorCode.UNKNOWN);
		expect(error.recoverable).toBe(false);
		expect(error.details).toBeUndefined();
	});

	it('should create error with custom code', () => {
		const error = new PluginError('Network error', ErrorCode.NETWORK);

		expect(error.message).toBe('Network error');
		expect(error.code).toBe(ErrorCode.NETWORK);
		expect(error.recoverable).toBe(false);
	});

	it('should create error with recoverable flag', () => {
		const error = new PluginError('Recoverable error', ErrorCode.VALIDATION, true);

		expect(error.message).toBe('Recoverable error');
		expect(error.code).toBe(ErrorCode.VALIDATION);
		expect(error.recoverable).toBe(true);
	});

	it('should create error with details', () => {
		const details = { field: 'rpcUrl', value: 'invalid-url' };
		const error = new PluginError('Validation failed', ErrorCode.VALIDATION, true, details);

		expect(error.message).toBe('Validation failed');
		expect(error.code).toBe(ErrorCode.VALIDATION);
		expect(error.recoverable).toBe(true);
		expect(error.details).toEqual(details);
	});

	it('should be instance of Error', () => {
		const error = new PluginError('Test error');

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(PluginError);
	});

	it('should have correct error codes', () => {
		expect(ErrorCode.UNKNOWN).toBe('UNKNOWN');
		expect(ErrorCode.NETWORK).toBe('NETWORK');
		expect(ErrorCode.WALLET).toBe('WALLET');
		expect(ErrorCode.VALIDATION).toBe('VALIDATION');
		expect(ErrorCode.TRANSACTION).toBe('TRANSACTION');
		expect(ErrorCode.GRAPHQL).toBe('GRAPHQL');
		expect(ErrorCode.CACHE).toBe('CACHE');
		expect(ErrorCode.WALLET_LOCKED).toBe('WALLET_LOCKED');
		expect(ErrorCode.WALLET_NO_EXISTS).toBe('WALLET_NO_EXISTS');
		expect(ErrorCode.WALLET_ALREADY_EXISTS).toBe('WALLET_ALREADY_EXISTS');
		expect(ErrorCode.ENCRYPTION_ERROR).toBe('ENCRYPTION_ERROR');
		expect(ErrorCode.INVALID_PASSWORD).toBe('INVALID_PASSWORD');
		expect(ErrorCode.INVALID_PRIVATE_KEY).toBe('INVALID_PRIVATE_KEY');
	});
});

describe('GraphQLQueryError', () => {
	it('should create GraphQL error with correct defaults', () => {
		const error = new GraphQLQueryError('Query failed');

		expect(error.message).toBe('Query failed');
		expect(error.name).toBe('GraphQLQueryError');
		expect(error.code).toBe(ErrorCode.GRAPHQL);
		expect(error.recoverable).toBe(true); // GraphQL errors are recoverable
		expect(error.details).toBeUndefined();
	});

	it('should create GraphQL error with details', () => {
		const details = {
			query: 'getAtom',
			variables: { id: '123' },
		};
		const error = new GraphQLQueryError('Query failed', details);

		expect(error.message).toBe('Query failed');
		expect(error.code).toBe(ErrorCode.GRAPHQL);
		expect(error.recoverable).toBe(true);
		expect(error.details).toEqual(details);
	});

	it('should be instance of PluginError', () => {
		const error = new GraphQLQueryError('Query failed');

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(PluginError);
		expect(error).toBeInstanceOf(GraphQLQueryError);
	});
});
