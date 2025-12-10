/**
 * Integration tests for LLM CORS fix
 *
 * These tests verify that LLM requests work with Obsidian's requestUrl
 * instead of standard fetch, bypassing CORS restrictions.
 *
 * NOTE: These tests make real API calls and require valid API keys
 * via environment variables.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LLMService } from '../../src/services/llm-service';
import type IntuitionPlugin from '../../src/main';
import { DEFAULT_SETTINGS } from '../../src/types';

describe('LLM CORS Fix - Integration', () => {
	let mockPlugin: IntuitionPlugin;
	let llmService: LLMService;
	const testPassword = 'test-password-123';

	beforeEach(async () => {
		// Create minimal mock plugin for testing
		mockPlugin = {
			settings: structuredClone(DEFAULT_SETTINGS),
			app: {
				vault: {
					adapter: {
						// Mock requestUrl to verify it's being called
						// In real Obsidian, this bypasses CORS
						requestUrl: async (params: any) => {
							// Make actual fetch call for testing
							const response = await fetch(params.url, {
								method: params.method,
								headers: params.headers,
								body: params.body,
							});

							return {
								status: response.status,
								headers: Object.fromEntries(response.headers.entries()),
								arrayBuffer: await response.arrayBuffer(),
								text: await response.text(),
								json: await response.json().catch(() => null),
							};
						},
					},
				},
			},
			noticeManager: {
				success: () => {},
				error: () => {},
			},
			saveSettings: async () => {},
		} as unknown as IntuitionPlugin;

		llmService = new LLMService(mockPlugin);
		await llmService.initialize();
	});

	describe('Anthropic Provider', () => {
		it('should make successful LLM request via Obsidian requestUrl', async () => {
			const apiKey = process.env.ANTHROPIC_API_KEY;

			if (!apiKey) {
				console.warn('Skipping Anthropic test: ANTHROPIC_API_KEY not set');
				return;
			}

			// Set provider to Anthropic
			mockPlugin.settings.llm.provider = 'anthropic';
			mockPlugin.settings.llm.modelId = 'claude-3-5-haiku-20241022';

			// Save and unlock API key
			await llmService.saveApiKey(apiKey, testPassword);
			await llmService.unlock(testPassword);

			// Extract claims from simple text
			const text = 'Bitcoin is a cryptocurrency.';
			const claims = await llmService.extractClaims(text);

			// Verify claims were extracted
			expect(Array.isArray(claims)).toBe(true);
			expect(claims.length).toBeGreaterThan(0);

			// Verify claim structure
			const claim = claims[0];
			expect(claim).toHaveProperty('subject');
			expect(claim).toHaveProperty('predicate');
			expect(claim).toHaveProperty('object');
			expect(claim.confidence).toBeGreaterThan(0);
			expect(claim.confidence).toBeLessThanOrEqual(1);
		}, 30000); // 30 second timeout for LLM request

		it('should handle invalid API key gracefully', async () => {
			// Set provider to Anthropic
			mockPlugin.settings.llm.provider = 'anthropic';
			mockPlugin.settings.llm.modelId = 'claude-3-5-haiku-20241022';

			// Use invalid API key
			await llmService.saveApiKey('invalid-key', testPassword);
			await llmService.unlock(testPassword);

			const text = 'Test text';

			// Should return empty array on auth error (fallback behavior)
			const claims = await llmService.extractClaims(text);
			expect(claims).toEqual([]);
		}, 30000);
	});

	describe('OpenAI Provider', () => {
		it('should work with OpenAI provider', async () => {
			const apiKey = process.env.OPENAI_API_KEY;

			if (!apiKey) {
				console.warn('Skipping OpenAI test: OPENAI_API_KEY not set');
				return;
			}

			// Set provider to OpenAI
			mockPlugin.settings.llm.provider = 'openai';
			mockPlugin.settings.llm.modelId = 'gpt-4o-mini';

			// Save and unlock API key
			await llmService.saveApiKey(apiKey, testPassword);
			await llmService.unlock(testPassword);

			// Extract claims from simple text
			const text = 'The Earth orbits the Sun.';
			const claims = await llmService.extractClaims(text);

			// Verify claims were extracted
			expect(Array.isArray(claims)).toBe(true);
			expect(claims.length).toBeGreaterThan(0);
		}, 30000);
	});

	describe('Custom Fetch Usage', () => {
		it('should use Obsidian requestUrl instead of standard fetch', async () => {
			const apiKey = process.env.ANTHROPIC_API_KEY;

			if (!apiKey) {
				console.warn('Skipping requestUrl verification: ANTHROPIC_API_KEY not set');
				return;
			}

			let requestUrlCalled = false;

			// Override requestUrl to verify it's being called
			const originalRequestUrl = mockPlugin.app.vault.adapter.requestUrl;
			mockPlugin.app.vault.adapter.requestUrl = async (params: any) => {
				requestUrlCalled = true;
				return originalRequestUrl(params);
			};

			// Set provider to Anthropic
			mockPlugin.settings.llm.provider = 'anthropic';
			mockPlugin.settings.llm.modelId = 'claude-3-5-haiku-20241022';

			// Save and unlock API key
			await llmService.saveApiKey(apiKey, testPassword);
			await llmService.unlock(testPassword);

			// Make LLM request
			const text = 'Bitcoin is a cryptocurrency.';
			await llmService.extractClaims(text);

			// Verify that requestUrl was called (not standard fetch)
			expect(requestUrlCalled).toBe(true);
		}, 30000);
	});

	describe('Cost Tracking', () => {
		it('should track costs correctly with requestUrl', async () => {
			const apiKey = process.env.ANTHROPIC_API_KEY;

			if (!apiKey) {
				console.warn('Skipping cost tracking test: ANTHROPIC_API_KEY not set');
				return;
			}

			// Set provider to Anthropic
			mockPlugin.settings.llm.provider = 'anthropic';
			mockPlugin.settings.llm.modelId = 'claude-3-5-haiku-20241022';

			// Save and unlock API key
			await llmService.saveApiKey(apiKey, testPassword);
			await llmService.unlock(testPassword);

			// Get initial stats
			const initialStats = llmService.getUsageStats();

			// Make LLM request
			const text = 'Bitcoin is a cryptocurrency.';
			await llmService.extractClaims(text);

			// Get updated stats
			const updatedStats = llmService.getUsageStats();

			// Verify costs were tracked
			expect(updatedStats.totalSpent).toBeGreaterThan(initialStats.totalSpent);
			expect(updatedStats.requestCount).toBe(initialStats.requestCount + 1);
		}, 30000);
	});

	describe('Rate Limiting', () => {
		it('should respect rate limits with requestUrl', async () => {
			const apiKey = process.env.ANTHROPIC_API_KEY;

			if (!apiKey) {
				console.warn('Skipping rate limit test: ANTHROPIC_API_KEY not set');
				return;
			}

			// Set provider to Anthropic
			mockPlugin.settings.llm.provider = 'anthropic';
			mockPlugin.settings.llm.modelId = 'claude-3-5-haiku-20241022';

			// Save and unlock API key
			await llmService.saveApiKey(apiKey, testPassword);
			await llmService.unlock(testPassword);

			// Make multiple rapid requests
			const text = 'Test text.';
			const startTime = Date.now();

			await Promise.all([
				llmService.extractClaims(text),
				llmService.extractClaims(text),
				llmService.extractClaims(text),
			]);

			const elapsed = Date.now() - startTime;

			// Should take at least 2 seconds due to rate limiting (1s between requests)
			expect(elapsed).toBeGreaterThanOrEqual(2000);
		}, 60000); // 60 second timeout for multiple requests
	});
});
