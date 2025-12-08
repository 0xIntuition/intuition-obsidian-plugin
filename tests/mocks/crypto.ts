import { vi } from 'vitest';

// Re-export actual crypto (Node 18+ has Web Crypto API)
// Tests will use real crypto by default for authenticity
export { webcrypto as crypto } from 'crypto';

// Test constants
export const TEST_PASSWORD = 'test-password-123';
export const TEST_SALT = new Uint8Array(16).fill(1);
export const TEST_IV = new Uint8Array(12).fill(2);

// Helper to create deterministic random values for testing
export function mockRandomValues(array: Uint8Array, fillValue = 0x42): Uint8Array {
	for (let i = 0; i < array.length; i++) {
		array[i] = fillValue;
	}
	return array;
}

// Mock getRandomValues for deterministic tests
export function useDeterministicCrypto() {
	const originalGetRandomValues = global.crypto.getRandomValues;

	// Mock with deterministic values
	global.crypto.getRandomValues = vi.fn((array: any) => {
		return mockRandomValues(array);
	}) as any;

	// Return cleanup function
	return () => {
		global.crypto.getRandomValues = originalGetRandomValues;
	};
}

// Helper to create a test encryption key
export async function createTestKey(password: string = TEST_PASSWORD, salt: Uint8Array = TEST_SALT): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);

	// Import password as key material
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		passwordBuffer,
		'PBKDF2',
		false,
		['deriveBits', 'deriveKey']
	);

	// Derive encryption key
	return await crypto.subtle.deriveKey(
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
}

// Helper to encrypt data for testing
export async function encryptTestData(
	data: string,
	password: string = TEST_PASSWORD,
	salt: Uint8Array = TEST_SALT,
	iv: Uint8Array = TEST_IV
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; iv: Uint8Array }> {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(data);

	const key = await createTestKey(password, salt);

	const encrypted = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		key,
		dataBuffer
	);

	return { encrypted, salt, iv };
}

// Helper to decrypt data for testing
export async function decryptTestData(
	encrypted: ArrayBuffer,
	password: string = TEST_PASSWORD,
	salt: Uint8Array = TEST_SALT,
	iv: Uint8Array = TEST_IV
): Promise<string> {
	const key = await createTestKey(password, salt);

	const decrypted = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		key,
		encrypted
	);

	const decoder = new TextDecoder();
	return decoder.decode(decrypted);
}

// Helper to create mock encrypted private key
export async function createMockEncryptedPrivateKey(
	privateKey: string,
	password: string = TEST_PASSWORD
): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));

	const { encrypted } = await encryptTestData(privateKey, password, salt, iv);

	// Convert to base64 format: salt:iv:encrypted
	const saltBase64 = Buffer.from(salt).toString('base64');
	const ivBase64 = Buffer.from(iv).toString('base64');
	const encryptedBase64 = Buffer.from(encrypted).toString('base64');

	return `${saltBase64}:${ivBase64}:${encryptedBase64}`;
}

// Helper to parse mock encrypted private key
export function parseMockEncryptedPrivateKey(encrypted: string): {
	salt: Uint8Array;
	iv: Uint8Array;
	encrypted: Uint8Array;
} {
	const [saltBase64, ivBase64, encryptedBase64] = encrypted.split(':');

	return {
		salt: new Uint8Array(Buffer.from(saltBase64, 'base64')),
		iv: new Uint8Array(Buffer.from(ivBase64, 'base64')),
		encrypted: new Uint8Array(Buffer.from(encryptedBase64, 'base64')),
	};
}

// Helper to generate a random hex string (for test private keys)
export function generateRandomHex(length: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return '0x' + Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

// Helper to convert string to ArrayBuffer
export function stringToArrayBuffer(str: string): ArrayBuffer {
	const encoder = new TextEncoder();
	return encoder.encode(str).buffer;
}

// Helper to convert ArrayBuffer to string
export function arrayBufferToString(buffer: ArrayBuffer): string {
	const decoder = new TextDecoder();
	return decoder.decode(buffer);
}

// Helper to convert ArrayBuffer to hex string
export function arrayBufferToHex(buffer: ArrayBuffer): string {
	return '0x' + Array.from(new Uint8Array(buffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

// Helper to convert hex string to ArrayBuffer
export function hexToArrayBuffer(hex: string): ArrayBuffer {
	const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
	const bytes = new Uint8Array(cleanHex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
	}
	return bytes.buffer;
}
