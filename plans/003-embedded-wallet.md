# Plan 003: Embedded Wallet Infrastructure

## Objective
Implement secure embedded wallet functionality using viem, including private key generation, encrypted storage, and signing capabilities.

## Prerequisites
- Plan 001 (Project Foundation)
- Plan 002 (Settings System)

## Deliverables
1. Wallet service with key generation and import
2. Secure encryption/decryption using Web Crypto API
3. Wallet creation/import modal UI
4. Balance checking functionality
5. Transaction signing interface

## Files to Create

```
src/
  types/
    wallet.ts                # Wallet interfaces
  services/
    wallet-service.ts        # Wallet management
    crypto-service.ts        # Encryption utilities
  ui/
    modals/
      wallet-setup-modal.ts  # Initial wallet setup
      wallet-import-modal.ts # Import existing wallet
      unlock-wallet-modal.ts # Password entry
    components/
      wallet-status.ts       # Status bar component
```

## Data Models

```typescript
// src/types/wallet.ts
import type { Address, Hex, PublicClient, WalletClient } from 'viem';

export interface WalletState {
  isInitialized: boolean;
  isUnlocked: boolean;
  address: Address | null;
  balance: bigint | null;
  lastBalanceCheck: number | null;
}

export interface UnlockedWallet {
  address: Address;
  privateKey: Hex;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export interface EncryptedKeyData {
  encryptedKey: string;      // Base64 encoded
  iv: string;                // Base64 encoded
  salt: string;              // Base64 encoded
  algorithm: 'AES-GCM';
  keyDerivation: 'PBKDF2';
  iterations: number;        // 100000
}

export type WalletEvent =
  | { type: 'initialized'; address: Address }
  | { type: 'unlocked'; address: Address }
  | { type: 'locked' }
  | { type: 'balanceUpdated'; balance: bigint }
  | { type: 'error'; error: Error };
```

## Implementation

### Crypto Service (src/services/crypto-service.ts)

```typescript
import { Hex } from 'viem';
import { EncryptedKeyData } from '../types/wallet';

export class CryptoService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly ITERATIONS = 100000;

  async encryptPrivateKey(privateKey: Hex, password: string): Promise<EncryptedKeyData> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

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
      { name: CryptoService.ALGORITHM, length: CryptoService.KEY_LENGTH },
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
      iv: this.arrayBufferToBase64(iv),
      salt: this.arrayBufferToBase64(salt),
      algorithm: 'AES-GCM',
      keyDerivation: 'PBKDF2',
      iterations: CryptoService.ITERATIONS,
    };
  }

  async decryptPrivateKey(encrypted: EncryptedKeyData, password: string): Promise<Hex> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const salt = this.base64ToArrayBuffer(encrypted.salt);
    const iv = this.base64ToArrayBuffer(encrypted.iv);
    const encryptedData = this.base64ToArrayBuffer(encrypted.encryptedKey);

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
      { name: encrypted.algorithm, length: CryptoService.KEY_LENGTH },
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
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
```

### Wallet Service (src/services/wallet-service.ts)

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { CryptoService } from './crypto-service';
import { WalletState, UnlockedWallet, EncryptedKeyData } from '../types/wallet';
import { NETWORKS, NetworkType } from '../types/networks';
import IntuitionPlugin from '../main';

export class WalletService {
  private plugin: IntuitionPlugin;
  private cryptoService: CryptoService;
  private state: WalletState;
  private unlockedWallet: UnlockedWallet | null = null;

  constructor(plugin: IntuitionPlugin) {
    this.plugin = plugin;
    this.cryptoService = new CryptoService();
    this.state = {
      isInitialized: plugin.settings.wallet.hasWallet,
      isUnlocked: false,
      address: plugin.settings.wallet.address as Address | null,
      balance: null,
      lastBalanceCheck: null,
    };
  }

  getState(): WalletState {
    return { ...this.state };
  }

  isUnlocked(): boolean {
    return this.state.isUnlocked && this.unlockedWallet !== null;
  }

  getAddress(): Address | null {
    return this.state.address;
  }

  // Create new wallet
  async createWallet(password: string): Promise<Address> {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    // Encrypt and store
    const encrypted = await this.cryptoService.encryptPrivateKey(privateKey, password);

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

  // Import existing wallet
  async importWallet(privateKey: Hex, password: string): Promise<Address> {
    // Validate private key
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      throw new Error('Invalid private key format');
    }

    const account = privateKeyToAccount(privateKey);

    // Encrypt and store
    const encrypted = await this.cryptoService.encryptPrivateKey(privateKey, password);

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

  // Unlock wallet
  async unlock(password: string): Promise<UnlockedWallet> {
    if (!this.plugin.settings.wallet.encryptedPrivateKey) {
      throw new Error('No wallet configured');
    }

    const encrypted: EncryptedKeyData = JSON.parse(
      this.plugin.settings.wallet.encryptedPrivateKey
    );

    try {
      const privateKey = await this.cryptoService.decryptPrivateKey(encrypted, password);
      const account = privateKeyToAccount(privateKey);

      // Create clients
      const network = NETWORKS[this.plugin.settings.network];
      const rpcUrl = this.plugin.settings.customRpcUrl || network.rpcUrl;

      const publicClient = createPublicClient({
        chain: {
          id: network.chainId,
          name: network.name,
          nativeCurrency: { name: 'TRUST', symbol: 'TRUST', decimals: 18 },
          rpcUrls: { default: { http: [rpcUrl] } },
        },
        transport: http(rpcUrl),
      });

      const walletClient = createWalletClient({
        chain: {
          id: network.chainId,
          name: network.name,
          nativeCurrency: { name: 'TRUST', symbol: 'TRUST', decimals: 18 },
          rpcUrls: { default: { http: [rpcUrl] } },
        },
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
      await this.refreshBalance();

      return this.unlockedWallet;
    } catch (error) {
      throw new Error('Incorrect password');
    }
  }

  // Lock wallet
  lock(): void {
    this.unlockedWallet = null;
    this.state.isUnlocked = false;
    this.state.balance = null;
  }

  // Get clients (throws if not unlocked)
  getWalletClient(): WalletClient {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }
    return this.unlockedWallet.walletClient;
  }

  getPublicClient(): PublicClient {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }
    return this.unlockedWallet.publicClient;
  }

  // Refresh balance
  async refreshBalance(): Promise<bigint> {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    const balance = await this.unlockedWallet.publicClient.getBalance({
      address: this.unlockedWallet.address,
    });

    this.state.balance = balance;
    this.state.lastBalanceCheck = Date.now();

    return balance;
  }

  getFormattedBalance(): string {
    if (this.state.balance === null) return '0';
    return formatEther(this.state.balance);
  }

  // Delete wallet (requires password confirmation)
  async deleteWallet(password: string): Promise<void> {
    // Verify password first
    await this.unlock(password);

    // Clear wallet data
    this.plugin.settings.wallet = {
      hasWallet: false,
      encryptedPrivateKey: null,
      encryptionSalt: null,
      address: null,
    };
    await this.plugin.saveSettings();

    this.lock();
    this.state.isInitialized = false;
    this.state.address = null;
  }
}
```

### Wallet Setup Modal (src/ui/modals/wallet-setup-modal.ts)

```typescript
import { App, Modal, Setting } from 'obsidian';
import IntuitionPlugin from '../../main';

export class WalletSetupModal extends Modal {
  plugin: IntuitionPlugin;
  private password: string = '';
  private confirmPassword: string = '';
  private mode: 'create' | 'import' = 'create';
  private privateKey: string = '';

  constructor(app: App, plugin: IntuitionPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('intuition-wallet-setup');

    contentEl.createEl('h2', { text: 'Wallet Setup' });

    // Mode selection
    new Setting(contentEl)
      .setName('Setup Mode')
      .addDropdown(dropdown => dropdown
        .addOption('create', 'Create new wallet')
        .addOption('import', 'Import existing wallet')
        .setValue(this.mode)
        .onChange((value: 'create' | 'import') => {
          this.mode = value;
          this.onOpen(); // Refresh UI
        }));

    if (this.mode === 'import') {
      new Setting(contentEl)
        .setName('Private Key')
        .setDesc('Enter your private key (0x...)')
        .addText(text => text
          .setPlaceholder('0x...')
          .setValue(this.privateKey)
          .onChange(value => this.privateKey = value));
    }

    new Setting(contentEl)
      .setName('Password')
      .setDesc('Password to encrypt your wallet')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('Enter password')
          .onChange(value => this.password = value);
      });

    new Setting(contentEl)
      .setName('Confirm Password')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('Confirm password')
          .onChange(value => this.confirmPassword = value);
      });

    // Warning
    const warning = contentEl.createEl('div', { cls: 'intuition-warning' });
    warning.createEl('p', {
      text: 'Your private key will be encrypted and stored locally. Never share your password or private key.'
    });

    // Actions
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close()))
      .addButton(button => button
        .setButtonText(this.mode === 'create' ? 'Create Wallet' : 'Import Wallet')
        .setCta()
        .onClick(() => this.handleSubmit()));
  }

  private async handleSubmit() {
    if (this.password !== this.confirmPassword) {
      this.plugin.noticeManager.error('Passwords do not match');
      return;
    }

    if (this.password.length < 8) {
      this.plugin.noticeManager.error('Password must be at least 8 characters');
      return;
    }

    try {
      if (this.mode === 'create') {
        const address = await this.plugin.walletService.createWallet(this.password);
        this.plugin.noticeManager.success(`Wallet created: ${address.slice(0, 8)}...`);
      } else {
        if (!this.privateKey.startsWith('0x')) {
          this.plugin.noticeManager.error('Invalid private key format');
          return;
        }
        const address = await this.plugin.walletService.importWallet(
          this.privateKey as `0x${string}`,
          this.password
        );
        this.plugin.noticeManager.success(`Wallet imported: ${address.slice(0, 8)}...`);
      }
      this.close();
    } catch (error) {
      this.plugin.noticeManager.error(`Error: ${error.message}`);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    // Clear sensitive data
    this.password = '';
    this.confirmPassword = '';
    this.privateKey = '';
  }
}
```

## Security Considerations

1. **Encryption at Rest**: Private keys encrypted with AES-256-GCM
2. **Key Derivation**: PBKDF2 with 100,000 iterations
3. **Memory Safety**: Clear sensitive data after use
4. **No Network Transmission**: Keys never leave device
5. **Password Requirements**: Minimum 8 characters

## Acceptance Criteria
- [ ] New wallet creation generates valid address
- [ ] Wallet import accepts valid private keys
- [ ] Invalid private keys show clear error
- [ ] Password encrypts key using PBKDF2 + AES-GCM
- [ ] Incorrect password shows error (no decrypt)
- [ ] Balance displays correctly after unlock
- [ ] Wallet locks on plugin unload
- [ ] Delete wallet requires password confirmation
- [ ] Status bar shows wallet status

## Testing
1. Create new wallet, verify address format
2. Lock and unlock wallet, verify success
3. Try wrong password, verify error
4. Import known test wallet, verify address matches
5. Check balance on testnet with funded wallet
6. Reload plugin, verify wallet persists (locked)

## Estimated Effort
High - Security-critical with encryption and viem integration
