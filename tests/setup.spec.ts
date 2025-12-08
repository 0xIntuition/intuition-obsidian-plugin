import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
	it('should run tests successfully', () => {
		expect(true).toBe(true);
	});

	it('should have access to crypto', () => {
		expect(global.crypto).toBeDefined();
		expect(global.crypto.getRandomValues).toBeDefined();
	});

	it('should have TextEncoder and TextDecoder', () => {
		expect(TextEncoder).toBeDefined();
		expect(TextDecoder).toBeDefined();
	});

	it('should have fetch mock', () => {
		expect(global.fetch).toBeDefined();
	});
});
