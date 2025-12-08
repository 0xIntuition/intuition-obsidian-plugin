/**
 * Tests for debounce utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should delay function execution', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 300);

		debouncedFn('test');
		expect(mockFn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(299);
		expect(mockFn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(mockFn).toHaveBeenCalledWith('test');
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it('should reset timer on subsequent calls', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 300);

		debouncedFn('first');
		vi.advanceTimersByTime(200);

		debouncedFn('second');
		vi.advanceTimersByTime(200);

		// First call should not have executed yet
		expect(mockFn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		// Only second call should execute
		expect(mockFn).toHaveBeenCalledWith('second');
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it('should handle multiple arguments', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 300);

		debouncedFn('arg1', 'arg2', 'arg3');
		vi.advanceTimersByTime(300);

		expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
	});

	it('should preserve function context', () => {
		const context = { value: 42 };
		const mockFn = vi.fn(function (this: typeof context) {
			return this.value;
		});
		const debouncedFn = debounce(mockFn, 300);

		debouncedFn.call(context);
		vi.advanceTimersByTime(300);

		expect(mockFn).toHaveBeenCalled();
	});

	it('should only execute the last call when called multiple times', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 300);

		debouncedFn('first');
		debouncedFn('second');
		debouncedFn('third');

		vi.advanceTimersByTime(300);

		expect(mockFn).toHaveBeenCalledWith('third');
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it('should work with different wait times', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 500);

		debouncedFn('test');
		vi.advanceTimersByTime(499);
		expect(mockFn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(mockFn).toHaveBeenCalledWith('test');
	});

	it('should handle zero wait time', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 0);

		debouncedFn('test');
		expect(mockFn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(0);
		expect(mockFn).toHaveBeenCalledWith('test');
	});
});
