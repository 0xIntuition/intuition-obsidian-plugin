import { vi } from 'vitest';

// In-memory storage for IndexedDB mock
const databases = new Map<string, Map<string, Map<any, any>>>();

// Mock IDBObjectStore
class MockIDBObjectStore {
	name: string;
	keyPath: string | string[] | null;
	indexNames: string[] = [];
	autoIncrement: boolean;
	private store: Map<any, any>;

	constructor(name: string, store: Map<any, any>, keyPath?: string | string[] | null, autoIncrement = false) {
		this.name = name;
		this.keyPath = keyPath || null;
		this.autoIncrement = autoIncrement;
		this.store = store;
	}

	get(key: any) {
		return {
			onsuccess: null,
			onerror: null,
			result: this.store.get(key),
		};
	}

	put(value: any, key?: any) {
		const actualKey = key || (this.keyPath ? value[this.keyPath as string] : undefined);
		if (actualKey === undefined) {
			throw new Error('Key is required');
		}
		this.store.set(actualKey, value);
		return {
			onsuccess: null,
			onerror: null,
			result: actualKey,
		};
	}

	add(value: any, key?: any) {
		const actualKey = key || (this.keyPath ? value[this.keyPath as string] : undefined);
		if (actualKey === undefined) {
			throw new Error('Key is required');
		}
		if (this.store.has(actualKey)) {
			throw new Error('Key already exists');
		}
		this.store.set(actualKey, value);
		return {
			onsuccess: null,
			onerror: null,
			result: actualKey,
		};
	}

	delete(key: any) {
		this.store.delete(key);
		return {
			onsuccess: null,
			onerror: null,
		};
	}

	clear() {
		this.store.clear();
		return {
			onsuccess: null,
			onerror: null,
		};
	}

	getAll() {
		return {
			onsuccess: null,
			onerror: null,
			result: Array.from(this.store.values()),
		};
	}

	getAllKeys() {
		return {
			onsuccess: null,
			onerror: null,
			result: Array.from(this.store.keys()),
		};
	}

	count() {
		return {
			onsuccess: null,
			onerror: null,
			result: this.store.size,
		};
	}
}

// Mock IDBTransaction
class MockIDBTransaction {
	objectStoreNames: string[];
	mode: 'readonly' | 'readwrite' | 'versionchange';
	private stores: Map<string, Map<any, any>>;

	constructor(objectStoreNames: string[], mode: 'readonly' | 'readwrite' | 'versionchange', stores: Map<string, Map<any, any>>) {
		this.objectStoreNames = objectStoreNames;
		this.mode = mode;
		this.stores = stores;
	}

	objectStore(name: string) {
		const store = this.stores.get(name);
		if (!store) {
			throw new Error(`Object store "${name}" not found`);
		}
		return new MockIDBObjectStore(name, store);
	}

	abort() {
		// Mock implementation
	}
}

// Mock IDBDatabase
class MockIDBDatabase {
	name: string;
	version: number;
	objectStoreNames: string[];
	private stores: Map<string, Map<any, any>>;

	constructor(name: string, version: number, storeNames: string[]) {
		this.name = name;
		this.version = version;
		this.objectStoreNames = storeNames;
		this.stores = new Map();

		// Initialize stores
		for (const storeName of storeNames) {
			this.stores.set(storeName, new Map());
		}
	}

	transaction(storeNames: string | string[], mode: 'readonly' | 'readwrite' = 'readonly') {
		const names = Array.isArray(storeNames) ? storeNames : [storeNames];
		return new MockIDBTransaction(names, mode, this.stores);
	}

	createObjectStore(name: string, options?: { keyPath?: string | string[]; autoIncrement?: boolean }) {
		const store = new Map();
		this.stores.set(name, store);
		this.objectStoreNames.push(name);
		return new MockIDBObjectStore(name, store, options?.keyPath, options?.autoIncrement);
	}

	deleteObjectStore(name: string) {
		this.stores.delete(name);
		const index = this.objectStoreNames.indexOf(name);
		if (index > -1) {
			this.objectStoreNames.splice(index, 1);
		}
	}

	close() {
		// Mock implementation
	}
}

// Mock openDB function (compatible with idb library)
export const openDB = vi.fn(async (
	name: string,
	version?: number,
	options?: {
		upgrade?: (db: any, oldVersion: number, newVersion: number | null, transaction: any) => void;
		blocked?: () => void;
		blocking?: () => void;
		terminated?: () => void;
	}
) => {
	// Get or create database
	if (!databases.has(name)) {
		databases.set(name, new Map());
	}

	const dbStores = databases.get(name)!;
	const db = new MockIDBDatabase(name, version || 1, Array.from(dbStores.keys()));

	// Copy existing data
	for (const [storeName, storeData] of dbStores.entries()) {
		db['stores'].set(storeName, storeData);
	}

	// Call upgrade if provided
	if (options?.upgrade) {
		const upgradeDb = {
			...db,
			createObjectStore: (name: string, opts?: any) => {
				const store = new Map();
				dbStores.set(name, store);
				return db.createObjectStore(name, opts);
			},
			deleteObjectStore: (name: string) => {
				dbStores.delete(name);
				db.deleteObjectStore(name);
			},
		};
		options.upgrade(upgradeDb, 0, version || 1, null);
	}

	// Return wrapped DB with convenience methods
	return {
		...db,
		get: async (storeName: string, key: any) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			return store.get(key);
		},
		put: async (storeName: string, value: any, key?: any) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			const actualKey = key || value.id;
			store.set(actualKey, value);
			return actualKey;
		},
		add: async (storeName: string, value: any, key?: any) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			const actualKey = key || value.id;
			if (store.has(actualKey)) {
				throw new Error('Key already exists');
			}
			store.set(actualKey, value);
			return actualKey;
		},
		delete: async (storeName: string, key: any) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			store.delete(key);
		},
		clear: async (storeName: string) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			store.clear();
		},
		getAll: async (storeName: string) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			return Array.from(store.values());
		},
		getAllKeys: async (storeName: string) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			return Array.from(store.keys());
		},
		count: async (storeName: string) => {
			const store = dbStores.get(storeName);
			if (!store) throw new Error(`Object store "${storeName}" not found`);
			return store.size;
		},
		close: () => {
			// Mock implementation
		},
	};
});

// Helper to clear all databases
export function clearAllDatabases() {
	databases.clear();
}

// Helper to get database for inspection in tests
export function getDatabase(name: string) {
	return databases.get(name);
}

// Helper to setup a test database with initial data
export async function setupTestDatabase(name: string, stores: Record<string, any[]>) {
	const db = await openDB(name, 1, {
		upgrade(db) {
			for (const storeName of Object.keys(stores)) {
				db.createObjectStore(storeName, { keyPath: 'id' });
			}
		},
	});

	// Add initial data
	for (const [storeName, items] of Object.entries(stores)) {
		for (const item of items) {
			await db.put(storeName, item);
		}
	}

	return db;
}
