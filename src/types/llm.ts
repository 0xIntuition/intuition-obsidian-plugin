/**
 * LLM (Large Language Model) types and configurations
 */

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'google';

export interface LLMModel {
	id: string;
	name: string;
	contextWindow: number;
	inputPricePerMillion: number;
	outputPricePerMillion: number;
	recommended?: boolean;
}

export interface LLMProviderConfig {
	id: LLMProvider;
	name: string;
	models: LLMModel[];
	requiresApiKey: boolean;
	baseUrl?: string;
	docsUrl: string;
}

export interface LLMUsageStats {
	totalRequests: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCostUSD: number;
	requestsByModel: Record<
		string,
		{
			requests: number;
			inputTokens: number;
			outputTokens: number;
			costUSD: number;
		}
	>;
	lastReset: number; // timestamp
}

export interface LLMCostEstimate {
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedCostUSD: number;
	modelId: string;
}

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderConfig> = {
	anthropic: {
		id: 'anthropic',
		name: 'Anthropic',
		models: [
			{
				id: 'claude-3-5-haiku-20241022',
				name: 'Claude 3.5 Haiku',
				contextWindow: 200000,
				inputPricePerMillion: 0.8,
				outputPricePerMillion: 4,
				recommended: true,
			},
			{
				id: 'claude-3-5-sonnet-20241022',
				name: 'Claude 3.5 Sonnet',
				contextWindow: 200000,
				inputPricePerMillion: 3,
				outputPricePerMillion: 15,
			},
		],
		requiresApiKey: true,
		docsUrl: 'https://console.anthropic.com/settings/keys',
	},
	openai: {
		id: 'openai',
		name: 'OpenAI',
		models: [
			{
				id: 'gpt-4o-mini',
				name: 'GPT-4o Mini',
				contextWindow: 128000,
				inputPricePerMillion: 0.15,
				outputPricePerMillion: 0.6,
				recommended: true,
			},
			{
				id: 'gpt-4o',
				name: 'GPT-4o',
				contextWindow: 128000,
				inputPricePerMillion: 2.5,
				outputPricePerMillion: 10,
			},
		],
		requiresApiKey: true,
		docsUrl: 'https://platform.openai.com/api-keys',
	},
	openrouter: {
		id: 'openrouter',
		name: 'OpenRouter',
		models: [
			{
				id: 'anthropic/claude-haiku-3.5',
				name: 'Claude Haiku 3.5',
				contextWindow: 200000,
				inputPricePerMillion: 0.8,
				outputPricePerMillion: 4,
				recommended: true,
			},
			{
				id: 'openai/gpt-4o-mini',
				name: 'GPT-4o Mini',
				contextWindow: 128000,
				inputPricePerMillion: 0.15,
				outputPricePerMillion: 0.6,
			},
		],
		requiresApiKey: true,
		baseUrl: 'https://openrouter.ai/api/v1',
		docsUrl: 'https://openrouter.ai/keys',
	},
	google: {
		id: 'google',
		name: 'Google AI',
		models: [
			{
				id: 'gemini-1.5-flash',
				name: 'Gemini 1.5 Flash',
				contextWindow: 1000000,
				inputPricePerMillion: 0.075,
				outputPricePerMillion: 0.3,
				recommended: true,
			},
			{
				id: 'gemini-1.5-pro',
				name: 'Gemini 1.5 Pro',
				contextWindow: 1000000,
				inputPricePerMillion: 1.25,
				outputPricePerMillion: 5,
			},
		],
		requiresApiKey: true,
		docsUrl: 'https://aistudio.google.com/apikey',
	},
};

/**
 * Zod schemas for LLM structured output
 */
import { z } from 'zod';

// Entity schema (subject/object)
export const EntitySchema = z.object({
	text: z.string(),
	type: z.enum([
		'person',
		'organization',
		'concept',
		'thing',
		'place',
		'event',
		'unknown',
	]),
	disambiguation: z.string().optional(),
	confidence: z.number().min(0).max(1),
});

// Predicate schema
export const PredicateSchema = z.object({
	text: z.string(),
	normalized: z.string(),
	alternatives: z.array(z.string()),
});

// Single claim schema
export const ExtractedClaimLLMSchema = z.object({
	subject: EntitySchema,
	predicate: PredicateSchema,
	object: EntitySchema,
	originalSentence: z.string(),
	confidence: z.number().min(0).max(1),
	reasoning: z.string(),
	suggestedImprovement: z.string().nullable().optional(),
	warnings: z.array(z.string()).optional(),
});

// Response schema with usage
export const ClaimExtractionSchema = z.object({
	claims: z.array(ExtractedClaimLLMSchema),
});

// TypeScript types derived from schemas
export type ExtractedClaimLLM = z.infer<typeof ExtractedClaimLLMSchema>;
export type EntityType = z.infer<typeof EntitySchema>['type'];
