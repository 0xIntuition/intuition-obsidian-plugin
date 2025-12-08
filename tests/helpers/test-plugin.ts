import { vi } from 'vitest';
import { createTestPlugin } from '../fixtures/plugin';
import type { IntuitionSettings } from '../../src/types/settings';

/**
 * Creates a fully initialized test plugin instance
 * Useful for integration tests that need a complete plugin setup
 */
export async function createIntegrationTestPlugin(settings: Partial<IntuitionSettings> = {}) {
	const { plugin, app, manifest } = createTestPlugin(settings);

	// Initialize plugin (call onload)
	if (plugin.onload) {
		await plugin.onload();
	}

	return { plugin, app, manifest };
}

/**
 * Helper to wait for async operations to complete
 * Uses setImmediate to flush the promise queue
 */
export async function flushPromises(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}

/**
 * Helper to wait for a condition to be true
 * @param condition Function that returns true when condition is met
 * @param timeout Maximum time to wait in ms (default: 5000)
 * @param interval Check interval in ms (default: 50)
 */
export async function waitForCondition(
	condition: () => boolean,
	timeout = 5000,
	interval = 50
): Promise<void> {
	const startTime = Date.now();

	while (!condition()) {
		if (Date.now() - startTime > timeout) {
			throw new Error(`waitForCondition timeout after ${timeout}ms`);
		}
		await new Promise(resolve => setTimeout(resolve, interval));
	}
}

/**
 * Helper to wait for a value to be set
 * @param getValue Function that returns the value to check
 * @param expectedValue The expected value
 * @param timeout Maximum time to wait in ms (default: 5000)
 */
export async function waitForValue<T>(
	getValue: () => T,
	expectedValue: T,
	timeout = 5000
): Promise<void> {
	return waitForCondition(() => getValue() === expectedValue, timeout);
}

/**
 * Helper to mock a service method and track calls
 */
export function mockServiceMethod<T extends object, K extends keyof T>(
	service: T,
	methodName: K,
	implementation?: T[K]
) {
	const original = service[methodName];
	const mock = vi.fn(implementation || (original as any));
	service[methodName] = mock as any;

	return {
		mock,
		restore: () => {
			service[methodName] = original;
		},
	};
}

/**
 * Helper to setup and teardown test state
 */
export function createTestHarness<T>(
	setup: () => T | Promise<T>,
	teardown?: (state: T) => void | Promise<void>
) {
	let state: T;

	return {
		async beforeEach() {
			state = await setup();
			return state;
		},
		async afterEach() {
			if (teardown && state) {
				await teardown(state);
			}
		},
		getState: () => state,
	};
}

/**
 * Helper to verify plugin cleanup
 */
export async function verifyPluginCleanup(plugin: any): Promise<void> {
	// Check that plugin is no longer loaded
	expect(plugin['_loaded']).toBe(false);

	// Verify no lingering timers (if tracked)
	if (plugin['_timers'] && Array.isArray(plugin['_timers'])) {
		expect(plugin['_timers'].length).toBe(0);
	}

	// Verify no lingering event listeners (if tracked)
	if (plugin['_events'] && Array.isArray(plugin['_events'])) {
		expect(plugin['_events'].length).toBe(0);
	}
}

/**
 * Helper to simulate time passing
 */
export function createTimeController() {
	return {
		useFakeTimers: () => vi.useFakeTimers(),
		useRealTimers: () => vi.useRealTimers(),
		advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
		advanceToNextTimer: () => vi.advanceTimersToNextTimer(),
		runAllTimers: () => vi.runAllTimers(),
		clearAllTimers: () => vi.clearAllTimers(),
	};
}

/**
 * Helper to create a deferred promise for testing async flows
 */
export function createDeferred<T>() {
	let resolve: (value: T) => void;
	let reject: (error: Error) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return {
		promise,
		resolve: resolve!,
		reject: reject!,
	};
}
