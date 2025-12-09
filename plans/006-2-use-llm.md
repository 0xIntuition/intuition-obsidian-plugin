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
2. **Key in Memory**: Decrypted key only held during active session
3. **No Logging**: API keys never logged or transmitted except to provider
4. **Password Required**: User must enter password to decrypt key
5. **Proxy Support**: Corporate users can route through approved proxies

## Future Enhancements

- Local model support (Ollama) for privacy-conscious users
- Streaming responses for real-time feedback
- Model fine-tuning on user's knowledge graph patterns
- Batch API for cost optimization
- Response caching for repeated queries (optional)

## Estimated Effort
High - Core infrastructure with multiple provider integrations
