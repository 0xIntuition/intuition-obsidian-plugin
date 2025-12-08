// Test wallet constants
export const TEST_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
export const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';
export const TEST_PASSWORD = 'test-password-123';
export const WRONG_PASSWORD = 'wrong-password-456';

// Test balance values
export const TEST_BALANCE_WEI = BigInt('1000000000000000000'); // 1 ETH
export const TEST_BALANCE_ETH = '1.0000';
export const ZERO_BALANCE_WEI = BigInt(0);
export const ZERO_BALANCE_ETH = '0.0000';
export const LARGE_BALANCE_WEI = BigInt('1234567890123456789'); // 1.234... ETH
export const LARGE_BALANCE_ETH = '1.2346';

// Mock encrypted key format: salt:iv:encrypted
export const MOCK_ENCRYPTED_KEY = 'bW9ja1NhbHQ=:bW9ja0l2:bW9ja0VuY3J5cHRlZERhdGE=';

// Another test wallet
export const TEST_PRIVATE_KEY_2 = '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
export const TEST_ADDRESS_2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

// Invalid private keys for testing validation
export const INVALID_PRIVATE_KEY_SHORT = '0x1234'; // Too short
export const INVALID_PRIVATE_KEY_NO_PREFIX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // Missing 0x
export const INVALID_PRIVATE_KEY_INVALID_CHARS = '0xZZZZ56789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // Invalid hex

// Invalid addresses for testing validation
export const INVALID_ADDRESS_SHORT = '0x1234'; // Too short
export const INVALID_ADDRESS_NO_PREFIX = '1234567890123456789012345678901234567890'; // Missing 0x
export const INVALID_ADDRESS_INVALID_CHARS = '0xZZZZ567890123456789012345678901234567890'; // Invalid hex

// Wallet state for testing
export interface WalletState {
	isUnlocked: boolean;
	address: string | null;
	balance: bigint | null;
	privateKey?: string;
}

export const LOCKED_WALLET_STATE: WalletState = {
	isUnlocked: false,
	address: TEST_ADDRESS,
	balance: null,
};

export const UNLOCKED_WALLET_STATE: WalletState = {
	isUnlocked: true,
	address: TEST_ADDRESS,
	balance: TEST_BALANCE_WEI,
	privateKey: TEST_PRIVATE_KEY,
};

export const NO_WALLET_STATE: WalletState = {
	isUnlocked: false,
	address: null,
	balance: null,
};

// Helper function to create wallet state
export function createWalletState(overrides: Partial<WalletState> = {}): WalletState {
	return {
		...LOCKED_WALLET_STATE,
		...overrides,
	};
}

// Mock encrypted wallet data
export interface EncryptedWalletData {
	encrypted: string;
	address: string;
}

export const MOCK_ENCRYPTED_WALLET: EncryptedWalletData = {
	encrypted: MOCK_ENCRYPTED_KEY,
	address: TEST_ADDRESS,
};

// Helper to create mock encrypted wallet
export function createMockEncryptedWallet(
	privateKey: string = TEST_PRIVATE_KEY,
	address: string = TEST_ADDRESS
): EncryptedWalletData {
	return {
		encrypted: MOCK_ENCRYPTED_KEY,
		address,
	};
}
