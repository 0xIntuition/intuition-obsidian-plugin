/**
 * Settings management service
 */

import { BaseService } from './base-service';
import { IntuitionPluginSettings, NetworkConfig, NETWORKS } from '../types';

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
   * Validates entire settings object
   */
  validateSettings(settings: IntuitionPluginSettings): ValidationResult {
    const errors: string[] = [];

    // Validate network
    if (!['testnet', 'mainnet'].includes(settings.network)) {
      errors.push('Invalid network type');
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
      errors.push('RPC URL cannot be empty');
      return { valid: false, errors };
    }

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('RPC URL must use http or https protocol');
      }
    } catch (e) {
      errors.push('Invalid URL format');
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
      errors.push('Stake amount cannot be empty');
      return { valid: false, errors };
    }

    const numValue = parseFloat(amount);
    if (isNaN(numValue)) {
      errors.push('Stake amount must be a valid number');
    } else if (numValue <= 0) {
      errors.push('Stake amount must be positive');
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
      errors.push('TTL must be a number');
    } else if (ttl <= 0) {
      errors.push('TTL must be positive');
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
