import { vi } from 'vitest';

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

// Mock fetch globally
global.fetch = vi.fn();

// Configure console suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
	// Suppress expected errors/warnings in tests
	console.error = vi.fn((message, ...args) => {
		// Only suppress specific expected errors
		if (
			typeof message === 'string' &&
			(message.includes('Not implemented') ||
			 message.includes('TestingContext'))
		) {
			return;
		}
		originalConsoleError(message, ...args);
	});

	console.warn = vi.fn((message, ...args) => {
		// Only suppress specific expected warnings
		if (
			typeof message === 'string' &&
			message.includes('deprecated')
		) {
			return;
		}
		originalConsoleWarn(message, ...args);
	});
});

afterAll(() => {
	// Restore console methods
	console.error = originalConsoleError;
	console.warn = originalConsoleWarn;
});

// Global test helpers
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

export const waitForAsync = async (fn: () => boolean, timeout = 5000) => {
	const start = Date.now();
	while (!fn()) {
		if (Date.now() - start > timeout) {
			throw new Error(`waitForAsync timeout after ${timeout}ms`);
		}
		await new Promise(resolve => setTimeout(resolve, 50));
	}
};
