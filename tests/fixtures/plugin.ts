import { createMockApp, createMockPlugin } from '../mocks/obsidian';
import { DEFAULT_TEST_SETTINGS } from './settings';
import type { IntuitionPluginSettings } from '../../src/types/settings';

// Mock manifest for plugin testing
export const MOCK_MANIFEST = {
	id: 'intuition-obsidian-plugin',
	name: 'Intuition Plugin',
	version: '1.0.0',
	minAppVersion: '0.15.0',
	description: 'Integrate Intuition knowledge graph with Obsidian',
	author: '0xIntuition',
	authorUrl: 'https://intuition.systems',
	isDesktopOnly: false,
};

// Create a mock plugin instance with default settings
export function createTestPlugin(settings: Partial<IntuitionPluginSettings> = {}) {
	const app = createMockApp();
	const manifest = { ...MOCK_MANIFEST };
	const plugin = createMockPlugin(app, manifest);

	// Mock loadData to return test settings
	plugin.loadData = async () => ({
		...DEFAULT_TEST_SETTINGS,
		...settings,
	});

	// Mock saveData
	plugin.saveData = async (data: any) => {
		// Store for verification in tests
		(plugin as any)._lastSavedData = data;
	};

	return { plugin, app, manifest };
}

// Create a mock plugin with specific state
export interface MockPluginState {
	isLoaded: boolean;
	settings: IntuitionPluginSettings;
	hasWallet: boolean;
	isWalletUnlocked: boolean;
}

export function createTestPluginWithState(state: Partial<MockPluginState> = {}) {
	const finalState: MockPluginState = {
		isLoaded: false,
		settings: DEFAULT_TEST_SETTINGS,
		hasWallet: false,
		isWalletUnlocked: false,
		...state,
	};

	const { plugin, app, manifest } = createTestPlugin(finalState.settings);

	// Set loaded state
	if (finalState.isLoaded) {
		plugin['_loaded'] = true;
	}

	return { plugin, app, manifest, state: finalState };
}
