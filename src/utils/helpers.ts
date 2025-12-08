/**
 * Formats a timestamp for display in the UI
 * Will be used in Plan 008 (Offline Queue) and Plan 012 (Portfolio Dashboard)
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Localized date/time string
 */
export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

/**
 * Deep merges settings objects, ensuring nested properties are preserved
 * Used during settings migration to prevent data loss when upgrading
 * @param defaults - Default settings template
 * @param saved - User's saved settings (may be partial/corrupted)
 * @returns Merged settings with all required properties
 */
export function deepMergeSettings<T extends Record<string, any>>(
	defaults: T,
	saved: Partial<T>
): T {
	const result = { ...defaults };

	for (const key in saved) {
		if (saved.hasOwnProperty(key)) {
			const savedValue = saved[key];
			const defaultValue = defaults[key];

			// If both are objects (and not null), merge recursively
			if (
				savedValue !== null &&
				defaultValue !== null &&
				typeof savedValue === 'object' &&
				typeof defaultValue === 'object' &&
				!Array.isArray(savedValue) &&
				!Array.isArray(defaultValue)
			) {
				result[key] = deepMergeSettings(defaultValue, savedValue) as T[Extract<keyof T, string>];
			} else {
				// Primitive or null - use saved value
				result[key] = savedValue as T[Extract<keyof T, string>];
			}
		}
	}

	return result;
}

/**
 * Truncates a wallet address for display purposes
 * Will be used in Plan 003 (Wallet Integration) and other UIs
 * @param address - The full address to truncate
 * @param length - Number of characters to show from start/end (default: 6)
 * @returns Truncated address in format "0x1234...5678" or original if too short
 * @example truncateAddress("0x1234567890abcdef", 4) // "0x12...cdef"
 */
export function truncateAddress(address: string, length = 6): string {
	if (!address || typeof address !== 'string') return '';
	if (address.length <= length * 2) return address;
	return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Creates a deterministic cache key from an object by sorting keys alphabetically.
 * This ensures that objects with the same properties produce identical cache keys
 * regardless of property order.
 *
 * @param prefix - Cache key prefix (e.g., "search:", "atom:")
 * @param obj - Object to serialize (filters, parameters, etc.)
 * @returns Deterministic cache key string
 *
 * @example
 * // Both produce the same key: "search:creatorId:0x123,label:test,type:Thing"
 * createDeterministicCacheKey("search:", { label: "test", type: "Thing", creatorId: "0x123" })
 * createDeterministicCacheKey("search:", { type: "Thing", creatorId: "0x123", label: "test" })
 */
export function createDeterministicCacheKey<T extends Record<string, any>>(
	prefix: string,
	obj: T
): string {
	// Filter out undefined values
	const defined = Object.entries(obj).filter(([_, value]) => value !== undefined);

	// Sort by key name for deterministic ordering
	const sorted = defined.sort(([a], [b]) => a.localeCompare(b));

	// Serialize to key:value pairs
	const serialized = sorted
		.map(([key, value]) => `${key}:${String(value)}`)
		.join(',');

	return `${prefix}${serialized}`;
}

/**
 * Validates that a URL is safe to use in img src attributes.
 * Only allows http:// and https:// schemes to prevent XSS attacks.
 *
 * @param url - URL to validate
 * @returns true if URL is safe, false otherwise
 *
 * @example
 * isValidImageUrl('https://example.com/img.png') // true
 * isValidImageUrl('javascript:alert(1)') // false
 * isValidImageUrl('data:text/html,<script>alert(1)</script>') // false
 */
export function isValidImageUrl(
	url: string | undefined | null
): boolean {
	if (!url || typeof url !== 'string') {
		return false;
	}

	try {
		const parsed = new URL(url);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Safely sets an image element's src attribute with validation and error handling.
 * Validates URL scheme and provides fallback icon on error.
 *
 * @param img - Image element to set src on
 * @param url - URL to set (will be validated)
 * @param fallbackIcon - Optional fallback text to display on error
 *
 * @example
 * const img = document.createElement('img');
 * setImageSrc(img, atom.image, atom.emoji || '?');
 */
export function setImageSrc(
	img: HTMLImageElement,
	url: string | undefined | null,
	fallbackIcon?: string
): void {
	if (!isValidImageUrl(url)) {
		if (fallbackIcon) {
			const span = document.createElement('span');
			span.className = img.className;
			span.textContent = fallbackIcon;
			img.replaceWith(span);
		}
		return;
	}

	img.src = url!;
	img.onerror = () => {
		if (fallbackIcon) {
			const span = document.createElement('span');
			span.className = img.className;
			span.textContent = fallbackIcon;
			img.replaceWith(span);
		} else {
			img.style.display = 'none';
		}
	};
}

/**
 * Validates search query input to prevent injection attacks.
 * Limits length and checks type for security.
 *
 * @param query - User input to validate
 * @param maxLength - Maximum allowed length (default: 200)
 * @returns Sanitized query or null if invalid
 *
 * @example
 * validateSearchQuery('ethereum', 200) // 'ethereum'
 * validateSearchQuery('  bitcoin  ', 200) // 'bitcoin'
 * validateSearchQuery('a'.repeat(300), 200) // null (too long)
 */
export function validateSearchQuery(
	query: string,
	maxLength = 200
): string | null {
	if (typeof query !== 'string') {
		return null;
	}

	const trimmed = query.trim();

	if (trimmed.length === 0 || trimmed.length > maxLength) {
		return null;
	}

	return trimmed;
}
