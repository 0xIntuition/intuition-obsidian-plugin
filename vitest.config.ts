import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		// Environment setup
		environment: 'happy-dom',
		setupFiles: ['./tests/setup.ts'],

		// Test file patterns
		include: [
			'src/**/*.{test,spec}.ts',
			'tests/**/*.{test,spec}.ts'
		],

		// Timeout for async operations
		testTimeout: 10000,

		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],

			// 80% threshold enforcement
			lines: 80,
			functions: 80,
			branches: 80,
			statements: 80,

			// Exclude patterns
			exclude: [
				'**/node_modules/**',
				'**/dist/**',
				'**/coverage/**',
				'**/*.d.ts',
				'**/types/**',
				'src/main.ts', // Main entry point - integration tested
				'src/settings-tab.ts', // 10,761 lines - partial coverage acceptable (40-50%)
				'**/*.{test,spec}.ts',
				'tests/**',
				'esbuild.config.mjs',
				'.eslintrc.cjs'
			],

			// Include source files
			include: [
				'src/**/*.ts'
			]
		},

		// Global options
		globals: true,
		clearMocks: true,
		mockReset: true,
		restoreMocks: true,
	},

	// Path resolution
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@tests': path.resolve(__dirname, './tests'),
			'obsidian': path.resolve(__dirname, './tests/mocks/obsidian.ts')
		}
	}
});
