import { vi } from 'vitest';

// Test constants
export const TEST_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
export const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';
export const TEST_BALANCE = BigInt('1000000000000000000'); // 1 ETH in wei

// Mock private key generation
export const generatePrivateKey = vi.fn(() => TEST_PRIVATE_KEY);

// Mock account from private key
export const privateKeyToAccount = vi.fn((privateKey: string) => ({
	address: TEST_ADDRESS,
	publicKey: '0xabcdef',
	signMessage: vi.fn(),
	signTransaction: vi.fn(),
	signTypedData: vi.fn(),
}));

// Mock HTTP transport
export const http = vi.fn((url?: string) => ({
	type: 'http',
	url: url || 'http://localhost:8545',
}));

// Mock public client
export const createPublicClient = vi.fn((config: any) => ({
	chain: config.chain,
	transport: config.transport,
	getBalance: vi.fn(async () => TEST_BALANCE),
	getBlockNumber: vi.fn(async () => BigInt(12345)),
	getBlock: vi.fn(async () => ({
		number: BigInt(12345),
		timestamp: BigInt(Date.now() / 1000),
		transactions: [],
	})),
	getTransaction: vi.fn(async () => null),
	getTransactionReceipt: vi.fn(async () => null),
	readContract: vi.fn(async () => null),
	multicall: vi.fn(async () => []),
	watchBlockNumber: vi.fn(),
	watchBlocks: vi.fn(),
}));

// Mock wallet client
export const createWalletClient = vi.fn((config: any) => ({
	chain: config.chain,
	transport: config.transport,
	account: config.account,
	sendTransaction: vi.fn(async () => '0xtxhash'),
	writeContract: vi.fn(async () => '0xtxhash'),
	signMessage: vi.fn(async () => '0xsignature'),
	signTypedData: vi.fn(async () => '0xsignature'),
}));

// Mock balance formatting
export const formatEther = vi.fn((value: bigint) => {
	return (Number(value) / 1e18).toFixed(4);
});

export const formatUnits = vi.fn((value: bigint, decimals: number) => {
	return (Number(value) / Math.pow(10, decimals)).toFixed(decimals);
});

// Mock balance parsing
export const parseEther = vi.fn((value: string) => {
	return BigInt(Math.floor(parseFloat(value) * 1e18));
});

export const parseUnits = vi.fn((value: string, decimals: number) => {
	return BigInt(Math.floor(parseFloat(value) * Math.pow(10, decimals)));
});

// Mock chains
export const base = {
	id: 8453,
	name: 'Base',
	network: 'base',
	nativeCurrency: {
		name: 'Ether',
		symbol: 'ETH',
		decimals: 18,
	},
	rpcUrls: {
		default: {
			http: ['https://mainnet.base.org'],
		},
		public: {
			http: ['https://mainnet.base.org'],
		},
	},
	blockExplorers: {
		default: {
			name: 'BaseScan',
			url: 'https://basescan.org',
		},
	},
};

export const baseSepolia = {
	id: 84532,
	name: 'Base Sepolia',
	network: 'base-sepolia',
	nativeCurrency: {
		name: 'Ether',
		symbol: 'ETH',
		decimals: 18,
	},
	rpcUrls: {
		default: {
			http: ['https://sepolia.base.org'],
		},
		public: {
			http: ['https://sepolia.base.org'],
		},
	},
	blockExplorers: {
		default: {
			name: 'BaseScan',
			url: 'https://sepolia.basescan.org',
		},
	},
	testnet: true,
};

// Mock address utilities
export const isAddress = vi.fn((address: string): boolean => {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
});

export const getAddress = vi.fn((address: string): string => {
	if (!isAddress(address)) {
		throw new Error('Invalid address');
	}
	return address.toLowerCase();
});

// Mock contract utilities
export const encodeFunctionData = vi.fn(() => '0x');
export const decodeFunctionResult = vi.fn(() => null);
export const decodeEventLog = vi.fn(() => ({}));

// Mock transaction utilities
export const prepareTransactionRequest = vi.fn(async (client: any, request: any) => request);
export const estimateGas = vi.fn(async () => BigInt(21000));
export const getGasPrice = vi.fn(async () => BigInt(1000000000)); // 1 gwei

// Helper to reset all mocks
export function resetViemMocks() {
	generatePrivateKey.mockReturnValue(TEST_PRIVATE_KEY);
	privateKeyToAccount.mockReturnValue({
		address: TEST_ADDRESS,
		publicKey: '0xabcdef',
		signMessage: vi.fn(),
		signTransaction: vi.fn(),
		signTypedData: vi.fn(),
	});
	formatEther.mockImplementation((value: bigint) => {
		return (Number(value) / 1e18).toFixed(4);
	});
	isAddress.mockImplementation((address: string) => {
		return /^0x[a-fA-F0-9]{40}$/.test(address);
	});
}

// Helper to setup viem mocks with custom balance
export function setupViemMocks(balance: bigint = TEST_BALANCE) {
	const mockPublicClient = {
		chain: base,
		transport: http(),
		getBalance: vi.fn(async () => balance),
		getBlockNumber: vi.fn(async () => BigInt(12345)),
		readContract: vi.fn(async () => null),
	};

	const mockWalletClient = {
		chain: base,
		transport: http(),
		account: privateKeyToAccount(TEST_PRIVATE_KEY),
		sendTransaction: vi.fn(async () => '0xtxhash'),
		writeContract: vi.fn(async () => '0xtxhash'),
		signMessage: vi.fn(async () => '0xsignature'),
	};

	createPublicClient.mockReturnValue(mockPublicClient);
	createWalletClient.mockReturnValue(mockWalletClient);

	return { mockPublicClient, mockWalletClient };
}
