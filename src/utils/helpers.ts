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
