import { Hex } from 'viem';
import { EncryptedKeyData } from '../types/wallet';
import { PluginError, ErrorCode } from '../types/errors';
import { WALLET_ERRORS } from '../types/constants';

/**
 * CryptoService - Handles encryption/decryption of private keys
 * Uses Web Crypto API with AES-GCM and PBKDF2
 */
export class CryptoService {
	private static readonly ALGORITHM = 'AES-GCM';
	private static readonly KEY_LENGTH = 256;
	private static readonly ITERATIONS = 100000;
	private static readonly IV_LENGTH = 12; // 12 bytes for GCM
	private static readonly SALT_LENGTH = 16; // 16 bytes for PBKDF2

	/**
	 * Encrypt a private key with a password
	 */
	async encryptPrivateKey(
		privateKey: Hex,
		password: string
	): Promise<EncryptedKeyData> {
		// Validate inputs
		if (!password || password.length < 8) {
			throw new PluginError(
				WALLET_ERRORS.PASSWORD_TOO_SHORT,
				ErrorCode.VALIDATION,
				true
			);
		}

		if (!crypto.subtle) {
			throw new PluginError(
				'Web Crypto API not available',
				ErrorCode.ENCRYPTION_ERROR,
				false
			);
		}

		try {
			const encoder = new TextEncoder();
			const salt = crypto.getRandomValues(
				new Uint8Array(CryptoService.SALT_LENGTH)
			);
			const iv = crypto.getRandomValues(
				new Uint8Array(CryptoService.IV_LENGTH)
			);

			// Derive key from password
			const keyMaterial = await crypto.subtle.importKey(
				'raw',
				encoder.encode(password),
				'PBKDF2',
				false,
				['deriveBits', 'deriveKey']
			);

			const key = await crypto.subtle.deriveKey(
				{
					name: 'PBKDF2',
					salt,
					iterations: CryptoService.ITERATIONS,
					hash: 'SHA-256',
				},
				keyMaterial,
				{
					name: CryptoService.ALGORITHM,
					length: CryptoService.KEY_LENGTH,
				},
				false,
				['encrypt', 'decrypt']
			);

			// Encrypt the private key
			const encrypted = await crypto.subtle.encrypt(
				{ name: CryptoService.ALGORITHM, iv },
				key,
				encoder.encode(privateKey)
			);

			return {
				encryptedKey: this.arrayBufferToBase64(encrypted),
				iv: this.arrayBufferToBase64(iv.buffer),
				salt: this.arrayBufferToBase64(salt.buffer),
				algorithm: 'AES-GCM',
				keyDerivation: 'PBKDF2',
				iterations: CryptoService.ITERATIONS,
			};
		} catch (error) {
			if (error instanceof PluginError) {
				throw error;
			}

			throw new PluginError(
				WALLET_ERRORS.ENCRYPTION_FAILED,
				ErrorCode.ENCRYPTION_ERROR,
				false,
				error
			);
		}
	}

	/**
	 * Decrypt a private key with a password
	 */
	async decryptPrivateKey(
		encrypted: EncryptedKeyData,
		password: string
	): Promise<Hex> {
		if (!encrypted || !password) {
			throw new PluginError(
				'Invalid decryption parameters',
				ErrorCode.VALIDATION,
				false
			);
		}

		if (!crypto.subtle) {
			throw new PluginError(
				'Web Crypto API not available',
				ErrorCode.ENCRYPTION_ERROR,
				false
			);
		}

		try {
			const encoder = new TextEncoder();
			const decoder = new TextDecoder();

			const salt = this.base64ToArrayBuffer(encrypted.salt);
			const iv = this.base64ToArrayBuffer(encrypted.iv);
			const encryptedData = this.base64ToArrayBuffer(
				encrypted.encryptedKey
			);

			// Derive key from password
			const keyMaterial = await crypto.subtle.importKey(
				'raw',
				encoder.encode(password),
				'PBKDF2',
				false,
				['deriveBits', 'deriveKey']
			);

			const key = await crypto.subtle.deriveKey(
				{
					name: 'PBKDF2',
					salt: new Uint8Array(salt),
					iterations: encrypted.iterations,
					hash: 'SHA-256',
				},
				keyMaterial,
				{
					name: encrypted.algorithm,
					length: CryptoService.KEY_LENGTH,
				},
				false,
				['encrypt', 'decrypt']
			);

			// Decrypt
			const decrypted = await crypto.subtle.decrypt(
				{ name: encrypted.algorithm, iv: new Uint8Array(iv) },
				key,
				encryptedData
			);

			return decoder.decode(decrypted) as Hex;
		} catch (error) {
			// Decryption failures are usually wrong password
			if (
				error instanceof Error &&
				error.name === 'OperationError'
			) {
				throw new PluginError(
					WALLET_ERRORS.INVALID_PASSWORD,
					ErrorCode.INVALID_PASSWORD,
					true // recoverable - user can try again
				);
			}

			throw new PluginError(
				WALLET_ERRORS.DECRYPTION_FAILED,
				ErrorCode.ENCRYPTION_ERROR,
				false,
				error
			);
		}
	}

	/**
	 * Convert ArrayBuffer to Base64 string
	 */
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	/**
	 * Convert Base64 string to ArrayBuffer
	 */
	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes.buffer;
	}
}
