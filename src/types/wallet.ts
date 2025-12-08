import type { Address, Hex, PublicClient, WalletClient } from 'viem';

/**
 * Current state of the wallet
 */
export interface WalletState {
	isInitialized: boolean;
	isUnlocked: boolean;
	address: Address | null;
	balance: bigint | null;
	lastBalanceCheck: number | null;
}

/**
 * Unlocked wallet with viem clients
 */
export interface UnlockedWallet {
	address: Address;
	privateKey: Hex;
	publicClient: PublicClient;
	walletClient: WalletClient;
}

/**
 * Encrypted private key data structure
 */
export interface EncryptedKeyData {
	encryptedKey: string; // Base64 encoded
	iv: string; // Base64 encoded
	salt: string; // Base64 encoded
	algorithm: 'AES-GCM';
	keyDerivation: 'PBKDF2';
	iterations: number;
}

/**
 * Wallet lifecycle events
 */
export type WalletEvent =
	| { type: 'initialized'; address: Address }
	| { type: 'unlocked'; address: Address }
	| { type: 'locked' }
	| { type: 'balanceUpdated'; balance: bigint }
	| { type: 'error'; error: Error };
