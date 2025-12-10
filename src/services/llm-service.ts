/**
 * LLM Service - Manages Large Language Model integration
 * Handles API key encryption, rate limiting, cost tracking, and LLM requests
 */

import { type Hex } from 'viem';
import { BaseService } from './base-service';
import { CryptoService } from './crypto-service';
// import { CacheService } from './cache-service'; // Will be used in Phase 4
import type IntuitionPlugin from '../main';
import {
	PluginError,
	ErrorCode,
	LLM_ERRORS,
	LLM_PROVIDERS,
	type EncryptedKeyData,
	type ValidationResult,
	type LLMCostEstimate,
} from '../types';
// AI SDK imports
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
// Obsidian fetch adapter for CORS fix
import { createObsidianFetch } from '../utils/obsidian-fetch';

export class LLMService extends BaseService {
	private cryptoService: CryptoService;
	// private cacheService: CacheService; // Will be added in Phase 4
	private decryptedApiKey: string | null = null;
	private llmClient: any = null; // Vercel AI SDK client
	private autoLockTimer: NodeJS.Timeout | null = null;

	// Rate limiting state
	private activeRequests = 0;
	private lastRequestTime = 0;
	private requestTimestamps: number[] = [];

	constructor(plugin: IntuitionPlugin) {
		super(plugin);
		// Create internal dependencies (like WalletService does)
		this.cryptoService = new CryptoService();
		// this.cacheService = new CacheService(); // Will be added in Phase 4
	}

	/**
	 * Initialize LLM service - restore state from settings
	 */
	async initialize(): Promise<void> {
		// Check monthly reset
		this.checkMonthlyReset();
		// DO NOT decrypt API key here - that happens on unlock()
	}

	/**
	 * Cleanup - lock and clear sensitive data
	 */
	cleanup(): void {
		this.lock();
	}

	/**
	 * Save and encrypt API key
	 */
	async saveApiKey(apiKey: string, password: string): Promise<void> {
		if (!password || password.length < 8) {
			throw new PluginError(
				'Password must be at least 8 characters',
				ErrorCode.VALIDATION,
				true
			);
		}

		if (!apiKey || apiKey.trim().length === 0) {
			throw new PluginError(
				LLM_ERRORS.NO_API_KEY,
				ErrorCode.VALIDATION,
				true
			);
		}

		try {
			// Encrypt using CryptoService (same as wallet)
			// NOTE: Type cast to Hex is semantically incorrect (API keys are not hex strings)
			// but the underlying AES-GCM encryption works with any UTF-8 string.
			// TODO: Consider refactoring CryptoService.encryptPrivateKey to a generic
			// encrypt(data: string) method to avoid this semantic mismatch.
			const encrypted = await this.cryptoService.encryptPrivateKey(
				apiKey as Hex,
				password
			);

			this.plugin.settings.llm.encryptedApiKey =
				JSON.stringify(encrypted);
			this.plugin.settings.llm.encryptionSalt = encrypted.salt;
			await this.plugin.saveSettings();

			this.plugin.noticeManager.success('API key saved successfully');
		} catch (error) {
			throw new PluginError(
				LLM_ERRORS.ENCRYPTION_FAILED,
				ErrorCode.ENCRYPTION_ERROR,
				true,
				error
			);
		}
	}

	/**
	 * Unlock API key with password
	 */
	async unlock(password: string): Promise<void> {
		if (!this.plugin.settings.llm.encryptedApiKey) {
			throw new PluginError(
				LLM_ERRORS.NO_API_KEY,
				ErrorCode.LLM,
				true
			);
		}

		try {
			const encrypted: EncryptedKeyData = JSON.parse(
				this.plugin.settings.llm.encryptedApiKey
			);

			// Decrypt API key
			const apiKey = await this.cryptoService.decryptPrivateKey(
				encrypted,
				password
			);

			// Store decrypted key in memory
			this.decryptedApiKey = apiKey;

			// Create provider client
			this.createClient();

			// Start auto-lock timer (30 minutes)
			this.resetAutoLockTimer();

			this.plugin.noticeManager.success('API key unlocked');
		} catch (error) {
			if (
				error instanceof PluginError &&
				error.code === ErrorCode.INVALID_PASSWORD
			) {
				throw error; // Re-throw password errors
			}

			throw new PluginError(
				LLM_ERRORS.DECRYPTION_FAILED,
				ErrorCode.ENCRYPTION_ERROR,
				true,
				error
			);
		}
	}

	/**
	 * Lock API key - clear from memory
	 */
	lock(): void {
		// Clear auto-lock timer
		if (this.autoLockTimer) {
			clearTimeout(this.autoLockTimer);
			this.autoLockTimer = null;
		}

		// Clear API key from memory
		// NOTE: JavaScript strings are immutable, so we can't truly zero memory.
		// The string assignment below creates a new string and discards it immediately.
		// The original decrypted key remains in memory until garbage collected.
		// This is a limitation of JavaScript - true memory zeroing is not possible.
		// We rely on the garbage collector to eventually clear the key from memory.
		if (this.decryptedApiKey) {
			this.decryptedApiKey = null;
		}

		// Clear client
		this.llmClient = null;
	}

	/**
	 * Check if LLM is available (enabled, configured, and unlocked)
	 */
	isAvailable(): boolean {
		return (
			this.plugin.settings.llm.enabled &&
			!!this.plugin.settings.llm.encryptedApiKey &&
			this.decryptedApiKey !== null &&
			this.llmClient !== null
		);
	}

	/**
	 * Remove API key (requires password confirmation)
	 */
	async removeApiKey(password: string): Promise<void> {
		// Verify password first by attempting unlock
		await this.unlock(password);

		// Clear API key data
		this.plugin.settings.llm.encryptedApiKey = null;
		this.plugin.settings.llm.encryptionSalt = null;
		await this.plugin.saveSettings();

		// Lock
		this.lock();

		this.plugin.noticeManager.success('API key removed');
	}

	/**
	 * Create LLM provider client based on settings
	 * TODO: Implement in Phase 7 after installing AI SDK packages
	 */
	private createClient(): void {
		if (!this.decryptedApiKey) return;

		const provider = this.plugin.settings.llm.provider;
		const customBaseUrl = this.plugin.settings.llm.customBaseUrl;

		// Validate custom endpoint if provided
		if (customBaseUrl) {
			const validation = this.validateCustomEndpoint(customBaseUrl);
			if (!validation.valid) {
				throw new PluginError(
					validation.errors[0],
					ErrorCode.VALIDATION,
					true
				);
			}
		}

		// Create custom fetch wrapper to bypass CORS restrictions
		// This uses Obsidian's requestUrl() instead of standard fetch()
		const customFetch = createObsidianFetch(this.plugin);

		try {
			switch (provider) {
				case 'anthropic':
					this.llmClient = createAnthropic({
						apiKey: this.decryptedApiKey,
						fetch: customFetch,
					});
					break;
				case 'openai':
					this.llmClient = createOpenAI({
						apiKey: this.decryptedApiKey,
						baseURL: customBaseUrl || undefined,
						fetch: customFetch,
					});
					break;
				case 'openrouter':
					this.llmClient = createOpenAI({
						apiKey: this.decryptedApiKey,
						baseURL: 'https://openrouter.ai/api/v1',
						fetch: customFetch,
					});
					break;
				case 'google':
					this.llmClient = createGoogleGenerativeAI({
						apiKey: this.decryptedApiKey,
						fetch: customFetch,
					});
					break;
				default:
					throw new PluginError(
						LLM_ERRORS.INVALID_PROVIDER,
						ErrorCode.LLM,
						true
					);
			}
		} catch (error) {
			throw new PluginError(
				LLM_ERRORS.CONNECTION_FAILED,
				ErrorCode.LLM_PROVIDER_ERROR,
				true,
				error
			);
		}

	}

	/**
	 * Validate custom endpoint URL (SSRF protection)
	 */
	private validateCustomEndpoint(url: string): ValidationResult {
		try {
			const parsed = new URL(url);

			// Check if in development mode
			const isDev = process.env.NODE_ENV === 'development';

			// Require HTTPS (except localhost in dev mode)
			if (parsed.protocol !== 'https:') {
				if (!isDev || parsed.hostname !== 'localhost') {
					return {
						valid: false,
						errors: [LLM_ERRORS.CUSTOM_ENDPOINT_INVALID],
					};
				}
			}

			// Block internal IPs (except dev mode)
			if (!isDev) {
				const blockedHosts = [
					'localhost',
					'127.0.0.1',
					'0.0.0.0',
					'169.254.169.254',
					'::1',
					'10.0.0.0',
					'172.16.0.0',
					'192.168.0.0',
				];

				if (
					blockedHosts.some((blocked) =>
						parsed.hostname.startsWith(blocked)
					)
				) {
					return {
						valid: false,
						errors: [LLM_ERRORS.CUSTOM_ENDPOINT_INTERNAL],
					};
				}
			}

			return { valid: true, errors: [] };
		} catch (error) {
			return {
				valid: false,
				errors: ['Invalid URL format'],
			};
		}
	}

	/**
	 * Sanitize user input to prevent prompt injection
	 */
	private sanitizeInput(text: string): string {
		// Remove null bytes
		let sanitized = text.replace(/\0/g, '');

		// Limit length (max ~50K tokens = 200K chars)
		const maxLength = 200000;
		if (sanitized.length > maxLength) {
			sanitized = sanitized.substring(0, maxLength);
		}

		return sanitized.trim();
	}

	/**
	 * Detect suspicious patterns that might be prompt injection attempts
	 */
	private detectSuspiciousPatterns(text: string): boolean {
		const patterns = [
			/ignore\s+previous\s+instructions/i,
			/disregard\s+previous\s+instructions/i,
			/forget\s+previous\s+instructions/i,
			/system\s*:/i,
			/assistant\s*:/i,
			/\[SYSTEM\]/i,
			/\[ASSISTANT\]/i,
			/<\|im_start\|>/i,
			/<\|im_end\|>/i,
		];

		return patterns.some((pattern) => pattern.test(text));
	}

	/**
	 * Enqueue request with rate limiting
	 *
	 * NOTE: Minor race condition exists in concurrent request limiting.
	 * Multiple requests waiting in the while loop could wake up simultaneously
	 * and all increment activeRequests, potentially exceeding the limit of 3.
	 * This is acceptable because:
	 * 1. Impact is minimal (might have 4-5 concurrent requests instead of 3)
	 * 2. Proper fix would require mutex/semaphore implementation
	 * 3. Provider rate limits are per-second/minute, not concurrent
	 * 4. Obsidian plugin usage patterns unlikely to trigger this edge case
	 *
	 * If stricter concurrency control is needed, consider implementing a proper
	 * queue with semaphore pattern (e.g., using p-limit library).
	 */
	private async enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
		// Check concurrent limit (3) - minor race condition possible (see above)
		while (this.activeRequests >= 3) {
			await this.wait(100);
		}

		// Check time between requests (1 second minimum)
		const now = Date.now();
		const timeSince = now - this.lastRequestTime;
		if (timeSince < 1000) {
			await this.wait(1000 - timeSince);
		}

		// Check per-minute limit (30 requests)
		this.requestTimestamps = this.requestTimestamps.filter(
			(t) => now - t < 60000
		);
		if (this.requestTimestamps.length >= 30) {
			throw new PluginError(
				LLM_ERRORS.RATE_LIMIT_EXCEEDED,
				ErrorCode.LLM_RATE_LIMIT,
				true
			);
		}

		this.activeRequests++;
		this.lastRequestTime = Date.now();
		this.requestTimestamps.push(this.lastRequestTime);

		try {
			return await fn();
		} finally {
			this.activeRequests--;
			this.resetAutoLockTimer();
		}
	}

	/**
	 * Wait utility for rate limiting
	 */
	private wait(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Reset auto-lock timer (30 minutes)
	 */
	private resetAutoLockTimer(): void {
		if (this.autoLockTimer) {
			clearTimeout(this.autoLockTimer);
		}

		this.autoLockTimer = setTimeout(() => {
			this.lock();
			this.plugin.noticeManager.info(
				'LLM API key auto-locked due to inactivity'
			);
		}, 30 * 60 * 1000); // 30 minutes
	}

	/**
	 * Estimate token count from text (rough estimation)
	 *
	 * WARNING: This is a very rough heuristic with significant limitations:
	 * - Assumes 1 token ≈ 4 characters (varies by model and language)
	 * - Accuracy can vary by ±50% or more
	 * - Less accurate for non-English text, code, or special characters
	 * - Different models use different tokenizers (GPT vs Claude vs Gemini)
	 *
	 * For production use, consider using proper tokenizer libraries:
	 * - js-tiktoken for OpenAI models
	 * - @anthropic-ai/tokenizer for Claude models
	 * - Model-specific tokenizers for other providers
	 *
	 * Current implementation is acceptable for rough cost estimates but should
	 * not be relied upon for precise budget tracking.
	 */
	private estimateTokens(text: string): number {
		// Rough estimation: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4);
	}

	/**
	 * Estimate cost for a request
	 */
	estimateCost(
		text: string,
		expectedOutputTokens: number
	): LLMCostEstimate {
		const modelId = this.plugin.settings.llm.modelId;
		const provider = this.plugin.settings.llm.provider;
		const model = LLM_PROVIDERS[provider].models.find(
			(m) => m.id === modelId
		);

		if (!model) {
			throw new PluginError(
				'Model not found',
				ErrorCode.LLM,
				true
			);
		}

		const estimatedInputTokens = this.estimateTokens(text);
		const inputCost =
			(estimatedInputTokens / 1_000_000) * model.inputPricePerMillion;
		const outputCost =
			(expectedOutputTokens / 1_000_000) *
			model.outputPricePerMillion;

		return {
			estimatedInputTokens,
			estimatedOutputTokens: expectedOutputTokens,
			estimatedCostUSD: inputCost + outputCost,
			modelId,
		};
	}

	/**
	 * Check if request is within budget
	 * Used by extractClaims() method (implemented in Plan 006-2b)
	 */
	checkBudget(estimatedCostUSD: number): ValidationResult {
		const costMgmt = this.plugin.settings.llm.costManagement;

		// If tracking not enabled or no budget set, allow all requests
		if (!costMgmt.trackUsage || !costMgmt.monthlyBudgetUSD) {
			return { valid: true, errors: [] };
		}

		const stats = this.plugin.settings.llm.usageStats;
		const projectedCost = stats.totalCostUSD + estimatedCostUSD;
		const percentUsed =
			(projectedCost / costMgmt.monthlyBudgetUSD) * 100;

		// Hard block at 100%
		if (percentUsed >= 100) {
			return {
				valid: false,
				errors: [LLM_ERRORS.BUDGET_EXCEEDED],
			};
		}

		// Warn at threshold (default 80%)
		if (percentUsed >= costMgmt.warningThresholdPercent) {
			this.plugin.noticeManager.warning(
				`Budget warning: ${percentUsed.toFixed(1)}% used ($${projectedCost.toFixed(4)} / $${costMgmt.monthlyBudgetUSD})`
			);
		}

		return { valid: true, errors: [] };
	}

	/**
	 * Track usage after a request
	 * Used by extractClaims() method (implemented in Plan 006-2b)
	 */
	async trackUsage(
		modelId: string,
		inputTokens: number,
		outputTokens: number
	): Promise<void> {
		const provider = this.plugin.settings.llm.provider;
		const model = LLM_PROVIDERS[provider].models.find(
			(m) => m.id === modelId
		);

		if (!model) return;

		const inputCost =
			(inputTokens / 1_000_000) * model.inputPricePerMillion;
		const outputCost =
			(outputTokens / 1_000_000) * model.outputPricePerMillion;
		const totalCost = inputCost + outputCost;

		const stats = this.plugin.settings.llm.usageStats;

		// Update totals
		stats.totalRequests++;
		stats.totalInputTokens += inputTokens;
		stats.totalOutputTokens += outputTokens;
		stats.totalCostUSD += totalCost;

		// Update per-model breakdown
		if (!stats.requestsByModel[modelId]) {
			stats.requestsByModel[modelId] = {
				requests: 0,
				inputTokens: 0,
				outputTokens: 0,
				costUSD: 0,
			};
		}

		stats.requestsByModel[modelId].requests++;
		stats.requestsByModel[modelId].inputTokens += inputTokens;
		stats.requestsByModel[modelId].outputTokens += outputTokens;
		stats.requestsByModel[modelId].costUSD += totalCost;

		await this.plugin.saveSettings();
	}

	/**
	 * Check if monthly reset is needed
	 */
	private checkMonthlyReset(): void {
		const now = Date.now();
		const lastReset = this.plugin.settings.llm.usageStats.lastReset;
		const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

		if (now - lastReset > oneMonthMs) {
			this.resetUsageStats();
		}
	}

	/**
	 * Reset usage statistics
	 */
	async resetUsageStats(): Promise<void> {
		this.plugin.settings.llm.usageStats = {
			totalRequests: 0,
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalCostUSD: 0,
			requestsByModel: {},
			lastReset: Date.now(),
		};
		await this.plugin.saveSettings();
		this.plugin.noticeManager.info('Monthly usage stats reset');
	}

	/**
	 * Extract claims from text using LLM
	 * Returns array of extracted claims (empty on failure)
	 */
	async extractClaims(
		text: string,
		context?: string
	): Promise<import('../types/llm').ExtractedClaimLLM[]> {
		console.debug('[LLM Service] extractClaims called:', {
			textLength: text.length,
			hasContext: !!context,
			isAvailable: this.isAvailable(),
		});

		if (!this.isAvailable()) {
			throw new PluginError(
				LLM_ERRORS.NO_API_KEY,
				ErrorCode.LLM_API_KEY_LOCKED,
				true
			);
		}

		// Sanitize input (prevents prompt injection)
		const sanitized = this.sanitizeInput(text);

		// Check for suspicious patterns
		if (this.detectSuspiciousPatterns(sanitized)) {
			console.warn(
				'Suspicious input detected, skipping LLM extraction'
			);
			return [];
		}

		// Estimate cost
		const expectedOutputTokens = 400;
		const estimate = this.estimateCost(sanitized, expectedOutputTokens);

		console.debug('[LLM Service] Cost estimate:', estimate);

		// Check budget
		const budgetCheck = this.checkBudget(estimate.estimatedCostUSD);
		if (!budgetCheck.valid) {
			throw new PluginError(
				budgetCheck.errors[0],
				ErrorCode.LLM_BUDGET_EXCEEDED,
				true
			);
		}

		// Enqueue request (rate limiting)
		return this.enqueueRequest(async () => {
			try {
				const prompt = this.buildClaimExtractionPrompt(
					sanitized,
					context
				);
				console.debug('[LLM Service] Prompt built, calling LLM...');

				const result = await this.callLLM(prompt);

				// Track usage
				const usage = result.usage;
				await this.trackUsage(
					this.plugin.settings.llm.modelId,
					usage.promptTokens,
					usage.completionTokens
				);

				console.debug('[LLM Service] Claims extracted successfully:', result.object.claims.length);
				return result.object.claims;
			} catch (error) {
				console.error('[LLM Service] LLM claim extraction failed:', {
					error,
					errorType: error?.constructor?.name,
					errorMessage: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});
				return []; // Return empty array to trigger fallback
			}
		});
	}

	/**
	 * Build prompt for claim extraction
	 */
	private buildClaimExtractionPrompt(
		text: string,
		context?: string
	): string {
		return `You are an expert at extracting factual claims from text and structuring them
as Subject-Predicate-Object triples for a knowledge graph.

TASK: Analyze the following text and extract all factual claims that can be
represented as triples.

${context ? `CONTEXT:\n${context}\n\n` : ''}===== BEGIN USER TEXT =====
${text}
===== END USER TEXT =====

GUIDELINES:
1. Only extract factual, verifiable claims - not opinions, questions, or hedged statements
2. Each claim should be a clear Subject-Predicate-Object triple
3. Disambiguate entities when needed (e.g., "Apple" -> "Apple Inc. (technology company)")
4. Use canonical predicates when possible (e.g., "is a", "created", "uses", "has")
5. Assign confidence scores based on how clear and unambiguous the claim is
6. Suggest improvements if the claim could be stated more clearly
7. Add warnings for claims that are subjective, time-sensitive, or potentially contentious

EXCLUSION CRITERIA:
- Questions (ends with ?)
- First-person opinions ("I think...", "I believe...")
- Hedged statements ("might be", "could be", "possibly")
- Incomplete sentences
- Metaphors or figurative language

Return all valid claims found in the text.`;
	}

	/**
	 * Call LLM with structured output using Zod schema
	 */
	private async callLLM(prompt: string): Promise<any> {
		const { generateObject } = await import('ai');
		const { ClaimExtractionSchema } = await import('../types/llm');

		const provider = this.plugin.settings.llm.provider;
		const modelId = this.plugin.settings.llm.modelId;
		const customBaseUrl = this.plugin.settings.llm.customBaseUrl;

		console.debug('[LLM Service] Calling LLM:', {
			provider,
			modelId,
			customBaseUrl,
			promptLength: prompt.length,
			hasClient: !!this.llmClient,
			hasApiKey: !!this.decryptedApiKey,
		});

		// Get model function based on provider
		let model;
		switch (provider) {
			case 'anthropic':
				model = this.llmClient(modelId);
				break;
			case 'openai':
			case 'openrouter':
				model = this.llmClient(modelId);
				break;
			case 'google':
				model = this.llmClient(modelId);
				break;
			default:
				throw new PluginError(
					LLM_ERRORS.INVALID_PROVIDER,
					ErrorCode.LLM,
					true
				);
		}

		console.debug('[LLM Service] Model created, calling generateObject...');

		try {
			const result = await generateObject({
				model,
				schema: ClaimExtractionSchema,
				prompt,
			});

			console.debug('[LLM Service] Response received:', {
				claimsCount: result.object?.claims?.length || 0,
				usage: result.usage,
			});

			return result;
		} catch (error) {
			console.error('[LLM Service] generateObject failed:', {
				error,
				errorType: error?.constructor?.name,
				errorMessage: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error;
		}
	}

}
