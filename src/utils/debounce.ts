/**
 * Debounced function interface with cancel capability
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
	(...args: Parameters<T>): void;
	cancel(): void;
}

/**
 * Debounce utility for delaying function execution until after a specified wait time.
 * Useful for search inputs and other scenarios where you want to wait for user to stop typing.
 *
 * @param func - The function to debounce
 * @param wait - The delay in milliseconds
 * @returns Debounced function that delays execution with a cancel() method
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching for:', query);
 * }, 300);
 *
 * debouncedSearch('test'); // Won't execute immediately
 * debouncedSearch('test2'); // Cancels previous call
 * // After 300ms: logs "Searching for: test2"
 *
 * // Cancel pending execution
 * debouncedSearch.cancel();
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): DebouncedFunction<T> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const debouncedFn = function (this: any, ...args: Parameters<T>) {
		// Clear existing timeout if there is one
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		// Set new timeout
		timeoutId = setTimeout(() => {
			func.apply(this, args);
			timeoutId = null;
		}, wait);
	};

	debouncedFn.cancel = () => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	return debouncedFn as DebouncedFunction<T>;
}
