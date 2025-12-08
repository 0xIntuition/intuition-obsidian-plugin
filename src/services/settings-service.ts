/**
 * Settings management service
 */

import { BaseService } from './base-service';
import { IntuitionPluginSettings, NetworkConfig, NETWORKS, DEFAULT_SETTINGS, VALIDATION_ERRORS } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class SettingsService extends BaseService {
  async initialize(): Promise<void> {
    // No initialization needed currently
    // Future: Could emit settings-loaded event
  }

  cleanup(): void {
    // No cleanup needed currently
  }

  /**
   * Validates and auto-repairs settings, returning corrected settings
   * This ensures corrupted settings are fixed automatically on load
   * @param settings - Settings to validate
   * @returns Validated and repaired settings
   */
  validateAndRepairSettings(settings: IntuitionPluginSettings): IntuitionPluginSettings {
    const repaired = { ...settings };
    let hadErrors = false;

    // Validate network
    if (!['testnet', 'mainnet'].includes(repaired.network)) {
      repaired.network = 'testnet';
      hadErrors = true;
    }

    // Validate custom RPC URL
    if (repaired.customRpcUrl && repaired.customRpcUrl.trim() !== '') {
      const validation = this.validateRpcUrl(repaired.customRpcUrl);
      if (!validation.valid) {
        repaired.customRpcUrl = null;
        hadErrors = true;
      }
    }

    // Validate stake amount
    const stakeValidation = this.validateStakeAmount(repaired.ui.defaultStakeAmount);
    if (!stakeValidation.valid) {
      repaired.ui.defaultStakeAmount = DEFAULT_SETTINGS.ui.defaultStakeAmount;
      hadErrors = true;
    }

    // Validate cache TTLs
    ['atomTTL', 'vaultTTL', 'searchTTL'].forEach((key) => {
      if (!this.validateCacheTTL(repaired.cache[key as keyof typeof repaired.cache] as number).valid) {
        repaired.cache[key as keyof typeof repaired.cache] = DEFAULT_SETTINGS.cache[key as keyof typeof DEFAULT_SETTINGS.cache];
        hadErrors = true;
      }
    });

    // Validate cache size
    if (repaired.cache.maxCacheSize <= 0) {
      repaired.cache.maxCacheSize = DEFAULT_SETTINGS.cache.maxCacheSize;
      hadErrors = true;
    }

    // Notify user if auto-repair occurred
    if (hadErrors) {
      this.plugin.noticeManager.warning(VALIDATION_ERRORS.SETTINGS_AUTO_REPAIRED);
    }

    return repaired;
  }

  /**
   * Validates entire settings object
   */
  validateSettings(settings: IntuitionPluginSettings): ValidationResult {
    const errors: string[] = [];

    // Validate network
    if (!['testnet', 'mainnet'].includes(settings.network)) {
      errors.push(VALIDATION_ERRORS.NETWORK_INVALID);
    }

    // Validate custom RPC URL if provided
    if (settings.customRpcUrl) {
      const rpcValidation = this.validateRpcUrl(settings.customRpcUrl);
      if (!rpcValidation.valid) {
        errors.push(...rpcValidation.errors);
      }
    }

    // Validate stake amount
    const stakeValidation = this.validateStakeAmount(settings.ui.defaultStakeAmount);
    if (!stakeValidation.valid) {
      errors.push(...stakeValidation.errors);
    }

    // Validate cache TTLs
    const atomTTLValidation = this.validateCacheTTL(settings.cache.atomTTL);
    if (!atomTTLValidation.valid) {
      errors.push('Invalid atom TTL: ' + atomTTLValidation.errors.join(', '));
    }

    const vaultTTLValidation = this.validateCacheTTL(settings.cache.vaultTTL);
    if (!vaultTTLValidation.valid) {
      errors.push('Invalid vault TTL: ' + vaultTTLValidation.errors.join(', '));
    }

    const searchTTLValidation = this.validateCacheTTL(settings.cache.searchTTL);
    if (!searchTTLValidation.valid) {
      errors.push('Invalid search TTL: ' + searchTTLValidation.errors.join(', '));
    }

    // Validate cache size
    if (settings.cache.maxCacheSize <= 0) {
      errors.push('Cache size must be positive');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates RPC URL format
   */
  validateRpcUrl(url: string): ValidationResult {
    const errors: string[] = [];

    if (!url || url.trim() === '') {
      errors.push(VALIDATION_ERRORS.RPC_URL_EMPTY);
      return { valid: false, errors };
    }

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push(VALIDATION_ERRORS.RPC_URL_PROTOCOL);
      }
    } catch (e) {
      errors.push(VALIDATION_ERRORS.RPC_URL_INVALID);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates stake amount (should be a positive numeric string)
   */
  validateStakeAmount(amount: string): ValidationResult {
    const errors: string[] = [];

    if (!amount || amount.trim() === '') {
      errors.push(VALIDATION_ERRORS.STAKE_EMPTY);
      return { valid: false, errors };
    }

    const numValue = parseFloat(amount);
    if (isNaN(numValue)) {
      errors.push(VALIDATION_ERRORS.STAKE_INVALID);
    } else if (numValue <= 0) {
      errors.push(VALIDATION_ERRORS.STAKE_POSITIVE);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates cache TTL (must be positive number)
   */
  validateCacheTTL(ttl: number): ValidationResult {
    const errors: string[] = [];

    if (typeof ttl !== 'number' || isNaN(ttl)) {
      errors.push(VALIDATION_ERRORS.TTL_INVALID);
    } else if (ttl <= 0) {
      errors.push(VALIDATION_ERRORS.TTL_POSITIVE);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets the current network configuration
   */
  getCurrentNetwork(): NetworkConfig {
    return NETWORKS[this.plugin.settings.network];
  }

  /**
   * Gets the effective RPC URL (custom or default)
   */
  getEffectiveRpcUrl(): string {
    const customRpc = this.plugin.settings.customRpcUrl;
    if (customRpc && customRpc.trim() !== '') {
      return customRpc;
    }
    return this.getCurrentNetwork().rpcUrl;
  }
}
