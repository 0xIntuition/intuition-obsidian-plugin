export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

export function truncateAddress(address: string, length = 6): string {
	if (address.length <= length * 2) return address;
	return `${address.slice(0, length)}...${address.slice(-length)}`;
}
