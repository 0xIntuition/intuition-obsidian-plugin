# Plan 006-2b: Claim Extraction Migration to LLM

## Status
🔴 Not Started

## Prerequisites
- Plan 006-2a (Core LLM Service + Settings) ✅ (must be complete)

## Objective
Migrate the existing regex-based claim extraction in `ClaimParserService` to use LLM when available, with fallback to regex patterns for graceful degradation.

## Motivation

The current `ClaimParserService` uses pattern matching:

```typescript
const patterns = [
  /^(.+?)\s+is\s+(?:a\s+)?(.+)$/i,    // "X is a Y"
  /^(.+?)\s+uses\s+(.+)$/i,            // "X uses Y"
  /^(.+?)\s+has\s+(.+)$/i,             // "X has Y"
];
```

**Limitations:**
- Only handles ~5 sentence patterns
- No semantic understanding
- Cannot handle complex sentences
- No confidence scoring
- No entity disambiguation

**LLM Benefits:**
- Understands natural language
- Extracts triples from any sentence structure
- Provides confidence scores
- Can disambiguate entities
- Suggests better phrasings

## Scope

This plan focuses on:
- Updating `ClaimParserService.extractTriple()` to try LLM first
- Falling back to regex when LLM unavailable
- Mapping LLM results to existing `TripleSuggestion` type
- Optionally showing LLM confidence in UI

**Out of Scope:**
- Advanced LLM features (batch analysis, entity disambiguation, etc.) - see Plan 013
- Major UI changes - keep existing ClaimModal behavior
- New commands or workflows

## Files to Modify

### 1. `src/services/claim-parser-service.ts`

**Current method:**
```typescript
extractTriple(text: string): TripleSuggestion | null {
  // Regex pattern matching only
}
```

**Updated method:**
```typescript
async extractTriple(text: string): Promise<TripleSuggestion | null> {
  // Try LLM first if available and enabled
  if (this.llmService?.isAvailable() &&
      this.plugin.settings.llm.features.claimExtraction) {
    try {
      const llmResults = await this.llmService.extractClaims(text);
      if (llmResults.length > 0) {
        return this.convertLLMResult(llmResults[0]);
      }
    } catch (error) {
      console.error('LLM extraction failed, falling back to regex:', error);
      // Continue to regex fallback
    }
  }

  // Fall back to regex patterns
  return this.extractTripleRegex(text);
}

/**
 * Convert LLM result to TripleSuggestion format
 */
private convertLLMResult(llmClaim: ExtractedClaimLLM): TripleSuggestion {
  return {
    subject: llmClaim.subject.text,
    predicate: llmClaim.predicate.normalized,
    object: llmClaim.object.text,
    confidence: llmClaim.confidence,
    pattern: 'llm' as ExtractionPattern,
    llmMetadata: {
      subjectType: llmClaim.subject.type,
      subjectDisambiguation: llmClaim.subject.disambiguation,
      subjectConfidence: llmClaim.subject.confidence,
      objectType: llmClaim.object.type,
      objectDisambiguation: llmClaim.object.disambiguation,
      objectConfidence: llmClaim.object.confidence,
      predicateAlternatives: llmClaim.predicate.alternatives,
      reasoning: llmClaim.reasoning,
      suggestedImprovement: llmClaim.suggestedImprovement,
      warnings: llmClaim.warnings,
    },
  };
}

/**
 * Extract triple using regex patterns (existing logic)
 */
private extractTripleRegex(text: string): TripleSuggestion | null {
  // Move existing regex logic here
  // Keep all current patterns intact
  // Return null if no match
}
```

**Key changes:**
- Method becomes `async` to support LLM calls
- LLM is tried first when available
- Fallback to regex on error or when unavailable
- New `llmMetadata` field in `TripleSuggestion` (optional)
- Existing regex logic preserved in `extractTripleRegex()`

### 2. `src/types/claim-parser.ts`

Add LLM metadata to `TripleSuggestion`:

```typescript
export type ExtractionPattern =
  | 'is_a'
  | 'has'
  | 'uses'
  | 'created'
  | 'founded'
  | 'located_in'
  | 'llm';  // NEW

export interface TripleSuggestion {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  pattern: ExtractionPattern;

  // NEW - Optional LLM metadata
  llmMetadata?: {
    subjectType: 'person' | 'organization' | 'concept' | 'thing' | 'place' | 'event' | 'unknown';
    subjectDisambiguation?: string;
    subjectConfidence: number;
    objectType: 'person' | 'organization' | 'concept' | 'thing' | 'place' | 'event' | 'unknown';
    objectDisambiguation?: string;
    objectConfidence: number;
    predicateAlternatives: string[];
    reasoning: string;
    suggestedImprovement?: string;
    warnings?: string[];
  };
}
```

### 3. `src/ui/modals/claim-modal.ts` (Optional)

Optionally show LLM confidence indicators:

```typescript
// In ClaimModal.onOpen() method

// After displaying subject/predicate/object inputs
if (this.initialTriple?.pattern === 'llm' && this.initialTriple.llmMetadata) {
  const metadata = this.initialTriple.llmMetadata;

  // Add confidence badge
  const badgeEl = this.contentEl.createDiv({ cls: 'claim-llm-badge' });
  const confidenceClass =
    metadata.subjectConfidence >= 0.8 && metadata.objectConfidence >= 0.8
      ? 'high-confidence'
      : metadata.subjectConfidence >= 0.5 && metadata.objectConfidence >= 0.5
      ? 'medium-confidence'
      : 'low-confidence';
  badgeEl.addClass(confidenceClass);
  badgeEl.setText(`AI Extracted (${Math.round(this.initialTriple.confidence * 100)}% confidence)`);

  // Optionally show reasoning
  if (metadata.reasoning) {
    new Setting(this.contentEl)
      .setName('Extraction reasoning')
      .setDesc(metadata.reasoning);
  }

  // Optionally show suggested improvement
  if (metadata.suggestedImprovement) {
    new Setting(this.contentEl)
      .setName('Suggested improvement')
      .setDesc(metadata.suggestedImprovement)
      .addButton(btn => btn
        .setButtonText('Apply')
        .onClick(() => {
          // Parse and apply suggested improvement
        }));
  }

  // Show warnings if any
  if (metadata.warnings && metadata.warnings.length > 0) {
    const warningEl = this.contentEl.createDiv({ cls: 'claim-llm-warnings' });
    warningEl.createEl('strong', { text: 'Warnings:' });
    const warningList = warningEl.createEl('ul');
    for (const warning of metadata.warnings) {
      warningList.createEl('li', { text: warning });
    }
  }
}
```

### 4. `styles.css` (Optional)

Add styles for LLM confidence indicators (if implementing UI changes):

```css
/* LLM Claim Badges (already in 006-2a) */
.claim-llm-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--background-modifier-message);
  margin-bottom: 12px;
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

/* LLM Warnings */
.claim-llm-warnings {
  margin: 12px 0;
  padding: 12px;
  border-radius: 4px;
  background: rgba(234, 179, 8, 0.1);
  border-left: 3px solid var(--text-warning);
  font-size: 13px;
}

.claim-llm-warnings ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}
```

## Implementation Strategy

### Phase 1: Service Update (Required)
1. Add `llmService` reference to `ClaimParserService` constructor
2. Make `extractTriple()` async
3. Add LLM extraction logic with try-catch
4. Refactor existing regex logic into `extractTripleRegex()`
5. Add `convertLLMResult()` helper
6. Update `llmMetadata` types

### Phase 2: UI Enhancement (Optional)
1. Check if `initialTriple.pattern === 'llm'`
2. Display confidence badge
3. Show reasoning and warnings
4. Add "Apply suggestion" button

### Phase 3: Testing
1. Unit tests for both LLM and regex paths
2. Integration tests with real LLM
3. Manual testing with various sentence structures

## LLM Prompt Design

The `LLMService.extractClaims()` method (implemented in Plan 006-2a) uses this prompt structure:

```
You are an expert at extracting factual claims from text and structuring them
as Subject-Predicate-Object triples for a knowledge graph.

TASK: Analyze the following text and extract all factual claims that can be
represented as triples.

===== BEGIN USER TEXT =====
{sanitized user text}
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

Return all valid claims found in the text.
```

## Testing Strategy

### Unit Tests

**File:** `src/services/claim-parser-service.spec.ts`

```typescript
describe('ClaimParserService LLM Integration', () => {
  it('should use LLM when available', async () => {
    const llmService = createMockLLMService();
    llmService.isAvailable.mockReturnValue(true);
    llmService.extractClaims.mockResolvedValue([mockLLMClaim]);

    const parser = new ClaimParserService(plugin, llmService);
    const result = await parser.extractTriple('Einstein created relativity theory');

    expect(result?.pattern).toBe('llm');
    expect(llmService.extractClaims).toHaveBeenCalled();
  });

  it('should fall back to regex when LLM unavailable', async () => {
    const llmService = createMockLLMService();
    llmService.isAvailable.mockReturnValue(false);

    const parser = new ClaimParserService(plugin, llmService);
    const result = await parser.extractTriple('Einstein is a physicist');

    expect(result?.pattern).toBe('is_a');
    expect(llmService.extractClaims).not.toHaveBeenCalled();
  });

  it('should fall back to regex when LLM fails', async () => {
    const llmService = createMockLLMService();
    llmService.isAvailable.mockReturnValue(true);
    llmService.extractClaims.mockRejectedValue(new Error('API error'));

    const parser = new ClaimParserService(plugin, llmService);
    const result = await parser.extractTriple('Einstein is a physicist');

    expect(result?.pattern).toBe('is_a');
  });

  it('should convert LLM results correctly', () => {
    // Test convertLLMResult() mapping
  });

  it('should preserve existing regex patterns', () => {
    // Test all existing regex patterns still work
  });
});
```

### Integration Tests

**File:** `tests/integration/claim-parser-llm.integration.spec.ts`

```typescript
describe('ClaimParserService LLM Integration', () => {
  it('should extract claims using real LLM', async () => {
    // Requires real API key in test environment
    const result = await parser.extractTriple(
      'The Eiffel Tower was built by Gustave Eiffel in 1889'
    );

    expect(result).not.toBeNull();
    expect(result?.pattern).toBe('llm');
    expect(result?.confidence).toBeGreaterThan(0.7);
  });

  it('should handle complex sentences', async () => {
    const result = await parser.extractTriple(
      'Despite numerous challenges, SpaceX successfully launched Starship'
    );

    expect(result).not.toBeNull();
    expect(result?.subject).toContain('SpaceX');
    expect(result?.object).toContain('Starship');
  });

  it('should handle ambiguous entities', async () => {
    const result = await parser.extractTriple(
      'Apple released the iPhone'
    );

    expect(result?.llmMetadata?.subjectDisambiguation).toContain('Inc.');
  });
});
```

### Manual Testing Checklist

**LLM Enabled:**
- [ ] Test simple claim: "Einstein is a physicist"
- [ ] Test complex claim: "Despite challenges, SpaceX launched Starship"
- [ ] Test ambiguous entity: "Apple released iPhone"
- [ ] Test low-quality input: "maybe probably something"
- [ ] Verify confidence scores are reasonable
- [ ] Check LLM metadata is populated
- [ ] Verify cost tracking updates

**LLM Disabled:**
- [ ] Disable LLM in settings
- [ ] Verify regex patterns still work
- [ ] Test all original patterns (is_a, has, uses, etc.)
- [ ] Confirm no errors when LLM unavailable

**Error Handling:**
- [ ] Remove API key, verify graceful fallback
- [ ] Simulate network error, verify fallback
- [ ] Exceed rate limit, verify fallback
- [ ] Test with invalid API key

## Backward Compatibility

### Breaking Changes: None
- Method signature changes from sync to async, but callers already await
- Existing regex patterns preserved
- `TripleSuggestion` type extended (not modified)

### Migration Path
- No user action required
- Existing claims unaffected
- Regex continues to work when LLM disabled

### Rollback Plan
If issues arise:
1. Disable LLM in settings (`llm.features.claimExtraction = false`)
2. All extraction falls back to regex
3. No data loss or corruption

## Performance Considerations

### Latency
- **LLM extraction:** ~1-3 seconds (network + inference)
- **Regex extraction:** <1ms
- **User impact:** Slight delay when using LLM, but acceptable for quality improvement

### Cost
- **Average claim extraction:** ~200 input tokens, ~400 output tokens
- **Anthropic Claude Haiku:** $0.00024 per extraction
- **OpenAI GPT-4o-mini:** $0.00009 per extraction
- **Monthly estimate (100 claims):** $0.009 - $0.024

### Caching
- LLM results are cached for 24 hours (implemented in Plan 006-2a)
- Identical text inputs reuse cached results
- No redundant API calls for repeated extractions

## User Experience

### When LLM Enabled
1. User selects text and runs "Create Claim" command
2. Plugin shows loading indicator
3. LLM extracts triple (1-3 seconds)
4. ClaimModal opens with pre-filled fields
5. (Optional) Confidence badge and reasoning shown
6. User can edit or publish

### When LLM Disabled
1. User selects text and runs "Create Claim" command
2. Regex extracts triple instantly
3. ClaimModal opens with pre-filled fields
4. No LLM metadata or confidence indicators
5. User can edit or publish

### Error Handling
- LLM failures are silent (fall back to regex)
- Budget exceeded: Show warning, fall back to regex
- Network error: Fall back to regex
- No API key: Use regex (no error shown)

## Acceptance Criteria

### Functionality
- [ ] `ClaimParserService.extractTriple()` tries LLM first
- [ ] LLM results are converted to `TripleSuggestion` format
- [ ] Regex fallback works when LLM unavailable
- [ ] LLM failures don't crash the plugin
- [ ] Confidence scores are reasonable (0.0 - 1.0)
- [ ] `llmMetadata` is populated correctly
- [ ] Existing regex patterns still work
- [ ] Method is properly async

### User Experience
- [ ] LLM extraction feels responsive (1-3s)
- [ ] No noticeable delay when LLM disabled
- [ ] Error messages are clear (if any shown)
- [ ] Confidence indicators are helpful (if implemented)
- [ ] Reasoning text is understandable (if shown)
- [ ] Warnings are actionable (if shown)

### Code Quality
- [ ] Unit tests cover both LLM and regex paths
- [ ] Integration tests validate real LLM calls
- [ ] Error handling is comprehensive
- [ ] Code follows existing style conventions
- [ ] Type definitions are complete
- [ ] Documentation is updated

### Backward Compatibility
- [ ] No breaking changes to public API
- [ ] Existing claims still work
- [ ] Regex patterns preserved
- [ ] Plugin works when LLM disabled

## Deployment Checklist

1. **Code Review**
   - [ ] All files modified as planned
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] No console.log statements

2. **Testing**
   - [ ] Manual testing with LLM enabled
   - [ ] Manual testing with LLM disabled
   - [ ] Error handling tested
   - [ ] Performance acceptable

3. **Documentation**
   - [ ] Update README.md with LLM features
   - [ ] Add user guide for LLM settings
   - [ ] Document cost implications

4. **Release**
   - [ ] Update version number
   - [ ] Add to CHANGELOG.md
   - [ ] Tag release in git

## Next Steps

After completing Plan 006-2b:
1. **Gather user feedback** on LLM extraction quality
2. **Monitor costs** and usage patterns
3. **Move to Plan 007** (Publishing Flow) instead of advanced features
4. **Defer Plan 013** (Advanced Features) for future consideration

## Notes

- UI enhancements (confidence badges, reasoning, warnings) are optional
- Keep ClaimModal simple for initial release
- Focus on reliability and fallback behavior
- Advanced features (batch analysis, entity disambiguation) are out of scope
- Cost tracking is already implemented in Plan 006-2a
