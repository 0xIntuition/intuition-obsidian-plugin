/**
 * Helper to create real plugin instances for integration tests
 *
 * Unlike mock plugins used in unit tests, these are real IntuitionPlugin instances
 * with fully initialized services that can make real API calls.
 */

import IntuitionPlugin from '../../src/main';
import { createMockApp } from '../mocks/obsidian';
import { MOCK_MANIFEST } from '../fixtures/plugin';
import type { IntuitionPluginSettings } from '../../src/types/settings';
import { DEFAULT_TEST_SETTINGS, TEST_SETTINGS_MAINNET } from '../fixtures/settings';

/**
 * Create a real IntuitionPlugin instance for integration testing
 *
 * @param settings - Partial settings to override defaults
 * @returns Initialized plugin instance
 */
export async function createRealPlugin(
	settings: Partial<IntuitionPluginSettings> = {}
): Promise<IntuitionPlugin> {
	const app = createMockApp();
	const manifest = { ...MOCK_MANIFEST };

	// Create real plugin instance
	const plugin = new IntuitionPlugin(app as any, manifest);

	// Mock loadData to return test settings
	plugin.loadData = async () => ({
		...DEFAULT_TEST_SETTINGS,
		...settings,
	});

	// Mock saveData
	plugin.saveData = async (data: any) => {
		(plugin as any)._lastSavedData = data;
	};

	// Initialize plugin (calls onload which initializes all services)
	await plugin.onload();

	return plugin;
}

/**
 * Create a testnet plugin instance
 */
export async function createTestnetPlugin(): Promise<IntuitionPlugin> {
	return createRealPlugin(); // Default is testnet
}

/**
 * Create a mainnet plugin instance
 */
export async function createMainnetPlugin(): Promise<IntuitionPlugin> {
	return createRealPlugin(TEST_SETTINGS_MAINNET);
}

/**
 * Cleanup plugin instance
 */
export async function cleanupPlugin(plugin: IntuitionPlugin): Promise<void> {
	await plugin.onunload();
}
