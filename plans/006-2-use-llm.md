# Plan 006-2: LLM Integration for Intelligent Claim Processing

## Objective
Replace the regex-based claim extraction with LLM-powered natural language understanding, and enable new intelligent features that were previously impossible with pattern matching.

## Prerequisites
- Plan 004 (Intuition SDK Integration)
- Plan 006 (Claim Structuring Modal)

## Motivation

The current `ClaimParserService` uses regex patterns to extract Subject-Predicate-Object triples:

```typescript
// Current approach: brittle pattern matching
const patterns = [
  /^(.+?)\s+is\s+(?:a\s+)?(.+)$/i,    // "X is a Y"
  /^(.+?)\s+uses\s+(.+)$/i,            // "X uses Y"
  /^(.+?)\s+has\s+(.+)$/i,             // "X has Y"
];
```

**Limitations of current approach:**
- Only handles a few sentence patterns
- Cannot understand context or nuance
- No semantic understanding of entities
- Cannot disambiguate ("Apple" = company vs fruit?)
- Cannot suggest better phrasings
- Cannot handle complex or compound sentences
- No confidence calibration

**LLM benefits:**
- Natural language understanding of any sentence structure
- Semantic entity recognition and disambiguation
- Context-aware predicate suggestion
- Confidence scoring based on claim clarity
- Ability to rewrite/improve claim phrasing
- Multiple interpretation suggestions
- Batch processing of entire notes

## Technology Selection

### Library: Vercel AI SDK (`ai`)

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

**Why Vercel AI SDK:**
- Lightweight (~50KB)
- Unified API across providers
- First-class TypeScript support
- Streaming support built-in
- Active maintenance by Vercel
- Works in Node.js and browser environments

### Supported Providers (Priority Order)
1. **OpenAI** - GPT-4o, GPT-4o-mini
2. **Anthropic** - Claude Sonnet 4, Claude Haiku
3. **OpenRouter** - Access to 100+ models via single API
4. **Google** - Gemini Pro, Gemini Flash

## Deliverables

### Core Infrastructure
1. LLM Service abstraction layer
2. Provider configuration system
3. Settings UI for LLM configuration
4. Encrypted API key storage
5. Connection testing utility
6. Fallback behavior when offline

### LLM-Powered Features
1. **Intelligent Claim Extraction** - Replace regex with LLM
2. **Batch Note Analysis** - Scan entire vault/folder for potential claims
3. **Smart Predicate Suggestions** - Context-aware predicate recommendations
4. **Entity Disambiguation** - Resolve ambiguous entities to correct atoms
5. **Claim Validation & Improvement** - Suggest better claim phrasing
6. **Knowledge Graph Q&A** - Natural language queries about claims
7. **Relationship Discovery** - Find implicit connections between entities
8. **Auto-tagging** - Suggest relevant atoms for notes
9. **Summary Generation** - Summarize positions/consensus on topics
10. **Fact-checking Assistance** - Cross-reference claims with existing knowledge

## Files to Create/Modify

```
src/
  types/
    llm.ts                       # LLM configuration types
    settings.ts                  # Add LLMSettings (MODIFY)
  services/
    llm-service.ts               # Core LLM abstraction
    llm-claim-extractor.ts       # LLM-based claim extraction
    llm-entity-resolver.ts       # Entity disambiguation
    llm-batch-analyzer.ts        # Batch note analysis
    llm-knowledge-qa.ts          # Natural language Q&A
    claim-parser-service.ts      # Update to use LLM (MODIFY)
  ui/
    settings-tab.ts              # Add LLM settings section (MODIFY)
    components/
      llm-settings.ts            # LLM configuration component
      model-selector.ts          # Provider/model dropdown
      api-key-input.ts           # Secure API key input
    modals/
      batch-analysis-modal.ts    # Batch claim analysis UI
      knowledge-qa-modal.ts      # Natural language query UI
```

## Data Models

```typescript
// src/types/llm.ts

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'google';

export interface LLMProviderConfig {
  id: LLMProvider;
  name: string;
  models: LLMModel[];
  requiresApiKey: boolean;
  baseUrl?: string;        // For custom endpoints/proxies
  docsUrl: string;
}

export interface LLMModel {
  id: string;
  name: string;
  contextWindow: number;
  inputPricePerMillion: number;   // USD per 1M tokens
  outputPricePerMillion: number;
  recommended?: boolean;
}

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputPricePerMillion: 2.5, outputPricePerMillion: 10, recommended: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, inputPricePerMillion: 10, outputPricePerMillion: 30 },
    ],
    requiresApiKey: true,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, inputPricePerMillion: 3, outputPricePerMillion: 15, recommended: true },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', contextWindow: 200000, inputPricePerMillion: 0.8, outputPricePerMillion: 4 },
    ],
    requiresApiKey: true,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', contextWindow: 200000, inputPricePerMillion: 3, outputPricePerMillion: 15, recommended: true },
      { id: 'openai/gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputPricePerMillion: 2.5, outputPricePerMillion: 10 },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', contextWindow: 1000000, inputPricePerMillion: 1.25, outputPricePerMillion: 5 },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', contextWindow: 131072, inputPricePerMillion: 3, outputPricePerMillion: 3 },
    ],
    requiresApiKey: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/keys',
  },
  google: {
    id: 'google',
    name: 'Google AI',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, inputPricePerMillion: 1.25, outputPricePerMillion: 5, recommended: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPricePerMillion: 0.075, outputPricePerMillion: 0.3 },
    ],
    requiresApiKey: true,
    docsUrl: 'https://aistudio.google.com/apikey',
  },
};

// LLM Request/Response types
export interface LLMClaimExtractionRequest {
  text: string;
  context?: string;           // Surrounding text for context
  existingAtoms?: string[];   // Known atoms for disambiguation
}

export interface LLMClaimExtractionResponse {
  claims: ExtractedClaimLLM[];
  processingTime: number;
}

export interface ExtractedClaimLLM {
  subject: {
    text: string;
    type: 'person' | 'organization' | 'concept' | 'thing' | 'place' | 'event' | 'unknown';
    disambiguation?: string;    // e.g., "Apple Inc. (technology company)"
    confidence: number;
  };
  predicate: {
    text: string;
    normalized: string;         // Canonical form, e.g., "is a" -> "is"
    alternatives: string[];     // Other valid predicates
  };
  object: {
    text: string;
    type: 'person' | 'organization' | 'concept' | 'thing' | 'place' | 'event' | 'unknown';
    disambiguation?: string;
    confidence: number;
  };
  originalSentence: string;
  confidence: number;           // Overall claim confidence
  reasoning: string;            // Why this was extracted
  suggestedImprovement?: string; // Better phrasing if applicable
  warnings?: string[];          // Issues with the claim
}

// Batch analysis types
export interface BatchAnalysisRequest {
  files: string[];              // File paths to analyze
  maxClaimsPerFile?: number;
  includeExisting?: boolean;    // Include claims that already exist
}

export interface BatchAnalysisResult {
  fileResults: FileAnalysisResult[];
  totalClaims: number;
  newClaims: number;
  existingClaims: number;
}

export interface FileAnalysisResult {
  filePath: string;
  claims: ExtractedClaimLLM[];
  existingMatches: Array<{
    claim: ExtractedClaimLLM;
    matchedTripleId: string;
  }>;
}

// Knowledge Q&A types
export interface KnowledgeQARequest {
  question: string;
  context?: {
    currentFile?: string;
    recentAtoms?: string[];
  };
}

export interface KnowledgeQAResponse {
  answer: string;
  relevantClaims: Array<{
    tripleId: string;
    subject: string;
    predicate: string;
    object: string;
    consensus: number;
  }>;
  suggestedFollowups: string[];
  confidence: number;
}
```

### Settings Extension

```typescript
// Add to src/types/settings.ts

export interface LLMSettings {
  enabled: boolean;
  provider: LLMProvider;
  modelId: string;

  // Encrypted API key (same pattern as wallet)
  encryptedApiKey: string | null;
  encryptionSalt: string | null;

  // Custom endpoint for proxies/corporate setups
  customBaseUrl: string | null;

  // Feature flags for individual LLM features
  features: {
    claimExtraction: boolean;      // Use LLM for claim parsing
    entityDisambiguation: boolean; // Resolve ambiguous entities
    predicateSuggestion: boolean;  // Suggest predicates
    batchAnalysis: boolean;        // Enable batch note scanning
    knowledgeQA: boolean;          // Natural language queries
    claimImprovement: boolean;     // Suggest better phrasings
    autoTagging: boolean;          // Suggest atoms for notes
    relationshipDiscovery: boolean; // Find implicit connections
    summaryGeneration: boolean;    // Summarize consensus
    factChecking: boolean;         // Cross-reference claims
  };
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  enabled: false,
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  encryptedApiKey: null,
  encryptionSalt: null,
  customBaseUrl: null,
  features: {
    claimExtraction: true,
    entityDisambiguation: true,
    predicateSuggestion: true,
    batchAnalysis: true,
    knowledgeQA: true,
    claimImprovement: true,
    autoTagging: true,
    relationshipDiscovery: true,
    summaryGeneration: true,
    factChecking: true,
  },
};

// Update IntuitionPluginSettings
export interface IntuitionPluginSettings {
  // ... existing fields ...

  // LLM Configuration (NEW)
  llm: LLMSettings;
}
```

## Implementation

### LLM Service (src/services/llm-service.ts)

```typescript
import { generateText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import IntuitionPlugin from '../main';
import { LLMProvider, LLM_PROVIDERS, LLMSettings } from '../types/llm';
import { CryptoService } from './crypto-service';

export class LLMService {
  private plugin: IntuitionPlugin;
  private cryptoService: CryptoService;
  private decryptedApiKey: string | null = null;
  private client: ReturnType<typeof createOpenAI> | ReturnType<typeof createAnthropic> | ReturnType<typeof createGoogleGenerativeAI> | null = null;

  constructor(plugin: IntuitionPlugin, cryptoService: CryptoService) {
    this.plugin = plugin;
    this.cryptoService = cryptoService;
  }

  /**
   * Check if LLM is available and configured
   */
  isAvailable(): boolean {
    const settings = this.plugin.settings.llm;
    return (
      settings.enabled &&
      settings.encryptedApiKey !== null &&
      settings.modelId !== null
    );
  }

  /**
   * Initialize the LLM client with decrypted API key
   */
  async initialize(password: string): Promise<boolean> {
    const settings = this.plugin.settings.llm;

    if (!settings.encryptedApiKey || !settings.encryptionSalt) {
      return false;
    }

    try {
      this.decryptedApiKey = await this.cryptoService.decrypt(
        settings.encryptedApiKey,
        password,
        settings.encryptionSalt
      );

      this.client = this.createClient(settings.provider, this.decryptedApiKey, settings.customBaseUrl);
      return true;
    } catch (error) {
      console.error('Failed to initialize LLM service:', error);
      return false;
    }
  }

  /**
   * Create provider-specific client
   */
  private createClient(
    provider: LLMProvider,
    apiKey: string,
    customBaseUrl: string | null
  ) {
    const baseURL = customBaseUrl || LLM_PROVIDERS[provider].baseUrl;

    switch (provider) {
      case 'openai':
        return createOpenAI({ apiKey, baseURL });
      case 'anthropic':
        return createAnthropic({ apiKey, baseURL });
      case 'openrouter':
        // OpenRouter uses OpenAI-compatible API
        return createOpenAI({
          apiKey,
          baseURL: baseURL || 'https://openrouter.ai/api/v1',
          headers: {
            'HTTP-Referer': 'https://obsidian.md',
            'X-Title': 'Intuition Obsidian Plugin',
          },
        });
      case 'google':
        return createGoogleGenerativeAI({ apiKey, baseURL });
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get the model identifier for the current provider
   */
  private getModelId(): string {
    return this.plugin.settings.llm.modelId;
  }

  /**
   * Test connection to the LLM provider
   */
  async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    if (!this.client) {
      return { success: false, message: 'LLM service not initialized' };
    }

    const startTime = Date.now();

    try {
      const { text } = await generateText({
        model: this.client(this.getModelId()),
        prompt: 'Respond with exactly: "OK"',
        maxTokens: 10,
      });

      const latencyMs = Date.now() - startTime;
      const success = text.trim().toLowerCase().includes('ok');

      return {
        success,
        message: success ? 'Connection successful' : 'Unexpected response',
        latencyMs,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract claims from text using LLM
   */
  async extractClaims(text: string, context?: string): Promise<ExtractedClaimLLM[]> {
    if (!this.client || !this.plugin.settings.llm.features.claimExtraction) {
      return [];
    }

    const ClaimSchema = z.object({
      claims: z.array(z.object({
        subject: z.object({
          text: z.string(),
          type: z.enum(['person', 'organization', 'concept', 'thing', 'place', 'event', 'unknown']),
          disambiguation: z.string().optional(),
          confidence: z.number().min(0).max(1),
        }),
        predicate: z.object({
          text: z.string(),
          normalized: z.string(),
          alternatives: z.array(z.string()),
        }),
        object: z.object({
          text: z.string(),
          type: z.enum(['person', 'organization', 'concept', 'thing', 'place', 'event', 'unknown']),
          disambiguation: z.string().optional(),
          confidence: z.number().min(0).max(1),
        }),
        originalSentence: z.string(),
        confidence: z.number().min(0).max(1),
        reasoning: z.string(),
        suggestedImprovement: z.string().optional(),
        warnings: z.array(z.string()).optional(),
      })),
    });

    try {
      const { object } = await generateObject({
        model: this.client(this.getModelId()),
        schema: ClaimSchema,
        prompt: this.buildClaimExtractionPrompt(text, context),
      });

      return object.claims;
    } catch (error) {
      console.error('Claim extraction failed:', error);
      return [];
    }
  }

  private buildClaimExtractionPrompt(text: string, context?: string): string {
    return `You are an expert at extracting factual claims from text and structuring them as Subject-Predicate-Object triples for a knowledge graph.

TASK: Analyze the following text and extract all factual claims that can be represented as triples.

TEXT TO ANALYZE:
"""
${text}
"""

${context ? `CONTEXT (surrounding text for reference):\n"""\n${context}\n"""` : ''}

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
   * Disambiguate an entity to find the best matching atom
   */
  async disambiguateEntity(
    entityText: string,
    context: string,
    candidateAtoms: Array<{ id: string; label: string; description?: string }>
  ): Promise<{ atomId: string; confidence: number; reasoning: string } | null> {
    if (!this.client || !this.plugin.settings.llm.features.entityDisambiguation) {
      return null;
    }

    const DisambiguationSchema = z.object({
      selectedAtomId: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
      isNewEntity: z.boolean(),
    });

    try {
      const { object } = await generateObject({
        model: this.client(this.getModelId()),
        schema: DisambiguationSchema,
        prompt: `You are helping to disambiguate an entity mention to the correct entry in a knowledge graph.

ENTITY MENTION: "${entityText}"

CONTEXT: "${context}"

CANDIDATE ATOMS IN KNOWLEDGE GRAPH:
${candidateAtoms.map((a, i) => `${i + 1}. ID: ${a.id}, Label: "${a.label}"${a.description ? `, Description: ${a.description}` : ''}`).join('\n')}

TASK: Determine which atom (if any) best matches this entity mention given the context.

If none of the candidates match, set selectedAtomId to null and isNewEntity to true.
Explain your reasoning.`,
      });

      if (object.selectedAtomId) {
        return {
          atomId: object.selectedAtomId,
          confidence: object.confidence,
          reasoning: object.reasoning,
        };
      }
      return null;
    } catch (error) {
      console.error('Entity disambiguation failed:', error);
      return null;
    }
  }

  /**
   * Suggest predicates based on subject and object
   */
  async suggestPredicates(
    subject: string,
    object: string,
    context?: string
  ): Promise<Array<{ predicate: string; confidence: number; reasoning: string }>> {
    if (!this.client || !this.plugin.settings.llm.features.predicateSuggestion) {
      return [];
    }

    const PredicateSchema = z.object({
      suggestions: z.array(z.object({
        predicate: z.string(),
        confidence: z.number().min(0).max(1),
        reasoning: z.string(),
      })),
    });

    try {
      const { object: result } = await generateObject({
        model: this.client(this.getModelId()),
        schema: PredicateSchema,
        prompt: `Given a Subject and Object, suggest the most appropriate predicates to connect them in a knowledge graph.

SUBJECT: "${subject}"
OBJECT: "${object}"
${context ? `CONTEXT: "${context}"` : ''}

Suggest 3-5 predicates that would make sense to connect these entities. Use common, canonical predicates like:
- is (for identity/classification)
- has (for possession/attributes)
- uses (for tools/methods)
- created (for creation relationships)
- founded (for organizational founding)
- works for (for employment)
- located in (for geographic relationships)
- part of (for composition)

Order by likelihood and provide reasoning for each.`,
      });

      return result.suggestions;
    } catch (error) {
      console.error('Predicate suggestion failed:', error);
      return [];
    }
  }

  /**
   * Improve a claim's phrasing
   */
  async improveClaim(
    subject: string,
    predicate: string,
    object: string,
    originalText?: string
  ): Promise<{ improved: { subject: string; predicate: string; object: string }; explanation: string } | null> {
    if (!this.client || !this.plugin.settings.llm.features.claimImprovement) {
      return null;
    }

    const ImprovementSchema = z.object({
      improved: z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.string(),
      }),
      explanation: z.string(),
      isChanged: z.boolean(),
    });

    try {
      const { object: result } = await generateObject({
        model: this.client(this.getModelId()),
        schema: ImprovementSchema,
        prompt: `Review this knowledge graph triple and suggest improvements for clarity and canonicalization.

CURRENT TRIPLE:
- Subject: "${subject}"
- Predicate: "${predicate}"
- Object: "${object}"
${originalText ? `\nORIGINAL TEXT: "${originalText}"` : ''}

IMPROVEMENT GUIDELINES:
1. Make entities more specific and unambiguous
2. Use canonical predicate forms
3. Remove unnecessary words
4. Ensure the claim is verifiable
5. Keep the semantic meaning intact

If the triple is already good, return it unchanged with isChanged: false.`,
      });

      return result.isChanged ? { improved: result.improved, explanation: result.explanation } : null;
    } catch (error) {
      console.error('Claim improvement failed:', error);
      return null;
    }
  }

  /**
   * Answer natural language questions about the knowledge graph
   */
  async answerQuestion(
    question: string,
    relevantTriples: Array<{ subject: string; predicate: string; object: string; consensus: number }>
  ): Promise<KnowledgeQAResponse | null> {
    if (!this.client || !this.plugin.settings.llm.features.knowledgeQA) {
      return null;
    }

    const QASchema = z.object({
      answer: z.string(),
      relevantClaimIndices: z.array(z.number()),
      suggestedFollowups: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    });

    try {
      const { object } = await generateObject({
        model: this.client(this.getModelId()),
        schema: QASchema,
        prompt: `Answer a question based on knowledge graph data.

QUESTION: "${question}"

AVAILABLE CLAIMS (with consensus percentages):
${relevantTriples.map((t, i) => `${i + 1}. "${t.subject}" ${t.predicate} "${t.object}" (${t.consensus}% consensus)`).join('\n')}

TASK:
1. Answer the question based on the available claims
2. Indicate which claims you used (by index)
3. Suggest 2-3 follow-up questions the user might want to ask
4. Provide a confidence score based on how well the claims answer the question

If the claims don't contain enough information to answer, say so clearly.`,
      });

      return {
        answer: object.answer,
        relevantClaims: object.relevantClaimIndices.map(i => ({
          tripleId: `${i}`, // Will be mapped to actual IDs by caller
          ...relevantTriples[i],
        })),
        suggestedFollowups: object.suggestedFollowups,
        confidence: object.confidence,
      };
    } catch (error) {
      console.error('Knowledge Q&A failed:', error);
      return null;
    }
  }

  /**
   * Discover implicit relationships between entities
   */
  async discoverRelationships(
    entities: string[],
    existingTriples: Array<{ subject: string; predicate: string; object: string }>
  ): Promise<Array<{ subject: string; predicate: string; object: string; reasoning: string; confidence: number }>> {
    if (!this.client || !this.plugin.settings.llm.features.relationshipDiscovery) {
      return [];
    }

    const DiscoverySchema = z.object({
      discoveries: z.array(z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.string(),
        reasoning: z.string(),
        confidence: z.number().min(0).max(1),
      })),
    });

    try {
      const { object } = await generateObject({
        model: this.client(this.getModelId()),
        schema: DiscoverySchema,
        prompt: `Based on existing knowledge, discover implicit relationships between entities.

ENTITIES TO ANALYZE:
${entities.map((e, i) => `${i + 1}. ${e}`).join('\n')}

EXISTING RELATIONSHIPS:
${existingTriples.map(t => `- "${t.subject}" ${t.predicate} "${t.object}"`).join('\n')}

TASK: Identify implicit or transitive relationships that could be inferred from the existing knowledge.
Only suggest relationships that are highly likely to be true based on the existing data.
Do not suggest relationships that are already explicitly stated.`,
      });

      return object.discoveries;
    } catch (error) {
      console.error('Relationship discovery failed:', error);
      return [];
    }
  }

  /**
   * Suggest atoms/tags for a note
   */
  async suggestTags(
    noteContent: string,
    existingAtoms: Array<{ id: string; label: string }>
  ): Promise<Array<{ atomId: string; label: string; relevance: number; reasoning: string }>> {
    if (!this.client || !this.plugin.settings.llm.features.autoTagging) {
      return [];
    }

    const TagSchema = z.object({
      suggestions: z.array(z.object({
        atomId: z.string(),
        label: z.string(),
        relevance: z.number().min(0).max(1),
        reasoning: z.string(),
      })),
    });

    try {
      const { object } = await generateObject({
        model: this.client(this.getModelId()),
        schema: TagSchema,
        prompt: `Suggest relevant atoms to tag this note with.

NOTE CONTENT:
"""
${noteContent.substring(0, 2000)}
"""

AVAILABLE ATOMS:
${existingAtoms.slice(0, 50).map(a => `- ${a.id}: "${a.label}"`).join('\n')}

TASK: Identify which atoms are most relevant to tag this note with.
Order by relevance and explain why each atom is relevant.
Only suggest atoms that are genuinely relevant to the content.`,
      });

      return object.suggestions;
    } catch (error) {
      console.error('Auto-tagging failed:', error);
      return [];
    }
  }

  /**
   * Generate a summary of consensus on a topic
   */
  async summarizeConsensus(
    topic: string,
    relatedTriples: Array<{ subject: string; predicate: string; object: string; forPercent: number; totalStake: number }>
  ): Promise<{ summary: string; keyPoints: string[]; controversies: string[] } | null> {
    if (!this.client || !this.plugin.settings.llm.features.summaryGeneration) {
      return null;
    }

    const SummarySchema = z.object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
      controversies: z.array(z.string()),
    });

    try {
      const { object } = await generateObject({
        model: this.client(this.getModelId()),
        schema: SummarySchema,
        prompt: `Summarize the community consensus on a topic based on staked claims.

TOPIC: "${topic}"

RELATED CLAIMS (with consensus data):
${relatedTriples.map(t => `- "${t.subject}" ${t.predicate} "${t.object}" | ${t.forPercent}% agree | ${t.totalStake} staked`).join('\n')}

TASK:
1. Write a brief summary of what the community believes about this topic
2. List key points of agreement (claims with high consensus)
3. List any controversies (claims with mixed or negative consensus)`,
      });

      return object;
    } catch (error) {
      console.error('Consensus summary failed:', error);
      return null;
    }
  }

  /**
   * Fact-check a claim against existing knowledge
   */
  async factCheck(
    claim: { subject: string; predicate: string; object: string },
    relatedTriples: Array<{ subject: string; predicate: string; object: string; consensus: number }>
  ): Promise<{ verdict: 'supported' | 'contradicted' | 'unverifiable' | 'partially-supported'; explanation: string; supportingClaims: number[]; contradictingClaims: number[] } | null> {
    if (!this.client || !this.plugin.settings.llm.features.factChecking) {
      return null;
    }

    const FactCheckSchema = z.object({
      verdict: z.enum(['supported', 'contradicted', 'unverifiable', 'partially-supported']),
      explanation: z.string(),
      supportingClaims: z.array(z.number()),
      contradictingClaims: z.array(z.number()),
    });

    try {
      const { object } = await generateObject({
        model: this.client(this.getModelId()),
        schema: FactCheckSchema,
        prompt: `Fact-check a claim against existing knowledge graph data.

CLAIM TO CHECK:
"${claim.subject}" ${claim.predicate} "${claim.object}"

EXISTING KNOWLEDGE (with consensus percentages):
${relatedTriples.map((t, i) => `${i + 1}. "${t.subject}" ${t.predicate} "${t.object}" (${t.consensus}% consensus)`).join('\n')}

TASK:
1. Determine if the claim is supported, contradicted, unverifiable, or partially-supported
2. Explain your reasoning
3. List which existing claims support or contradict this claim (by index)`,
      });

      return object;
    } catch (error) {
      console.error('Fact-checking failed:', error);
      return null;
    }
  }

  /**
   * Lock the service (clear decrypted key)
   */
  lock(): void {
    this.decryptedApiKey = null;
    this.client = null;
  }
}
```

### Settings UI Component (src/ui/components/llm-settings.ts)

```typescript
import { Setting } from 'obsidian';
import IntuitionPlugin from '../../main';
import { LLM_PROVIDERS, LLMProvider } from '../../types/llm';

export class LLMSettingsComponent {
  private plugin: IntuitionPlugin;
  private containerEl: HTMLElement;
  private testResultEl: HTMLElement | null = null;

  constructor(plugin: IntuitionPlugin, containerEl: HTMLElement) {
    this.plugin = plugin;
    this.containerEl = containerEl;
  }

  render(): void {
    const { containerEl } = this;

    // Section header
    containerEl.createEl('h3', { text: 'AI/LLM Configuration' });
    containerEl.createEl('p', {
      text: 'Configure AI-powered features for intelligent claim extraction and analysis.',
      cls: 'setting-item-description',
    });

    // Enable toggle
    new Setting(containerEl)
      .setName('Enable AI features')
      .setDesc('Use AI for claim extraction, entity disambiguation, and other intelligent features')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.llm.enabled)
        .onChange(async (value) => {
          this.plugin.settings.llm.enabled = value;
          await this.plugin.saveSettings();
          this.render(); // Re-render to show/hide dependent settings
        }));

    if (!this.plugin.settings.llm.enabled) {
      return; // Don't show other settings if disabled
    }

    // Provider selection
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select your AI provider')
      .addDropdown(dropdown => {
        for (const [id, config] of Object.entries(LLM_PROVIDERS)) {
          dropdown.addOption(id, config.name);
        }
        dropdown
          .setValue(this.plugin.settings.llm.provider)
          .onChange(async (value: LLMProvider) => {
            this.plugin.settings.llm.provider = value;
            // Reset model to first available for new provider
            this.plugin.settings.llm.modelId = LLM_PROVIDERS[value].models[0].id;
            await this.plugin.saveSettings();
            this.render();
          });
      });

    // Model selection
    const providerConfig = LLM_PROVIDERS[this.plugin.settings.llm.provider];
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select the AI model to use')
      .addDropdown(dropdown => {
        for (const model of providerConfig.models) {
          const label = model.recommended ? `${model.name} (recommended)` : model.name;
          dropdown.addOption(model.id, label);
        }
        dropdown
          .setValue(this.plugin.settings.llm.modelId)
          .onChange(async (value) => {
            this.plugin.settings.llm.modelId = value;
            await this.plugin.saveSettings();
          });
      });

    // API Key input
    const apiKeySetting = new Setting(containerEl)
      .setName('API Key')
      .setDesc(`Your ${providerConfig.name} API key (encrypted and stored locally)`)
      .addText(text => text
        .setPlaceholder('Enter API key...')
        .inputEl.type = 'password')
      .addButton(btn => btn
        .setButtonText('Save Key')
        .onClick(async () => {
          const input = apiKeySetting.controlEl.querySelector('input');
          if (input && input.value) {
            await this.saveApiKey(input.value);
            input.value = '';
          }
        }));

    // Link to get API key
    const linkEl = containerEl.createEl('p', { cls: 'setting-item-description' });
    linkEl.createEl('a', {
      text: `Get your ${providerConfig.name} API key`,
      href: providerConfig.docsUrl,
    });

    // API key status
    const hasKey = this.plugin.settings.llm.encryptedApiKey !== null;
    new Setting(containerEl)
      .setName('API Key Status')
      .setDesc(hasKey ? 'API key is configured and encrypted' : 'No API key configured')
      .addButton(btn => btn
        .setButtonText(hasKey ? 'Remove Key' : 'No Key')
        .setDisabled(!hasKey)
        .onClick(async () => {
          if (hasKey) {
            this.plugin.settings.llm.encryptedApiKey = null;
            this.plugin.settings.llm.encryptionSalt = null;
            await this.plugin.saveSettings();
            this.render();
          }
        }));

    // Custom endpoint (for proxies/corporate)
    new Setting(containerEl)
      .setName('Custom API Endpoint')
      .setDesc('Override the default API URL (for proxies or corporate setups)')
      .addText(text => text
        .setPlaceholder('https://api.example.com/v1')
        .setValue(this.plugin.settings.llm.customBaseUrl || '')
        .onChange(async (value) => {
          this.plugin.settings.llm.customBaseUrl = value || null;
          await this.plugin.saveSettings();
        }));

    // Test connection button
    const testSetting = new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Verify your API key and connection')
      .addButton(btn => btn
        .setButtonText('Test')
        .onClick(() => this.testConnection()));

    this.testResultEl = testSetting.descEl.createDiv({ cls: 'llm-test-result' });

    // Feature toggles section
    containerEl.createEl('h4', { text: 'AI Feature Toggles' });

    const featureToggles: Array<{ key: keyof typeof this.plugin.settings.llm.features; name: string; desc: string }> = [
      { key: 'claimExtraction', name: 'Claim Extraction', desc: 'Use AI to extract claims from text (replaces regex patterns)' },
      { key: 'entityDisambiguation', name: 'Entity Disambiguation', desc: 'AI resolves ambiguous entities (e.g., "Apple" -> company vs fruit)' },
      { key: 'predicateSuggestion', name: 'Predicate Suggestions', desc: 'AI suggests appropriate predicates based on context' },
      { key: 'batchAnalysis', name: 'Batch Note Analysis', desc: 'Scan entire vault/folder for potential claims' },
      { key: 'knowledgeQA', name: 'Knowledge Q&A', desc: 'Answer natural language questions about your knowledge graph' },
      { key: 'claimImprovement', name: 'Claim Improvement', desc: 'AI suggests better phrasing for claims' },
      { key: 'autoTagging', name: 'Auto-tagging', desc: 'Suggest relevant atoms for notes' },
      { key: 'relationshipDiscovery', name: 'Relationship Discovery', desc: 'Find implicit connections between entities' },
      { key: 'summaryGeneration', name: 'Summary Generation', desc: 'Summarize consensus on topics' },
      { key: 'factChecking', name: 'Fact-checking', desc: 'Cross-reference claims with existing knowledge' },
    ];

    for (const { key, name, desc } of featureToggles) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.llm.features[key])
          .onChange(async (value) => {
            this.plugin.settings.llm.features[key] = value;
            await this.plugin.saveSettings();
          }));
    }
  }

  private async saveApiKey(apiKey: string): Promise<void> {
    try {
      // Generate salt
      const salt = crypto.randomUUID();

      // For now, use a fixed password - in production, prompt user
      // This matches the wallet encryption pattern
      const password = await this.promptForPassword('Enter a password to encrypt your API key:');
      if (!password) return;

      const encrypted = await this.plugin.cryptoService.encrypt(apiKey, password, salt);

      this.plugin.settings.llm.encryptedApiKey = encrypted;
      this.plugin.settings.llm.encryptionSalt = salt;
      await this.plugin.saveSettings();

      this.plugin.noticeManager.success('API key saved and encrypted');
      this.render();
    } catch (error) {
      this.plugin.noticeManager.error('Failed to save API key');
    }
  }

  private async promptForPassword(message: string): Promise<string | null> {
    // This would use a modal in the actual implementation
    return prompt(message);
  }

  private async testConnection(): Promise<void> {
    if (!this.testResultEl) return;

    this.testResultEl.empty();
    this.testResultEl.createSpan({ text: 'Testing...', cls: 'llm-test-pending' });

    try {
      // Prompt for password to decrypt API key
      const password = await this.promptForPassword('Enter your encryption password:');
      if (!password) {
        this.testResultEl.empty();
        return;
      }

      await this.plugin.llmService.initialize(password);
      const result = await this.plugin.llmService.testConnection();

      this.testResultEl.empty();
      if (result.success) {
        this.testResultEl.createSpan({
          text: `Connected (${result.latencyMs}ms)`,
          cls: 'llm-test-success',
        });
      } else {
        this.testResultEl.createSpan({
          text: `Failed: ${result.message}`,
          cls: 'llm-test-error',
        });
      }
    } catch (error) {
      this.testResultEl.empty();
      this.testResultEl.createSpan({
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cls: 'llm-test-error',
      });
    }
  }
}
```

## CSS Styles (add to styles.css)

```css
/* LLM Settings */
.llm-test-result {
  margin-top: 8px;
  font-size: 12px;
}

.llm-test-pending {
  color: var(--text-muted);
}

.llm-test-success {
  color: var(--text-success);
}

.llm-test-error {
  color: var(--text-error);
}

/* LLM-powered indicators */
.claim-llm-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--background-modifier-message);
}

.claim-llm-badge.high-confidence {
  background: rgba(34, 197, 94, 0.1);
  color: var(--text-success);
}

.claim-llm-badge.medium-confidence {
  background: rgba(234, 179, 8, 0.1);
  color: var(--text-warning);
}

.claim-llm-badge.low-confidence {
  background: rgba(239, 68, 68, 0.1);
  color: var(--text-error);
}

/* Disambiguation suggestions */
.disambiguation-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.disambiguation-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--background-secondary);
  cursor: pointer;
  transition: background 0.15s ease;
}

.disambiguation-option:hover {
  background: var(--background-modifier-hover);
}

.disambiguation-option.selected {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

/* Batch analysis modal */
.batch-analysis-progress {
  margin: 16px 0;
}

.batch-analysis-progress-bar {
  height: 8px;
  background: var(--background-modifier-border);
  border-radius: 4px;
  overflow: hidden;
}

.batch-analysis-progress-fill {
  height: 100%;
  background: var(--interactive-accent);
  transition: width 0.3s ease;
}

.batch-analysis-results {
  max-height: 400px;
  overflow-y: auto;
}

.batch-analysis-file {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 4px;
  background: var(--background-secondary);
}

.batch-analysis-file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
}

.batch-analysis-claim {
  padding: 8px;
  margin: 4px 0;
  border-radius: 4px;
  background: var(--background-primary);
  font-size: 13px;
}
```

## Integration with Existing Services

### Update ClaimParserService

The existing `ClaimParserService` will be updated to optionally use LLM:

```typescript
// In claim-parser-service.ts

export class ClaimParserService {
  private plugin: IntuitionPlugin;
  private llmService: LLMService | null = null;

  constructor(plugin: IntuitionPlugin) {
    this.plugin = plugin;
    if (plugin.llmService) {
      this.llmService = plugin.llmService;
    }
  }

  async extractTriple(text: string): Promise<TripleSuggestion | null> {
    // Try LLM first if available and enabled
    if (this.llmService?.isAvailable() && this.plugin.settings.llm.features.claimExtraction) {
      const llmResults = await this.llmService.extractClaims(text);
      if (llmResults.length > 0) {
        return this.convertLLMResult(llmResults[0]);
      }
    }

    // Fall back to regex patterns
    return this.extractTripleRegex(text);
  }

  private convertLLMResult(llmClaim: ExtractedClaimLLM): TripleSuggestion {
    return {
      subject: llmClaim.subject.text,
      predicate: llmClaim.predicate.normalized,
      object: llmClaim.object.text,
      confidence: llmClaim.confidence,
      pattern: 'llm' as ExtractionPattern,
    };
  }

  private extractTripleRegex(text: string): TripleSuggestion | null {
    // Existing regex implementation...
  }
}
```

## Offline/Unavailable Behavior

When LLM is unavailable (no API key, network error, or disabled):

1. **Feature Toggle**: All LLM features show as disabled in UI
2. **Graceful Degradation**: `ClaimParserService` falls back to regex patterns
3. **Clear Messaging**: Settings show "AI features require API key configuration"
4. **No Blocking**: Core plugin functionality works without LLM

```typescript
// In LLMService
isAvailable(): boolean {
  // Check if enabled and configured
  if (!this.plugin.settings.llm.enabled) return false;
  if (!this.plugin.settings.llm.encryptedApiKey) return false;
  if (!this.client) return false;
  return true;
}
```

## Dependencies

```json
{
  "dependencies": {
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.40",
    "@ai-sdk/anthropic": "^0.0.40",
    "@ai-sdk/google": "^0.0.40",
    "zod": "^3.22.0"
  }
}
```

## Cost Management & Usage Tracking

### Overview
LLM API calls can incur significant costs. This section outlines the cost management strategy to prevent unexpected expenses and provide transparency to users.

### Cost Tracking Implementation

```typescript
// Add to src/types/llm.ts

export interface LLMUsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  requestsByModel: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  }>;
  lastReset: number; // timestamp
}

export interface LLMCostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
  modelId: string;
}

// Add to LLMSettings
export interface LLMSettings {
  // ... existing fields ...

  // Cost management
  costManagement: {
    monthlyBudgetUSD: number | null;     // null = unlimited
    warningThresholdPercent: number;     // Warn at X% of budget
    requireConfirmation: boolean;         // Confirm before expensive operations
    trackUsage: boolean;                  // Track token usage and costs
  };

  // Usage stats (reset monthly)
  usageStats: LLMUsageStats;
}
```

### Budget Limits & Warnings

```typescript
// Add to src/services/llm-service.ts

export class LLMService {
  // ... existing code ...

  /**
   * Check if operation is within budget
   */
  private async checkBudget(estimatedCostUSD: number): Promise<boolean> {
    const { costManagement, usageStats } = this.plugin.settings.llm;

    if (!costManagement.trackUsage || !costManagement.monthlyBudgetUSD) {
      return true; // No budget limit
    }

    const projectedTotal = usageStats.totalCostUSD + estimatedCostUSD;
    const budgetPercent = (projectedTotal / costManagement.monthlyBudgetUSD) * 100;

    // Hard stop at 100%
    if (projectedTotal > costManagement.monthlyBudgetUSD) {
      this.plugin.noticeManager.error(
        `Monthly budget exceeded ($${costManagement.monthlyBudgetUSD}). ` +
        `Current usage: $${usageStats.totalCostUSD.toFixed(2)}`
      );
      return false;
    }

    // Warning at threshold
    if (budgetPercent >= costManagement.warningThresholdPercent) {
      const proceed = await this.plugin.confirmAction(
        `Budget Warning`,
        `You've used ${budgetPercent.toFixed(0)}% of your monthly budget. ` +
        `This operation will cost ~$${estimatedCostUSD.toFixed(4)}. Continue?`
      );
      return proceed;
    }

    return true;
  }

  /**
   * Estimate cost for a text operation
   */
  estimateCost(
    inputText: string,
    expectedOutputTokens: number = 500
  ): LLMCostEstimate {
    const modelId = this.getModelId();
    const provider = this.plugin.settings.llm.provider;
    const model = LLM_PROVIDERS[provider].models.find(m => m.id === modelId);

    if (!model) {
      return {
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedCostUSD: 0,
        modelId,
      };
    }

    // Rough token estimation: 1 token ≈ 4 characters
    const estimatedInputTokens = Math.ceil(inputText.length / 4);
    const estimatedOutputTokens = expectedOutputTokens;

    const inputCost = (estimatedInputTokens / 1_000_000) * model.inputPricePerMillion;
    const outputCost = (estimatedOutputTokens / 1_000_000) * model.outputPricePerMillion;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUSD: inputCost + outputCost,
      modelId,
    };
  }

  /**
   * Track token usage and cost
   */
  private async trackUsage(
    modelId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    const { costManagement, usageStats } = this.plugin.settings.llm;

    if (!costManagement.trackUsage) return;

    const provider = this.plugin.settings.llm.provider;
    const model = LLM_PROVIDERS[provider].models.find(m => m.id === modelId);

    if (!model) return;

    const inputCost = (inputTokens / 1_000_000) * model.inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
    const totalCost = inputCost + outputCost;

    // Update total stats
    usageStats.totalRequests++;
    usageStats.totalInputTokens += inputTokens;
    usageStats.totalOutputTokens += outputTokens;
    usageStats.totalCostUSD += totalCost;

    // Update per-model stats
    if (!usageStats.requestsByModel[modelId]) {
      usageStats.requestsByModel[modelId] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
      };
    }

    const modelStats = usageStats.requestsByModel[modelId];
    modelStats.requests++;
    modelStats.inputTokens += inputTokens;
    modelStats.outputTokens += outputTokens;
    modelStats.costUSD += totalCost;

    await this.plugin.saveSettings();
  }

  /**
   * Reset usage stats (called monthly)
   */
  resetUsageStats(): void {
    this.plugin.settings.llm.usageStats = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      requestsByModel: {},
      lastReset: Date.now(),
    };
  }

  /**
   * Check if usage stats should be reset (monthly)
   */
  checkAndResetUsageStats(): void {
    const { usageStats } = this.plugin.settings.llm;
    const lastReset = new Date(usageStats.lastReset);
    const now = new Date();

    // Reset if it's a new month
    if (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      this.resetUsageStats();
    }
  }
}
```

### Update extractClaims with Cost Tracking

```typescript
// Modified extractClaims method in LLMService

async extractClaims(text: string, context?: string): Promise<ExtractedClaimLLM[]> {
  if (!this.client || !this.plugin.settings.llm.features.claimExtraction) {
    return [];
  }

  // Check monthly reset
  this.checkAndResetUsageStats();

  // Estimate cost
  const estimate = this.estimateCost(text + (context || ''), 1000);

  // Check budget
  const allowed = await this.checkBudget(estimate.estimatedCostUSD);
  if (!allowed) {
    return [];
  }

  const ClaimSchema = z.object({
    // ... existing schema ...
  });

  try {
    const { object, usage } = await generateObject({
      model: this.client(this.getModelId()),
      schema: ClaimSchema,
      prompt: this.buildClaimExtractionPrompt(text, context),
    });

    // Track actual usage if available
    if (usage) {
      await this.trackUsage(
        this.getModelId(),
        usage.promptTokens,
        usage.completionTokens
      );
    }

    return object.claims;
  } catch (error) {
    console.error('Claim extraction failed:', error);
    return [];
  }
}
```

### Cost Management Settings UI

```typescript
// Add to src/ui/components/llm-settings.ts in the render() method

// Cost Management section
containerEl.createEl('h4', { text: 'Cost Management' });

new Setting(containerEl)
  .setName('Track Usage')
  .setDesc('Track token usage and API costs')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.llm.costManagement.trackUsage)
    .onChange(async (value) => {
      this.plugin.settings.llm.costManagement.trackUsage = value;
      await this.plugin.saveSettings();
      this.render();
    }));

if (this.plugin.settings.llm.costManagement.trackUsage) {
  // Monthly budget
  new Setting(containerEl)
    .setName('Monthly Budget (USD)')
    .setDesc('Set a monthly spending limit. Leave empty for unlimited.')
    .addText(text => text
      .setPlaceholder('50.00')
      .setValue(this.plugin.settings.llm.costManagement.monthlyBudgetUSD?.toString() || '')
      .onChange(async (value) => {
        const budget = value ? parseFloat(value) : null;
        this.plugin.settings.llm.costManagement.monthlyBudgetUSD = budget;
        await this.plugin.saveSettings();
      }));

  // Warning threshold
  new Setting(containerEl)
    .setName('Warning Threshold (%)')
    .setDesc('Warn when reaching this percentage of budget')
    .addSlider(slider => slider
      .setLimits(50, 95, 5)
      .setValue(this.plugin.settings.llm.costManagement.warningThresholdPercent)
      .setDynamicTooltip()
      .onChange(async (value) => {
        this.plugin.settings.llm.costManagement.warningThresholdPercent = value;
        await this.plugin.saveSettings();
      }));

  // Usage stats display
  const stats = this.plugin.settings.llm.usageStats;
  const statsEl = containerEl.createDiv({ cls: 'llm-usage-stats' });
  statsEl.createEl('h5', { text: 'Current Month Usage' });

  const statsGrid = statsEl.createDiv({ cls: 'llm-usage-stats-grid' });
  statsGrid.createDiv({
    text: `Requests: ${stats.totalRequests}`,
    cls: 'llm-stat',
  });
  statsGrid.createDiv({
    text: `Input Tokens: ${stats.totalInputTokens.toLocaleString()}`,
    cls: 'llm-stat',
  });
  statsGrid.createDiv({
    text: `Output Tokens: ${stats.totalOutputTokens.toLocaleString()}`,
    cls: 'llm-stat',
  });
  statsGrid.createDiv({
    text: `Total Cost: $${stats.totalCostUSD.toFixed(2)}`,
    cls: 'llm-stat llm-stat-cost',
  });

  if (this.plugin.settings.llm.costManagement.monthlyBudgetUSD) {
    const percentUsed = (stats.totalCostUSD / this.plugin.settings.llm.costManagement.monthlyBudgetUSD) * 100;
    statsGrid.createDiv({
      text: `Budget Used: ${percentUsed.toFixed(1)}%`,
      cls: `llm-stat ${percentUsed > 90 ? 'llm-stat-warning' : ''}`,
    });
  }

  // Reset button
  new Setting(containerEl)
    .setName('Reset Usage Stats')
    .setDesc('Manually reset usage statistics')
    .addButton(btn => btn
      .setButtonText('Reset')
      .onClick(async () => {
        this.plugin.llmService.resetUsageStats();
        await this.plugin.saveSettings();
        this.render();
      }));
}
```

### Update DEFAULT_LLM_SETTINGS

```typescript
// In src/types/settings.ts

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  enabled: false,
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  encryptedApiKey: null,
  encryptionSalt: null,
  customBaseUrl: null,

  // Cost management defaults
  costManagement: {
    monthlyBudgetUSD: 10,      // Default $10/month limit
    warningThresholdPercent: 80, // Warn at 80%
    requireConfirmation: true,   // Confirm expensive operations
    trackUsage: true,           // Track by default
  },

  // Initial usage stats
  usageStats: {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    requestsByModel: {},
    lastReset: Date.now(),
  },

  features: {
    claimExtraction: true,
    entityDisambiguation: true,
    predicateSuggestion: true,
    batchAnalysis: true,
    knowledgeQA: true,
    claimImprovement: true,
    autoTagging: true,
    relationshipDiscovery: true,
    summaryGeneration: true,
    factChecking: true,
  },
};
```

### CSS for Usage Stats

```css
/* Add to styles.css */

.llm-usage-stats {
  margin: 16px 0;
  padding: 12px;
  border-radius: 4px;
  background: var(--background-secondary);
}

.llm-usage-stats h5 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
}

.llm-usage-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.llm-stat {
  padding: 8px;
  border-radius: 4px;
  background: var(--background-primary);
  font-size: 12px;
}

.llm-stat-cost {
  font-weight: 600;
  color: var(--text-accent);
}

.llm-stat-warning {
  color: var(--text-error);
  font-weight: 600;
}
```

## Rate Limiting

### Overview
Prevent API rate limit errors by implementing client-side request throttling.

### Implementation

```typescript
// Add to src/services/llm-service.ts

export class LLMService {
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;

  // Rate limit configuration (requests per minute)
  private readonly MAX_CONCURRENT_REQUESTS = 3;
  private readonly MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests
  private readonly MAX_REQUESTS_PER_MINUTE = 30;
  private requestTimestamps: number[] = [];

  /**
   * Execute request with rate limiting
   */
  private async executeWithRateLimit<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    // Wait for available slot
    await this.waitForSlot();

    // Track request
    this.activeRequests++;
    this.lastRequestTime = Date.now();
    this.requestTimestamps.push(Date.now());

    try {
      return await operation();
    } finally {
      this.activeRequests--;

      // Clean up old timestamps (older than 1 minute)
      const oneMinuteAgo = Date.now() - 60000;
      this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    }
  }

  /**
   * Wait for available request slot
   */
  private async waitForSlot(): Promise<void> {
    // Check concurrent requests
    while (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      await this.sleep(100);
    }

    // Check requests per minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.requestTimestamps.filter(t => t > oneMinuteAgo);

    if (recentRequests.length >= this.MAX_REQUESTS_PER_MINUTE) {
      const oldestRequest = recentRequests[0];
      const waitTime = 60000 - (Date.now() - oldestRequest);
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    // Check minimum interval
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL_MS) {
      await this.sleep(this.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Update all LLM operations to use rate limiting
  async extractClaims(text: string, context?: string): Promise<ExtractedClaimLLM[]> {
    return this.executeWithRateLimit(async () => {
      // ... existing implementation ...
    });
  }
}
```

## Security: Prompt Injection Protection

### Sanitization Strategy

```typescript
// Add to src/services/llm-service.ts

export class LLMService {
  /**
   * Sanitize user input to prevent prompt injection
   */
  private sanitizeInput(input: string): string {
    // Remove control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Truncate to reasonable length (prevent DoS)
    const MAX_INPUT_LENGTH = 10000;
    if (sanitized.length > MAX_INPUT_LENGTH) {
      sanitized = sanitized.substring(0, MAX_INPUT_LENGTH);
    }

    // Detect potential injection attempts
    const suspiciousPatterns = [
      /ignore\s+(previous|above|all)\s+instructions/i,
      /disregard\s+(previous|above|all)/i,
      /new\s+instructions:/i,
      /system\s*:/i,
      /\[SYSTEM\]/i,
      /\[ADMIN\]/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        console.warn('Potential prompt injection detected:', sanitized.substring(0, 100));
        // Escape the suspicious content
        sanitized = sanitized.replace(pattern, match =>
          `[USER INPUT: ${match}]`
        );
      }
    }

    return sanitized;
  }

  /**
   * Build prompts with structured sections to prevent injection
   */
  private buildClaimExtractionPrompt(text: string, context?: string): string {
    const sanitizedText = this.sanitizeInput(text);
    const sanitizedContext = context ? this.sanitizeInput(context) : null;

    // Use clear delimiters and structured format
    return `You are an expert at extracting factual claims from text and structuring them as Subject-Predicate-Object triples for a knowledge graph.

TASK: Analyze the following text and extract all factual claims that can be represented as triples.

===== BEGIN USER TEXT =====
${sanitizedText}
===== END USER TEXT =====

${sanitizedContext ? `===== BEGIN CONTEXT =====\n${sanitizedContext}\n===== END CONTEXT =====` : ''}

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
}
```

### Validate Custom Base URLs

```typescript
// Add to src/services/llm-service.ts

export class LLMService {
  /**
   * Validate custom base URL for security
   */
  private validateBaseUrl(url: string | null): boolean {
    if (!url) return true; // null is allowed

    try {
      const parsed = new URL(url);

      // Must be HTTPS (except localhost for development)
      if (parsed.protocol !== 'https:' && !parsed.hostname.includes('localhost')) {
        console.error('Custom base URL must use HTTPS');
        return false;
      }

      // Block common SSRF targets
      const blockedHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254', // AWS metadata
        '::1',
      ];

      // Allow localhost only if explicitly in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (!isDevelopment && blockedHosts.some(host => parsed.hostname.includes(host))) {
        console.error('Blocked hostname in custom base URL');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Invalid URL format:', url);
      return false;
    }
  }

  /**
   * Create provider-specific client with URL validation
   */
  private createClient(
    provider: LLMProvider,
    apiKey: string,
    customBaseUrl: string | null
  ) {
    // Validate custom URL
    if (customBaseUrl && !this.validateBaseUrl(customBaseUrl)) {
      throw new Error('Invalid or insecure custom base URL');
    }

    const baseURL = customBaseUrl || LLM_PROVIDERS[provider].baseUrl;

    // ... rest of existing implementation ...
  }
}
```

### Auto-lock API Key After Timeout

```typescript
// Add to src/services/llm-service.ts

export class LLMService {
  private lockTimeout: NodeJS.Timeout | null = null;
  private readonly AUTO_LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Initialize with auto-lock timer
   */
  async initialize(password: string): Promise<boolean> {
    const result = await /* ... existing initialization ... */;

    if (result) {
      this.resetLockTimer();
    }

    return result;
  }

  /**
   * Reset the auto-lock timer
   */
  private resetLockTimer(): void {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
    }

    this.lockTimeout = setTimeout(() => {
      this.lock();
      this.plugin.noticeManager.info('LLM service locked due to inactivity');
    }, this.AUTO_LOCK_TIMEOUT_MS);
  }

  /**
   * Lock the service (clear decrypted key)
   */
  lock(): void {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }

    this.decryptedApiKey = null;
    this.client = null;
  }

  /**
   * Execute request with auto-lock timer reset
   */
  private async executeWithRateLimit<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    this.resetLockTimer(); // Reset on activity

    // ... existing rate limit implementation ...
  }
}
```

## Performance: Parallel Processing for Batch Operations

### Overview
Batch operations should process claims in parallel (with chunking) rather than sequentially to improve performance and reduce total processing time.

### Implementation

```typescript
// Add to src/services/llm-batch-analyzer.ts

export class LLMBatchAnalyzer {
  private plugin: IntuitionPlugin;
  private llmService: LLMService;

  // Parallel processing configuration
  private readonly CHUNK_SIZE = 5; // Process 5 files at a time
  private readonly MAX_PARALLEL_CLAIMS = 3; // Max 3 claims per file in parallel

  constructor(plugin: IntuitionPlugin, llmService: LLMService) {
    this.plugin = plugin;
    this.llmService = llmService;
  }

  /**
   * Analyze multiple files in parallel batches
   */
  async analyzeFiles(
    files: string[],
    options: BatchAnalysisOptions = {}
  ): Promise<BatchAnalysisResult> {
    const results: FileAnalysisResult[] = [];

    // Process files in chunks to avoid overwhelming the API
    for (let i = 0; i < files.length; i += this.CHUNK_SIZE) {
      const chunk = files.slice(i, i + this.CHUNK_SIZE);

      // Process chunk in parallel
      const chunkResults = await Promise.all(
        chunk.map(file => this.analyzeFile(file, options))
      );

      results.push(...chunkResults);

      // Update progress if callback provided
      if (options.onProgress) {
        options.onProgress(i + chunk.length, files.length);
      }
    }

    // Aggregate results
    const totalClaims = results.reduce((sum, r) => sum + r.claims.length, 0);
    const newClaims = results.reduce(
      (sum, r) => sum + (r.claims.length - r.existingMatches.length),
      0
    );
    const existingClaims = results.reduce(
      (sum, r) => sum + r.existingMatches.length,
      0
    );

    return {
      fileResults: results,
      totalClaims,
      newClaims,
      existingClaims,
    };
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(
    filePath: string,
    options: BatchAnalysisOptions
  ): Promise<FileAnalysisResult> {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = await this.plugin.app.vault.read(file);

      // Extract claims using LLM
      const claims = await this.llmService.extractClaims(content);

      // Check for existing matches (if enabled)
      const existingMatches = options.includeExisting
        ? await this.findExistingMatches(claims)
        : [];

      return {
        filePath,
        claims,
        existingMatches,
      };
    } catch (error) {
      console.error(`Failed to analyze file ${filePath}:`, error);
      return {
        filePath,
        claims: [],
        existingMatches: [],
      };
    }
  }

  /**
   * Find existing matches for claims (parallel search)
   */
  private async findExistingMatches(
    claims: ExtractedClaimLLM[]
  ): Promise<Array<{ claim: ExtractedClaimLLM; matchedTripleId: string }>> {
    // Process claims in parallel chunks
    const matches: Array<{ claim: ExtractedClaimLLM; matchedTripleId: string }> = [];

    for (let i = 0; i < claims.length; i += this.MAX_PARALLEL_CLAIMS) {
      const chunk = claims.slice(i, i + this.MAX_PARALLEL_CLAIMS);

      const chunkMatches = await Promise.all(
        chunk.map(async claim => {
          const match = await this.findExistingClaim(claim);
          return match ? { claim, matchedTripleId: match } : null;
        })
      );

      matches.push(...chunkMatches.filter((m): m is { claim: ExtractedClaimLLM; matchedTripleId: string } => m !== null));
    }

    return matches;
  }

  /**
   * Find a single existing claim
   */
  private async findExistingClaim(
    claim: ExtractedClaimLLM
  ): Promise<string | null> {
    // Search for existing triple in SDK
    // This would integrate with the IntuitionSDK service
    // Implementation depends on SDK search capabilities
    return null; // Placeholder
  }
}

interface BatchAnalysisOptions {
  maxClaimsPerFile?: number;
  includeExisting?: boolean;
  onProgress?: (current: number, total: number) => void;
}
```

### Update Batch Analysis Methods

```typescript
// Update existing batch processing methods to use parallel processing

// In llm-service.ts - Add batch processing with parallelization
async processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  chunkSize: number = 5
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    // Process chunk in parallel with rate limiting
    const chunkResults = await Promise.all(
      chunk.map(item => this.executeWithRateLimit(() => processor(item)))
    );

    results.push(...chunkResults);
  }

  return results;
}
```

## Performance: Caching Support

### Overview
Cache LLM responses to avoid redundant API calls for identical or similar requests, reducing costs and improving response time.

### Implementation

```typescript
// Add to src/services/llm-service.ts

import { CacheService } from './cache-service';

export class LLMService {
  private cacheService: CacheService;
  private readonly CACHE_PREFIX = 'llm_cache';
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(plugin: IntuitionPlugin, cryptoService: CryptoService, cacheService: CacheService) {
    this.plugin = plugin;
    this.cryptoService = cryptoService;
    this.cacheService = cacheService;
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(
    operation: string,
    ...params: (string | number | boolean | object)[]
  ): string {
    const modelId = this.getModelId();
    const paramsHash = this.hashParams(params);
    return `${this.CACHE_PREFIX}:${operation}:${modelId}:${paramsHash}`;
  }

  /**
   * Hash parameters for cache key
   */
  private hashParams(params: any[]): string {
    const str = JSON.stringify(params);
    // Simple hash function (could use crypto.subtle.digest for better hashing)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract claims with caching
   */
  async extractClaims(text: string, context?: string): Promise<ExtractedClaimLLM[]> {
    // Check cache first
    const cacheKey = this.getCacheKey('extractClaims', text, context || '');
    const cached = await this.cacheService.get<ExtractedClaimLLM[]>(cacheKey);

    if (cached) {
      console.log('Using cached claim extraction result');
      return cached;
    }

    // If not cached, perform extraction
    const result = await this.executeWithRateLimit(async () => {
      if (!this.client || !this.plugin.settings.llm.features.claimExtraction) {
        return [];
      }

      this.checkAndResetUsageStats();

      const estimate = this.estimateCost(text + (context || ''), 1000);
      const allowed = await this.checkBudget(estimate.estimatedCostUSD);
      if (!allowed) {
        return [];
      }

      const ClaimSchema = z.object({
        claims: z.array(z.object({
          subject: z.object({
            text: z.string(),
            type: z.enum(['person', 'organization', 'concept', 'thing', 'place', 'event', 'unknown']),
            disambiguation: z.string().optional(),
            confidence: z.number().min(0).max(1),
          }),
          predicate: z.object({
            text: z.string(),
            normalized: z.string(),
            alternatives: z.array(z.string()),
          }),
          object: z.object({
            text: z.string(),
            type: z.enum(['person', 'organization', 'concept', 'thing', 'place', 'event', 'unknown']),
            disambiguation: z.string().optional(),
            confidence: z.number().min(0).max(1),
          }),
          originalSentence: z.string(),
          confidence: z.number().min(0).max(1),
          reasoning: z.string(),
          suggestedImprovement: z.string().optional(),
          warnings: z.array(z.string()).optional(),
        })),
      });

      try {
        const { object, usage } = await generateObject({
          model: this.client(this.getModelId()),
          schema: ClaimSchema,
          prompt: this.buildClaimExtractionPrompt(text, context),
        });

        if (usage) {
          await this.trackUsage(
            this.getModelId(),
            usage.promptTokens,
            usage.completionTokens
          );
        }

        return object.claims;
      } catch (error) {
        console.error('Claim extraction failed:', error);
        return [];
      }
    });

    // Cache the result
    if (result.length > 0) {
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL_MS);
    }

    return result;
  }

  /**
   * Disambiguate entity with caching
   */
  async disambiguateEntity(
    entityText: string,
    context: string,
    candidateAtoms: Array<{ id: string; label: string; description?: string }>
  ): Promise<{ atomId: string; confidence: number; reasoning: string } | null> {
    const cacheKey = this.getCacheKey('disambiguate', entityText, context, candidateAtoms);
    const cached = await this.cacheService.get<{ atomId: string; confidence: number; reasoning: string }>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.executeWithRateLimit(async () => {
      // ... existing disambiguation logic ...
    });

    if (result) {
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL_MS);
    }

    return result;
  }

  /**
   * Clear LLM cache
   */
  async clearCache(): Promise<void> {
    // Get all cache keys with LLM prefix
    const keys = await this.cacheService.getAllKeys();
    const llmKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));

    for (const key of llmKeys) {
      await this.cacheService.delete(key);
    }

    console.log(`Cleared ${llmKeys.length} LLM cache entries`);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ entries: number; estimatedSizeKB: number }> {
    const keys = await this.cacheService.getAllKeys();
    const llmKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));

    // Estimate size (rough calculation)
    let totalSize = 0;
    for (const key of llmKeys) {
      const value = await this.cacheService.get(key);
      if (value) {
        totalSize += JSON.stringify(value).length;
      }
    }

    return {
      entries: llmKeys.length,
      estimatedSizeKB: Math.round(totalSize / 1024),
    };
  }
}
```

### Cache Management UI

```typescript
// Add to src/ui/components/llm-settings.ts in the render() method

// Cache Management section
containerEl.createEl('h4', { text: 'Cache Management' });

new Setting(containerEl)
  .setName('Cache Settings')
  .setDesc('LLM responses are cached for 24 hours to reduce API costs')
  .addButton(btn => btn
    .setButtonText('View Cache Stats')
    .onClick(async () => {
      const stats = await this.plugin.llmService.getCacheStats();
      this.plugin.noticeManager.info(
        `Cache: ${stats.entries} entries, ${stats.estimatedSizeKB} KB`
      );
    }))
  .addButton(btn => btn
    .setButtonText('Clear Cache')
    .setWarning()
    .onClick(async () => {
      await this.plugin.llmService.clearCache();
      this.plugin.noticeManager.success('LLM cache cleared');
    }));
```

## Acceptance Criteria

### Core Infrastructure
- [ ] LLM service initializes with encrypted API key
- [ ] Support for OpenAI, Anthropic, OpenRouter, Google providers
- [ ] Model selection per provider
- [ ] API key encrypted using same pattern as wallet
- [ ] Test connection button works
- [ ] Custom endpoint support for proxies

### Settings UI
- [ ] Enable/disable toggle for AI features
- [ ] Provider dropdown with all 4 providers
- [ ] Model dropdown updates based on provider
- [ ] Secure API key input (password field)
- [ ] API key status display
- [ ] Remove key button
- [ ] Per-feature toggles for all 10 features
- [ ] Link to provider API key documentation

### Claim Extraction (Primary Feature)
- [ ] LLM extracts claims when enabled
- [ ] Falls back to regex when LLM unavailable
- [ ] Confidence scores from LLM displayed
- [ ] Entity disambiguation suggestions shown
- [ ] Predicate suggestions offered

### Additional Features (Document All)
- [ ] Batch Note Analysis modal
- [ ] Knowledge Q&A interface
- [ ] Claim improvement suggestions
- [ ] Auto-tagging for notes
- [ ] Relationship discovery
- [ ] Consensus summarization
- [ ] Fact-checking display

## Testing

1. Configure OpenAI API key - verify encryption
2. Test connection - verify success message
3. Switch to Anthropic - verify model list updates
4. Extract claim with LLM - compare to regex
5. Disable LLM - verify regex fallback
6. Test with invalid API key - verify error handling
7. Test each feature toggle
8. Test custom endpoint configuration

## Security Considerations

1. **API Key Storage**: Uses same AES-256-GCM encryption as wallet
2. **Key in Memory**: Decrypted key auto-locks after 30 minutes of inactivity
3. **No Logging**: API keys never logged or transmitted except to provider
4. **Password Required**: User must enter password to decrypt key
5. **Proxy Support**: Corporate users can route through approved proxies
6. **Prompt Injection Protection**: User input sanitized with suspicious pattern detection
7. **Custom URL Validation**: HTTPS enforcement and SSRF protection
8. **Rate Limiting**: Client-side throttling prevents API abuse

## Migration Guide: Regex to LLM

### Overview
This guide helps users transition from regex-based claim extraction to LLM-powered extraction.

### Step 1: Enable LLM Features

1. Open Settings → Intuition Plugin → AI/LLM Configuration
2. Toggle "Enable AI features" to ON
3. Select your preferred provider (OpenAI recommended for starting)
4. Obtain an API key from your provider
5. Enter and save your API key (it will be encrypted)
6. Test the connection to verify setup

### Step 2: Configure Cost Management

1. Set a monthly budget (recommended: start with $10/month)
2. Set warning threshold to 80%
3. Enable usage tracking
4. Monitor your usage in the settings panel

### Step 3: Enable Claim Extraction

1. In AI Feature Toggles section, ensure "Claim Extraction" is enabled
2. Optionally enable other features:
   - Entity Disambiguation (recommended)
   - Predicate Suggestions (recommended)
   - Claim Improvement

### Step 4: Test with Sample Claims

Try extracting claims from various sentence structures:

**Regex-friendly (both work):**
- "OpenAI is an AI research company"
- "React uses JavaScript"

**LLM-only (regex would fail):**
- "The company behind ChatGPT focuses on artificial general intelligence"
- "In 2015, the organization was founded by Elon Musk and Sam Altman"

### Step 5: Comparison

| Feature | Regex | LLM |
|---------|-------|-----|
| Simple patterns | ✅ Fast | ✅ Fast (with cache) |
| Complex sentences | ❌ Fails | ✅ Succeeds |
| Disambiguation | ❌ No | ✅ Yes |
| Confidence scores | ❌ No | ✅ Yes |
| Cost | ✅ Free | 💰 ~$0.01-0.05/request |
| Offline | ✅ Yes | ❌ No |

### Fallback Behavior

LLM is NOT required. The plugin gracefully falls back to regex if:
- LLM is disabled
- No API key configured
- API request fails
- Budget exceeded
- Network unavailable

### Recommended Strategy

1. **Start conservative**: Enable only claim extraction initially
2. **Monitor costs**: Check usage stats weekly for first month
3. **Expand gradually**: Enable more features as you understand costs
4. **Use caching**: Cache reduces repeat costs significantly
5. **Set budgets**: Always set a monthly budget to prevent surprises

## Cost Estimation Guide

### Typical Usage Costs

#### Claim Extraction (per request)

| Model | Input Tokens | Output Tokens | Cost | Best For |
|-------|--------------|---------------|------|----------|
| GPT-4o Mini | ~500 | ~200 | $0.0002 | Daily use |
| GPT-4o | ~500 | ~200 | $0.0025 | Complex claims |
| Claude Haiku | ~500 | ~200 | $0.0010 | Balanced |
| Claude Sonnet 4 | ~500 | ~200 | $0.0045 | Best quality |
| Gemini Flash | ~500 | ~200 | $0.0001 | Budget option |

#### Monthly Cost Estimates

**Light User** (10 claims/day):
- GPT-4o Mini: ~$0.60/month
- Claude Haiku: ~$3/month
- GPT-4o: ~$7.50/month

**Medium User** (50 claims/day):
- GPT-4o Mini: ~$3/month
- Claude Haiku: ~$15/month
- GPT-4o: ~$37.50/month

**Heavy User** (200 claims/day):
- GPT-4o Mini: ~$12/month
- Claude Haiku: ~$60/month
- GPT-4o: ~$150/month

**With Caching (50% hit rate):**
- Costs reduced by 50% for repeated extractions

### Cost Optimization Tips

1. **Use cheaper models for simple tasks**: GPT-4o Mini or Gemini Flash for straightforward claims
2. **Cache aggressively**: 24-hour cache reduces costs significantly
3. **Batch operations**: Process multiple notes at once (uses parallelization efficiently)
4. **Set budgets**: Prevent overspending with monthly limits
5. **Monitor usage**: Check stats regularly, especially first month
6. **Disable unused features**: Turn off features you don't use

### Cost Comparison: LLM vs Manual

Creating 30 claims/day manually takes ~30 minutes.

At $30/hour equivalent:
- **Manual cost**: $15/day = $450/month
- **LLM cost (GPT-4o Mini)**: $1.80/month
- **Savings**: $448.20/month

## Testing Strategy

### Unit Tests

```typescript
// tests/services/llm-service.test.ts

describe('LLMService', () => {
  describe('Cost Management', () => {
    it('should prevent operations exceeding budget', async () => {
      // Test budget enforcement
    });

    it('should track token usage accurately', async () => {
      // Test usage tracking
    });

    it('should reset usage stats monthly', async () => {
      // Test monthly reset
    });
  });

  describe('Rate Limiting', () => {
    it('should limit concurrent requests', async () => {
      // Test concurrent limit
    });

    it('should respect requests per minute limit', async () => {
      // Test RPM limit
    });
  });

  describe('Security', () => {
    it('should sanitize prompt injection attempts', () => {
      // Test input sanitization
    });

    it('should validate custom base URLs', () => {
      // Test URL validation
    });

    it('should auto-lock after timeout', async () => {
      // Test auto-lock
    });
  });

  describe('Caching', () => {
    it('should cache successful responses', async () => {
      // Test caching
    });

    it('should return cached results for identical requests', async () => {
      // Test cache hits
    });
  });

  describe('Parallel Processing', () => {
    it('should process batch in parallel chunks', async () => {
      // Test parallel processing
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/llm-integration.test.ts

describe('LLM Integration', () => {
  it('should extract claims using OpenAI', async () => {
    // Test with real OpenAI API (mock in CI)
  });

  it('should fall back to regex when LLM unavailable', async () => {
    // Test fallback behavior
  });

  it('should handle API errors gracefully', async () => {
    // Test error handling
  });
});
```

### Manual Testing Checklist

- [ ] Configure API key with each provider (OpenAI, Anthropic, OpenRouter, Google)
- [ ] Test connection for each provider
- [ ] Extract simple claim: "X is Y"
- [ ] Extract complex claim: "The company that..."
- [ ] Test with budget limit exceeded
- [ ] Test with invalid API key
- [ ] Test fallback to regex
- [ ] Test caching (extract same claim twice)
- [ ] Test batch analysis (10+ files)
- [ ] Test auto-lock after 30 minutes
- [ ] Test prompt injection (enter "Ignore previous instructions")
- [ ] Test custom base URL
- [ ] Test usage stats display
- [ ] Test monthly budget warning
- [ ] Test cache clearing

## Privacy Considerations

### Data Handling

1. **Local Storage**:
   - API keys encrypted locally using AES-256-GCM
   - No data sent to Intuition servers
   - All processing happens client-side

2. **Data Sent to LLM Providers**:
   - **Sent**: Note text, extracted claims, context
   - **NOT sent**: API keys (used for auth only), file paths, personal metadata
   - Subject to provider's privacy policy

3. **Provider Privacy Policies**:
   - **OpenAI**: [Privacy Policy](https://openai.com/policies/privacy-policy)
   - **Anthropic**: [Privacy Policy](https://www.anthropic.com/privacy)
   - **Google**: [Privacy Policy](https://policies.google.com/privacy)
   - **OpenRouter**: [Privacy Policy](https://openrouter.ai/privacy)

### Privacy Best Practices

1. **Sensitive Information**:
   - Do NOT extract claims containing:
     - Personal identifying information (PII)
     - Passwords or credentials
     - Confidential business information
     - Medical records or financial data

2. **Private Vaults**:
   - Consider using local models (future enhancement) for sensitive vaults
   - Disable LLM features for confidential notes
   - Use Obsidian's excluded files feature

3. **Compliance**:
   - GDPR: User controls all data, can delete anytime
   - HIPAA: Do NOT use with protected health information
   - Enterprise: Consult IT before enabling for corporate vaults

### Data Retention

- **Local cache**: 24 hours (configurable)
- **Provider retention**: Varies by provider (typically 30 days for abuse prevention)
- **Usage stats**: Stored locally, reset monthly

## Troubleshooting

### Common Issues

#### Issue: "Connection failed" when testing

**Possible causes:**
1. Invalid API key
2. Network firewall blocking requests
3. Incorrect provider selected
4. Custom base URL misconfigured

**Solutions:**
1. Verify API key from provider dashboard
2. Check firewall/VPN settings
3. Try different provider
4. Remove custom base URL or validate format

#### Issue: "Budget exceeded" error

**Solutions:**
1. Increase monthly budget in settings
2. Clear LLM cache to free up budget
3. Reset usage stats if month rolled over
4. Switch to cheaper model (e.g., GPT-4o Mini)

#### Issue: Claims not extracted (returns empty)

**Possible causes:**
1. LLM not initialized (need to enter password)
2. Feature disabled in settings
3. Rate limit reached
4. Text too short/invalid

**Solutions:**
1. Re-initialize LLM service with password
2. Check "Claim Extraction" is enabled
3. Wait a minute and retry
4. Try with longer, clearer text

#### Issue: Slow performance

**Possible causes:**
1. Large batch operations
2. Network latency
3. Cold start (first request)
4. Rate limiting delays

**Solutions:**
1. Use caching (enabled by default)
2. Switch to faster model (Gemini Flash, GPT-4o Mini)
3. Process in smaller batches
4. Check network connection

#### Issue: Unexpected costs

**Possible causes:**
1. No budget limit set
2. Cache disabled
3. Large batch operations
4. Expensive model selected

**Solutions:**
1. Set monthly budget immediately
2. Enable caching in settings
3. Check usage stats to identify source
4. Switch to cheaper model
5. Use cost estimation before batch operations

#### Issue: "API key locked" message

**Cause:** Auto-lock triggered after 30 minutes inactivity

**Solution:** Re-enter encryption password to unlock

### Debug Mode

Enable debug logging:

```typescript
// In console (Obsidian developer tools)
window.DEBUG_LLM = true;
```

This will log:
- All API requests
- Cache hits/misses
- Cost calculations
- Rate limit status

### Getting Help

1. Check plugin logs (Settings → Intuition Plugin → Logs)
2. Review usage stats (Settings → Intuition Plugin → AI/LLM → Cost Management)
3. Test with different provider
4. Report issue on GitHub: [Issues](https://github.com/0xIntuition/intuition-obsidian-plugin/issues)

### Known Limitations

1. **Offline mode**: LLM features require internet connection
2. **Cost unpredictability**: Token counts are estimates, actual costs may vary ±20%
3. **Response time**: LLM requests take 1-5 seconds vs instant regex
4. **Provider limits**: Each provider has different rate limits
5. **Context window**: Very long notes may be truncated (10,000 chars max)

## Future Enhancements

- Local model support (Ollama) for privacy-conscious users
- Streaming responses for real-time feedback
- Model fine-tuning on user's knowledge graph patterns
- Batch API for cost optimization
- Response caching for repeated queries (optional)

## Estimated Effort
High - Core infrastructure with multiple provider integrations
