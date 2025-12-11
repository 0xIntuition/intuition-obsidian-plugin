import { defineConfig } from 'vitest/config';
import * as path from 'path';
import { config as loadDotenv } from 'dotenv';

// Load .env file for integration tests
loadDotenv();

/**
 * Vitest configuration for integration tests
 *
 * These tests make real API calls to testnet and mainnet GraphQL endpoints.
 * They are slower and require network access, so they're separated from unit tests.
 *
 * Run with: npm run test:integration
 */
export default defineConfig({
	test: {
		// Environment setup
		environment: 'happy-dom',
		setupFiles: ['./tests/integration-setup.ts'], // Use integration-specific setup

		// Test file patterns - only integration tests
		include: ['tests/integration/**/*.spec.ts'],

		// Exclude unit tests
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'src/**/*.spec.ts', // Unit tests
			'tests/fixtures/**',
			'tests/mocks/**',
			'tests/helpers/**',
		],

		// Longer timeouts for real network calls
		testTimeout: 30000, // 30 seconds
		hookTimeout: 30000, // 30 seconds for beforeAll/afterAll

		// Global options
		globals: true,
		clearMocks: true,
		mockReset: true,
		restoreMocks: true,

		// No coverage for integration tests
		// (These test external APIs, not our code coverage)
		coverage: {
			enabled: false,
		},

		// Retry failed tests once (network flakiness)
		retry: 1,

		// Run tests sequentially to avoid rate limiting
		// (Can be changed to true if API allows concurrent requests)
		sequence: {
			concurrent: false,
			shuffle: false,
		},
	},

	// Path resolution (same as main config)
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@tests': path.resolve(__dirname, './tests'),
			obsidian: path.resolve(__dirname, './tests/mocks/obsidian.ts'),
		},
	},
});
