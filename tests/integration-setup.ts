/**
 * Setup for integration tests that make real network requests
 *
 * Unlike the regular test setup which mocks fetch, this setup
 * provides a real fetch implementation for integration tests.
 */

// Setup TextEncoder/TextDecoder for crypto operations
if (typeof global.TextEncoder === 'undefined') {
	const { TextEncoder, TextDecoder } = require('util');
	global.TextEncoder = TextEncoder;
	global.TextDecoder = TextDecoder;
}

// Setup crypto for Node.js environment
if (typeof global.crypto === 'undefined') {
	const { webcrypto } = require('crypto');
	global.crypto = webcrypto as Crypto;
}

// DO NOT mock fetch for integration tests - use real fetch
// Use node-fetch or undici for Node.js environment
if (typeof global.fetch === 'undefined') {
	// Node 18+ has built-in fetch, but just in case
	const nodeFetch = require('node-fetch');
	global.fetch = nodeFetch as any;
	global.Headers = nodeFetch.Headers as any;
	global.Request = nodeFetch.Request as any;
	global.Response = nodeFetch.Response as any;
}

// Configure console suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
	// Suppress expected errors/warnings in tests
	console.error = ((message, ...args) => {
		// Suppress specific expected errors
		if (
			typeof message === 'string' &&
			(message.includes('Not implemented') ||
				message.includes('TestingContext') ||
				message.includes('Connection check failed'))
		) {
			return;
		}
		originalConsoleError(message, ...args);
	}) as any;

	console.warn = ((message, ...args) => {
		// Suppress specific expected warnings
		if (
			typeof message === 'string' &&
			(message.includes('deprecated') ||
				message.includes('Network availability check failed'))
		) {
			return;
		}
		originalConsoleWarn(message, ...args);
	}) as any;
});

afterAll(() => {
	// Restore console methods
	console.error = originalConsoleError;
	console.warn = originalConsoleWarn;
});

// Global test helpers
export const flushPromises = () =>
	new Promise((resolve) => setImmediate(resolve));

export const waitForAsync = async (fn: () => boolean, timeout = 5000) => {
	const start = Date.now();
	while (!fn()) {
		if (Date.now() - start > timeout) {
			throw new Error(`waitForAsync timeout after ${timeout}ms`);
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
};
