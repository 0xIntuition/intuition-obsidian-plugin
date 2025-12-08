/**
 * Debounce utility for delaying function execution until after a specified wait time.
 * Useful for search inputs and other scenarios where you want to wait for user to stop typing.
 *
 * @param func - The function to debounce
 * @param wait - The delay in milliseconds
 * @returns Debounced function that delays execution
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching for:', query);
 * }, 300);
 *
 * debouncedSearch('test'); // Won't execute immediately
 * debouncedSearch('test2'); // Cancels previous call
 * // After 300ms: logs "Searching for: test2"
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function (this: any, ...args: Parameters<T>) {
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
}
