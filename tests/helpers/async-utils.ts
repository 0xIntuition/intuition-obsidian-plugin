import { vi } from 'vitest';

/**
 * Creates a wrapper for using fake timers in tests
 */
export function useFakeTimers() {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	return {
		advance: (ms: number) => vi.advanceTimersByTime(ms),
		advanceToNext: () => vi.advanceTimersToNextTimer(),
		runAll: () => vi.runAllTimers(),
		clear: () => vi.clearAllTimers(),
	};
}

/**
 * Helper to wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to wait for a condition with timeout
 */
export async function waitFor(
	condition: () => boolean | Promise<boolean>,
	options: {
		timeout?: number;
		interval?: number;
		timeoutMessage?: string;
	} = {}
): Promise<void> {
	const {
		timeout = 5000,
		interval = 50,
		timeoutMessage = `Condition not met within ${timeout}ms`,
	} = options;

	const startTime = Date.now();

	while (true) {
		const result = await condition();
		if (result) {
			return;
		}

		if (Date.now() - startTime > timeout) {
			throw new Error(timeoutMessage);
		}

		await wait(interval);
	}
}

/**
 * Helper to retry an async operation
 */
export async function retry<T>(
	fn: () => Promise<T>,
	options: {
		maxAttempts?: number;
		delay?: number;
		backoff?: number;
		onRetry?: (attempt: number, error: Error) => void;
	} = {}
): Promise<T> {
	const {
		maxAttempts = 3,
		delay = 100,
		backoff = 1.5,
		onRetry,
	} = options;

	let lastError: Error;
	let currentDelay = delay;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			if (attempt < maxAttempts) {
				if (onRetry) {
					onRetry(attempt, lastError);
				}
				await wait(currentDelay);
				currentDelay *= backoff;
			}
		}
	}

	throw lastError!;
}

/**
 * Helper to run async operations in sequence
 */
export async function sequence<T>(
	operations: Array<() => Promise<T>>
): Promise<T[]> {
	const results: T[] = [];

	for (const operation of operations) {
		results.push(await operation());
	}

	return results;
}

/**
 * Helper to run async operations in parallel with concurrency limit
 */
export async function parallel<T>(
	operations: Array<() => Promise<T>>,
	concurrency = Infinity
): Promise<T[]> {
	const results: T[] = new Array(operations.length);
	const executing: Promise<void>[] = [];

	for (let i = 0; i < operations.length; i++) {
		const operation = operations[i];

		const promise = (async () => {
			results[i] = await operation();
		})();

		executing.push(promise);

		if (executing.length >= concurrency) {
			await Promise.race(executing);
			executing.splice(
				executing.findIndex(p => p === promise),
				1
			);
		}
	}

	await Promise.all(executing);
	return results;
}

/**
 * Helper to debounce a function in tests
 */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
	let timeoutId: NodeJS.Timeout | null = null;

	return (...args: Parameters<T>): Promise<ReturnType<T>> => {
		return new Promise((resolve) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			timeoutId = setTimeout(() => {
				resolve(fn(...args));
			}, delay);
		});
	};
}

/**
 * Helper to throttle a function in tests
 */
export function throttle<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
	let lastCall = 0;

	return (...args: Parameters<T>): ReturnType<T> | undefined => {
		const now = Date.now();

		if (now - lastCall >= delay) {
			lastCall = now;
			return fn(...args);
		}

		return undefined;
	};
}

/**
 * Helper to create a promise that resolves after a delay
 */
export function delayed<T>(value: T, ms: number): Promise<T> {
	return new Promise(resolve => {
		setTimeout(() => resolve(value), ms);
	});
}

/**
 * Helper to create a promise that rejects after a delay
 */
export function delayedReject(error: Error, ms: number): Promise<never> {
	return new Promise((_, reject) => {
		setTimeout(() => reject(error), ms);
	});
}

/**
 * Helper to add timeout to a promise
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	timeoutMessage = `Operation timed out after ${ms}ms`
): Promise<T> {
	const timeout = delayedReject(new Error(timeoutMessage), ms);
	return Promise.race([promise, timeout]);
}

/**
 * Helper to flush all pending promises
 */
export async function flushPromises(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}

/**
 * Helper to run microtasks (useful for testing Promise.then callbacks)
 */
export async function runMicrotasks(): Promise<void> {
	await Promise.resolve();
}

/**
 * Helper to run both microtasks and macrotasks
 */
export async function runTasks(): Promise<void> {
	await flushPromises();
	await runMicrotasks();
}
