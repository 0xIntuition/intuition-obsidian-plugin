# Plan 006-2a: Core LLM Service + Settings

## Status
🔴 Not Started

## Prerequisites
- Plan 004 (Intuition SDK Integration) ✅
- Plan 006 (Claim Structuring Modal) ✅

## Objective
Build the foundational LLM infrastructure for the Intuition Obsidian Plugin without modifying existing features. This establishes the core service layer, settings UI, and security infrastructure needed for AI-powered claim processing.

## Motivation

The plugin currently uses regex-based claim extraction which has significant limitations:
- Only handles a few sentence patterns
- No semantic understanding
- Cannot disambiguate entities
- No confidence scoring

LLM integration enables:
- Natural language understanding of any sentence structure
- Entity recognition and disambiguation
- Context-aware processing
- Confidence calibration
- Future advanced features (batch analysis, knowledge Q&A, etc.)

This plan focuses on infrastructure only - no changes to existing claim extraction logic yet.

## Technology Selection

### Library: Vercel AI SDK (`ai`)

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod
```

**Why Vercel AI SDK:**
- Lightweight (~50KB)
- Unified API across providers
- First-class TypeScript support with Zod schemas
- Streaming support built-in
- Active maintenance by Vercel
- Works in Node.js and browser environments

### Supported Providers (Priority Order)
1. **Anthropic** - Claude Haiku 3.5, Claude Sonnet 4 (DEFAULT)
2. **OpenAI** - GPT-4o, GPT-4o-mini
3. **OpenRouter** - Access to 100+ models via single API
4. **Google AI** - Gemini Pro 1.5, Gemini Flash

### Default Configuration
- **Provider:** Anthropic
- **Model:** `claude-haiku-3-5-20241022`
- **Cost:** $0.80 per 1M input tokens, $4.00 per 1M output tokens
- **Context Window:** 200,000 tokens
- **Benefits:** Higher quality outputs, faster responses, large context

## Files to Create

### 1. `src/types/llm.ts`
All LLM-related type definitions:

```typescript
export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'google';

export interface LLMProviderConfig {
  id: LLMProvider;
  name: string;
  models: LLMModel[];
  requiresApiKey: boolean;
  baseUrl?: string;
  docsUrl: string;
}

export interface LLMModel {
  id: string;
  name: string;
  contextWindow: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  recommended?: boolean;
}

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', contextWindow: 200000, inputPricePerMillion: 0.8, outputPricePerMillion: 4, recommended: true },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, inputPricePerMillion: 3, outputPricePerMillion: 15 },
    ],
    requiresApiKey: true,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputPricePerMillion: 0.15, outputPricePerMillion: 0.6, recommended: true },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputPricePerMillion: 2.5, outputPricePerMillion: 10 },
    ],
    requiresApiKey: true,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-haiku-3.5', name: 'Claude Haiku 3.5', contextWindow: 200000, inputPricePerMillion: 0.8, outputPricePerMillion: 4, recommended: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 },
    ],
    requiresApiKey: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/keys',
  },
  google: {
    id: 'google',
    name: 'Google AI',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPricePerMillion: 0.075, outputPricePerMillion: 0.3, recommended: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, inputPricePerMillion: 1.25, outputPricePerMillion: 5 },
    ],
    requiresApiKey: true,
    docsUrl: 'https://aistudio.google.com/apikey',
  },
};

// Usage tracking types
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
```

### 2. `src/services/llm-service.ts`
Core LLM service with all infrastructure methods:

**Key Methods:**
- `initialize(password: string)` - Decrypt API key and create provider client
- `isAvailable()` - Check if LLM is configured and ready
- `testConnection()` - Validate API key with test request
- `estimateCost(text: string, expectedOutputTokens: number)` - Estimate operation cost
- `checkBudget(estimatedCostUSD: number)` - Validate against monthly budget
- `trackUsage(modelId: string, inputTokens: number, outputTokens: number)` - Record usage stats
- `resetUsageStats()` - Clear monthly usage stats
- `lock()` - Clear decrypted API key from memory
- `extractClaims(text: string, context?: string)` - Extract claims (implementation in this plan, used in 006-2b)

**Security Features:**
- Rate limiting: 3 concurrent requests, 1 second between requests, 30/minute
- Prompt injection protection: Sanitize inputs, detect suspicious patterns
- API key auto-lock after 30 minutes of inactivity
- HTTPS-only custom endpoints (except localhost in dev mode)

**Performance Features:**
- Request queueing with rate limits
- Parallel batch processing (5 items per chunk)
- Cache support for repeated requests (24 hour TTL)

### 3. `src/ui/components/llm-settings.ts`
Settings UI component for LLM configuration:

**UI Sections:**
1. **Enable Toggle** - Master on/off switch
2. **Provider Selection** - Dropdown (Anthropic, OpenAI, OpenRouter, Google)
3. **Model Selection** - Dropdown based on selected provider
4. **API Key Input** - Password field with save/remove buttons
5. **Custom Endpoint** - Optional override for proxies/corporate setups
6. **Connection Test** - Validate API key with latency display
7. **Cost Management** - Usage tracking toggle, budget settings
8. **Usage Stats** - Current month requests, tokens, cost
9. **Feature Toggles** - Enable/disable individual LLM features

**Key UX Considerations:**
- API key masked as password
- Link to provider's API key page
- Clear status indicators (configured vs not configured)
- Real-time connection test with latency
- Cost breakdown by model
- Budget warnings at configurable threshold

## Files to Modify

### 1. `src/types/settings.ts`
Add `LLMSettings` interface to `IntuitionPluginSettings`:

```typescript
export interface LLMSettings {
  enabled: boolean;
  provider: LLMProvider;
  modelId: string;

  // Encrypted API key (same pattern as wallet)
  encryptedApiKey: string | null;
  encryptionSalt: string | null;

  // Custom endpoint for proxies/corporate setups
  customBaseUrl: string | null;

  // Cost management (disabled by default)
  costManagement: {
    trackUsage: boolean;              // Default: false
    monthlyBudgetUSD: number | null;  // Default: null (unlimited)
    warningThresholdPercent: number;  // Default: 80
    requireConfirmation: boolean;     // Default: false
  };

  // Usage stats (reset monthly)
  usageStats: LLMUsageStats;

  // Feature flags for individual LLM features
  features: {
    claimExtraction: boolean;         // Default: true
    entityDisambiguation: boolean;    // Default: true (not used in 006-2a)
    predicateSuggestion: boolean;     // Default: true (not used in 006-2a)
    batchAnalysis: boolean;           // Default: true (not used in 006-2a)
    knowledgeQA: boolean;             // Default: true (not used in 006-2a)
    claimImprovement: boolean;        // Default: true (not used in 006-2a)
    autoTagging: boolean;             // Default: true (not used in 006-2a)
    relationshipDiscovery: boolean;   // Default: true (not used in 006-2a)
    summaryGeneration: boolean;       // Default: true (not used in 006-2a)
    factChecking: boolean;            // Default: true (not used in 006-2a)
  };
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  enabled: false,
  provider: 'anthropic',
  modelId: 'claude-haiku-3-5-20241022',
  encryptedApiKey: null,
  encryptionSalt: null,
  customBaseUrl: null,
  costManagement: {
    trackUsage: false,
    monthlyBudgetUSD: null,
    warningThresholdPercent: 80,
    requireConfirmation: false,
  },
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

### 2. `src/ui/settings-tab.ts`
Add LLM settings section to the settings tab:

```typescript
// In IntuitionSettingTab.display() method
const llmSettings = new LLMSettingsComponent(this.plugin, containerEl);
llmSettings.render();
```

### 3. `src/main.ts`
Initialize `LLMService` in the plugin lifecycle:

```typescript
export default class IntuitionPlugin extends Plugin {
  // ... existing services ...
  llmService!: LLMService;

  async onload() {
    // ... existing initialization ...

    // Initialize LLM service (after CryptoService)
    this.llmService = new LLMService(this, this.cryptoService, this.cacheService);
    await this.llmService.initialize(/* password from settings if available */);
  }

  async onunload() {
    // ... existing cleanup ...

    // Lock LLM service
    this.llmService.lock();
  }
}
```

### 4. `styles.css`
Add CSS for LLM UI components:

```css
/* LLM Settings */
.llm-test-result {
  margin-top: 8px;
  font-size: 12px;
}

.llm-test-pending { color: var(--text-muted); }
.llm-test-success { color: var(--text-success); }
.llm-test-error { color: var(--text-error); }

/* LLM Usage Stats */
.llm-usage-stats {
  margin: 16px 0;
  padding: 12px;
  border-radius: 4px;
  background: var(--background-secondary);
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
```

## Dependencies

Add to `package.json`:

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

## Implementation Order

1. **Types** (`src/types/llm.ts`)
   - Define all LLM types first
   - Add `LLMSettings` to `settings.ts`

2. **Service Core** (`src/services/llm-service.ts`)
   - Constructor and initialization
   - API key encryption/decryption
   - Provider client creation
   - Connection testing

3. **Rate Limiting & Security**
   - Request queue and rate limiting
   - Prompt injection protection
   - Budget checks
   - Auto-lock timer

4. **Usage Tracking**
   - Token usage tracking
   - Cost calculation
   - Monthly reset logic
   - Stats aggregation

5. **Settings UI** (`src/ui/components/llm-settings.ts`)
   - Provider/model selection
   - API key input
   - Connection test
   - Usage stats display
   - Feature toggles

6. **Integration** (`main.ts`, `settings-tab.ts`)
   - Wire up service in plugin lifecycle
   - Add settings section
   - Handle password prompts

7. **Styling** (`styles.css`)
   - LLM UI components
   - Usage stats display
   - Status indicators

## Testing Strategy

### Unit Tests
- `llm-service.spec.ts`:
  - API key encryption/decryption
  - Provider client creation
  - Rate limiting logic
  - Budget validation
  - Usage tracking calculations
  - Cost estimation
  - Prompt sanitization
  - Cache key generation

### Integration Tests
- `llm-service.integration.spec.ts`:
  - Real API calls to each provider (testnet/dev keys)
  - Connection testing
  - Actual token usage tracking
  - Rate limit enforcement
  - Cache behavior

### Manual Testing Checklist
- [ ] Save API key for each provider
- [ ] Test connection for each provider
- [ ] Verify usage stats update after API calls
- [ ] Test budget warnings at threshold
- [ ] Test budget blocking at limit
- [ ] Verify auto-lock after 30 minutes
- [ ] Test custom endpoint override
- [ ] Verify prompt injection detection
- [ ] Test rate limiting under load
- [ ] Check cache hit/miss behavior

## Security Considerations

### API Key Storage
- Encrypted with AES-GCM using user password
- Same pattern as wallet encryption (reuse `CryptoService`)
- Salt stored alongside encrypted key
- No password storage or recovery mechanism
- Keys stored in Obsidian's `data.json` (may sync to cloud - warn users!)

### Rate Limiting
- Max 3 concurrent requests
- Min 1 second between requests
- Max 30 requests per minute
- Queue overflow handling

### Prompt Injection Protection
- Sanitize all user inputs
- Detect suspicious patterns (`ignore previous instructions`, etc.)
- Use clear delimiters in prompts (`===== BEGIN USER TEXT =====`)
- Escape suspicious content

### Custom Endpoints
- HTTPS-only (except localhost in dev mode)
- Block SSRF targets (localhost, 169.254.169.254, etc. unless dev mode)
- Validate URL format before use

### Auto-Lock
- Decrypt API key only when needed
- Auto-lock after 30 minutes of inactivity
- Reset timer on each API call
- Manual lock via service method

## Cost Management Strategy

### Default Behavior
- **No budget limit by default** (opt-in tracking)
- **Usage tracking disabled by default** (must be enabled in settings)
- Users see usage stats UI but no enforcement

### When Tracking Enabled
- Set monthly budget in USD (e.g., $20-50)
- Warning at configurable threshold (default 80%)
- Hard block at 100% of budget
- Monthly automatic reset (based on `usageStats.lastReset`)

### Cost Estimation
- Rough estimation: 1 token ≈ 4 characters
- Display estimated cost before expensive operations
- Show per-model pricing in settings UI
- Track actual usage from API response

### Usage Stats Display
- Total requests this month
- Total input/output tokens
- Total cost in USD
- Breakdown by model
- Percentage of budget used (if set)

## Acceptance Criteria

### Functionality
- [ ] LLM service initializes with encrypted API key
- [ ] All 4 providers (Anthropic, OpenAI, OpenRouter, Google) work
- [ ] Connection test validates API key and shows latency
- [ ] Settings UI allows provider/model selection
- [ ] API keys are encrypted and stored securely
- [ ] Usage tracking records tokens and costs accurately
- [ ] Monthly usage stats reset automatically
- [ ] Budget warnings appear at threshold
- [ ] Budget blocking works at 100%
- [ ] Rate limiting prevents API abuse
- [ ] Prompt injection detection works
- [ ] Custom endpoints can be configured
- [ ] Auto-lock triggers after 30 minutes
- [ ] Cache reduces redundant API calls

### User Experience
- [ ] Settings UI is intuitive and well-organized
- [ ] Connection test provides clear feedback
- [ ] Usage stats are easy to understand
- [ ] Budget warnings are not intrusive
- [ ] API key status is clear (configured vs not)
- [ ] Error messages are user-friendly
- [ ] Settings persist across sessions
- [ ] Network changes clear cache appropriately

### Code Quality
- [ ] All types are properly defined in `llm.ts`
- [ ] Service extends `BaseService` pattern
- [ ] Unit tests cover core logic (80%+ coverage)
- [ ] Integration tests validate real API calls
- [ ] Code follows existing style conventions
- [ ] No console.log statements (use proper logging)
- [ ] Error handling is comprehensive
- [ ] Documentation is complete

### Security
- [ ] API keys are never logged or exposed
- [ ] Encryption uses secure algorithms (AES-GCM)
- [ ] Rate limiting is enforced
- [ ] Prompt injection is mitigated
- [ ] Custom endpoints are validated
- [ ] SSRF attacks are prevented
- [ ] Auto-lock clears sensitive data

## Graceful Degradation

When LLM is unavailable (no API key, network error, or disabled):
1. `LLMService.isAvailable()` returns `false`
2. All LLM features are disabled in UI
3. Settings show "AI features require API key configuration"
4. No errors or warnings spam the user
5. Core plugin functionality works without LLM

## Next Steps

After completing Plan 006-2a:
1. **Test thoroughly** with all 4 providers
2. **Validate** cost tracking and budgets work correctly
3. **Proceed to Plan 006-2b** - Migrate claim extraction to use LLM
4. **Do not implement** advanced features yet - those are documented in Plan 013

## Notes

- This plan does NOT modify `ClaimParserService` - that happens in Plan 006-2b
- All advanced features (batch analysis, entity disambiguation, etc.) are deferred to future plans
- Focus is on infrastructure and security first
- The `extractClaims()` method is implemented here but not integrated until 006-2b
