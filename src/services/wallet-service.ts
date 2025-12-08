import {
	createPublicClient,
	createWalletClient,
	http,
	formatEther,
	type Address,
	type Hex,
	type PublicClient,
	type WalletClient,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { CryptoService } from './crypto-service';
import { BaseService } from './base-service';
import { WalletState, UnlockedWallet, EncryptedKeyData } from '../types/wallet';
import { NETWORKS } from '../types/networks';
import { PluginError, ErrorCode } from '../types/errors';
import { WALLET_ERRORS } from '../types/constants';
import type IntuitionPlugin from '../main';

/**
 * WalletService - Manages embedded wallet functionality
 * Handles key generation, encryption, storage, and blockchain operations
 */
export class WalletService extends BaseService {
	private cryptoService: CryptoService;
	private state: WalletState;
	private unlockedWallet: UnlockedWallet | null = null;
	private balanceRefreshPromise: Promise<bigint> | null = null;

	constructor(plugin: IntuitionPlugin) {
		super(plugin);
		this.cryptoService = new CryptoService();
		this.state = {
			isInitialized: false,
			isUnlocked: false,
			address: null,
			balance: null,
			lastBalanceCheck: null,
		};
	}

	/**
	 * Initialize wallet service - restore state from settings
	 */
	async initialize(): Promise<void> {
		this.state = {
			isInitialized: this.plugin.settings.wallet.hasWallet,
			isUnlocked: false,
			address: this.plugin.settings.wallet.address as Address | null,
			balance: null,
			lastBalanceCheck: null,
		};
	}

	/**
	 * Cleanup - lock wallet and clear sensitive data
	 */
	cleanup(): void {
		this.lock();
	}

	/**
	 * Get current wallet state
	 */
	getState(): WalletState {
		return { ...this.state };
	}

	/**
	 * Check if wallet is unlocked
	 */
	isUnlocked(): boolean {
		return this.state.isUnlocked && this.unlockedWallet !== null;
	}

	/**
	 * Get wallet address
	 */
	getAddress(): Address | null {
		return this.state.address;
	}

	/**
	 * Create new wallet with generated private key
	 */
	async createWallet(password: string): Promise<Address> {
		if (this.plugin.settings.wallet.hasWallet) {
			throw new PluginError(
				WALLET_ERRORS.ALREADY_EXISTS,
				ErrorCode.WALLET_ALREADY_EXISTS,
				true
			);
		}

		// Generate new private key
		const privateKey = generatePrivateKey();
		const account = privateKeyToAccount(privateKey);

		// Encrypt and store
		const encrypted = await this.cryptoService.encryptPrivateKey(
			privateKey,
			password
		);

		this.plugin.settings.wallet = {
			hasWallet: true,
			encryptedPrivateKey: JSON.stringify(encrypted),
			encryptionSalt: encrypted.salt,
			address: account.address,
		};
		await this.plugin.saveSettings();

		this.state.isInitialized = true;
		this.state.address = account.address;

		// Auto-unlock after creation
		await this.unlock(password);

		return account.address;
	}

	/**
	 * Import existing wallet from private key
	 */
	async importWallet(privateKey: Hex, password: string): Promise<Address> {
		if (this.plugin.settings.wallet.hasWallet) {
			throw new PluginError(
				WALLET_ERRORS.ALREADY_EXISTS,
				ErrorCode.WALLET_ALREADY_EXISTS,
				true
			);
		}

		// Validate private key format
		if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
			throw new PluginError(
				WALLET_ERRORS.INVALID_PRIVATE_KEY,
				ErrorCode.INVALID_PRIVATE_KEY,
				true
			);
		}

		// Validate private key cryptographically
		let account;
		try {
			account = privateKeyToAccount(privateKey);
		} catch (error) {
			throw new PluginError(
				'Invalid private key. Please check that your private key is a valid secp256k1 key.',
				ErrorCode.INVALID_PRIVATE_KEY,
				true,
				error
			);
		}

		// Encrypt and store
		const encrypted = await this.cryptoService.encryptPrivateKey(
			privateKey,
			password
		);

		this.plugin.settings.wallet = {
			hasWallet: true,
			encryptedPrivateKey: JSON.stringify(encrypted),
			encryptionSalt: encrypted.salt,
			address: account.address,
		};
		await this.plugin.saveSettings();

		this.state.isInitialized = true;
		this.state.address = account.address;

		// Auto-unlock after import
		await this.unlock(password);

		return account.address;
	}

	/**
	 * Unlock wallet with password
	 */
	async unlock(password: string): Promise<UnlockedWallet> {
		if (!this.plugin.settings.wallet.encryptedPrivateKey) {
			throw new PluginError(
				WALLET_ERRORS.NO_WALLET,
				ErrorCode.WALLET_NO_EXISTS,
				true
			);
		}

		const encrypted: EncryptedKeyData = JSON.parse(
			this.plugin.settings.wallet.encryptedPrivateKey
		);

		// Decrypt private key
		const privateKey = await this.cryptoService.decryptPrivateKey(
			encrypted,
			password
		);
		const account = privateKeyToAccount(privateKey);

		// Get current network configuration
		const network = NETWORKS[this.plugin.settings.network];
		const rpcUrl =
			this.plugin.settings.customRpcUrl || network.rpcUrl;

		// Create shared chain configuration
		const chainConfig = this.createChainConfig(network, rpcUrl);

		// Create viem clients
		const publicClient = createPublicClient({
			chain: chainConfig,
			transport: http(rpcUrl),
		});

		const walletClient = createWalletClient({
			chain: chainConfig,
			transport: http(rpcUrl),
			account,
		});

		this.unlockedWallet = {
			address: account.address,
			privateKey,
			publicClient,
			walletClient,
		};

		this.state.isUnlocked = true;
		this.state.address = account.address;

		// Fetch initial balance
		try {
			await this.refreshBalance();
		} catch (error) {
			// Balance fetch failure shouldn't prevent unlock
			console.warn('Failed to fetch initial balance:', error);
		}

		return this.unlockedWallet;
	}

	/**
	 * Lock wallet - clear sensitive data from memory
	 */
	lock(): void {
		if (this.unlockedWallet) {
			// Overwrite private key in memory before clearing
			this.unlockedWallet.privateKey =
				'0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
			this.unlockedWallet = null;
		}

		// Clear any in-flight balance refresh
		this.balanceRefreshPromise = null;

		this.state.isUnlocked = false;
		this.state.balance = null;
		this.state.lastBalanceCheck = null;
	}

	/**
	 * Get wallet client (throws if locked)
	 */
	getWalletClient(): WalletClient {
		if (!this.unlockedWallet) {
			throw new PluginError(
				WALLET_ERRORS.WALLET_LOCKED,
				ErrorCode.WALLET_LOCKED,
				true
			);
		}
		return this.unlockedWallet.walletClient;
	}

	/**
	 * Get public client (throws if locked)
	 */
	getPublicClient(): PublicClient {
		if (!this.unlockedWallet) {
			throw new PluginError(
				WALLET_ERRORS.WALLET_LOCKED,
				ErrorCode.WALLET_LOCKED,
				true
			);
		}
		return this.unlockedWallet.publicClient;
	}

	/**
	 * Get private key from unlocked wallet
	 * @throws {PluginError} if wallet is locked
	 * @returns {Hex} The private key
	 */
	getPrivateKey(): Hex {
		if (!this.unlockedWallet) {
			throw new PluginError(
				WALLET_ERRORS.WALLET_LOCKED,
				ErrorCode.WALLET_LOCKED,
				true
			);
		}
		return this.unlockedWallet.privateKey;
	}

	/**
	 * Refresh balance from blockchain
	 * Prevents concurrent requests by returning in-flight promise
	 */
	async refreshBalance(): Promise<bigint> {
		if (!this.unlockedWallet) {
			throw new PluginError(
				WALLET_ERRORS.WALLET_LOCKED,
				ErrorCode.WALLET_LOCKED,
				true
			);
		}

		// Return existing promise if refresh already in progress
		if (this.balanceRefreshPromise) {
			return this.balanceRefreshPromise;
		}

		// Create new refresh promise
		this.balanceRefreshPromise = (async () => {
			try {
				const balance =
					await this.unlockedWallet!.publicClient.getBalance({
						address: this.unlockedWallet!.address,
					});

				this.state.balance = balance;
				this.state.lastBalanceCheck = Date.now();

				return balance;
			} catch (error) {
				throw new PluginError(
					'Failed to fetch balance',
					ErrorCode.NETWORK,
					true,
					error
				);
			} finally {
				// Clear promise when done (success or failure)
				this.balanceRefreshPromise = null;
			}
		})();

		return this.balanceRefreshPromise;
	}

	/**
	 * Get formatted balance in TRUST
	 */
	getFormattedBalance(): string {
		if (this.state.balance === null) return '0';
		return formatEther(this.state.balance);
	}

	/**
	 * Create chain configuration for viem clients
	 * @private
	 */
	private createChainConfig(network: typeof NETWORKS[keyof typeof NETWORKS], rpcUrl: string) {
		return {
			id: network.chainId,
			name: network.name,
			nativeCurrency: {
				name: 'TRUST',
				symbol: 'TRUST',
				decimals: 18,
			},
			rpcUrls: { default: { http: [rpcUrl] } },
		};
	}

	/**
	 * Delete wallet (requires password confirmation)
	 */
	async deleteWallet(password: string): Promise<void> {
		// Verify password first by attempting unlock
		await this.unlock(password);

		// Clear wallet data
		this.plugin.settings.wallet = {
			hasWallet: false,
			encryptedPrivateKey: null,
			encryptionSalt: null,
			address: null,
		};
		await this.plugin.saveSettings();

		// Lock and clear state
		this.lock();
		this.state.isInitialized = false;
		this.state.address = null;
	}
}
