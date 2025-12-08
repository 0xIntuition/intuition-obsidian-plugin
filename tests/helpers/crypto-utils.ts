import { crypto } from '../mocks/crypto';

/**
 * Creates real encrypted data for integration tests
 * Uses actual Web Crypto API to ensure encryption/decryption works correctly
 */
export async function createRealEncryptedData(
	data: string,
	password: string
): Promise<{ encrypted: string; salt: string; iv: string }> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);
	const dataBuffer = encoder.encode(data);

	// Generate salt and IV
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Derive key from password
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		passwordBuffer,
		'PBKDF2',
		false,
		['deriveBits', 'deriveKey']
	);

	const key = await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: salt,
			iterations: 100000,
			hash: 'SHA-256',
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);

	// Encrypt data
	const encrypted = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		key,
		dataBuffer
	);

	// Convert to base64 strings
	const saltBase64 = Buffer.from(salt).toString('base64');
	const ivBase64 = Buffer.from(iv).toString('base64');
	const encryptedBase64 = Buffer.from(encrypted).toString('base64');

	return {
		encrypted: encryptedBase64,
		salt: saltBase64,
		iv: ivBase64,
	};
}

/**
 * Decrypts data that was encrypted with createRealEncryptedData
 */
export async function decryptRealData(
	encrypted: string,
	salt: string,
	iv: string,
	password: string
): Promise<string> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);

	// Convert from base64
	const saltBuffer = new Uint8Array(Buffer.from(salt, 'base64'));
	const ivBuffer = new Uint8Array(Buffer.from(iv, 'base64'));
	const encryptedBuffer = new Uint8Array(Buffer.from(encrypted, 'base64'));

	// Derive key from password
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		passwordBuffer,
		'PBKDF2',
		false,
		['deriveBits', 'deriveKey']
	);

	const key = await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: saltBuffer,
			iterations: 100000,
			hash: 'SHA-256',
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);

	// Decrypt data
	const decrypted = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: ivBuffer,
		},
		key,
		encryptedBuffer
	);

	const decoder = new TextDecoder();
	return decoder.decode(decrypted);
}

/**
 * Creates a formatted encrypted private key for testing
 * Format: salt:iv:encrypted
 */
export async function createEncryptedPrivateKey(
	privateKey: string,
	password: string
): Promise<string> {
	const { encrypted, salt, iv } = await createRealEncryptedData(privateKey, password);
	return `${salt}:${iv}:${encrypted}`;
}

/**
 * Helper to verify that encryption is working correctly
 */
export async function verifyEncryptionRoundTrip(
	data: string,
	password: string
): Promise<boolean> {
	try {
		const { encrypted, salt, iv } = await createRealEncryptedData(data, password);
		const decrypted = await decryptRealData(encrypted, salt, iv, password);
		return decrypted === data;
	} catch (error) {
		return false;
	}
}

/**
 * Helper to verify that wrong password fails decryption
 */
export async function verifyWrongPasswordFails(
	data: string,
	correctPassword: string,
	wrongPassword: string
): Promise<boolean> {
	try {
		const { encrypted, salt, iv } = await createRealEncryptedData(data, correctPassword);
		await decryptRealData(encrypted, salt, iv, wrongPassword);
		return false; // Should have thrown
	} catch (error) {
		return true; // Correctly failed
	}
}

/**
 * Helper to generate a random private key hex string
 */
export function generateRandomPrivateKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return '0x' + Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Helper to validate private key format
 */
export function isValidPrivateKeyFormat(privateKey: string): boolean {
	return /^0x[a-fA-F0-9]{64}$/.test(privateKey);
}

/**
 * Helper to validate Ethereum address format
 */
export function isValidAddressFormat(address: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
}
