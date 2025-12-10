# Plan 006-3b: Apply Suggestion Button

## Status
📋 Ready for Implementation

## Overview
Add a one-click "Apply Suggestion" button to apply LLM's suggested improvement to all three triple fields at once.

## Problem Statement
Currently, when LLM extracts a claim and provides a `suggestedImprovement`:
1. Improvement text is displayed in LLM metadata section
2. User reads: "Suggested improvement: Albert Einstein created the theory of relativity"
3. User must **manually**:
   - Parse the improvement mentally
   - Search for "Albert Einstein" in Subject field
   - Search for "created" in Predicate field
   - Search for "theory of relativity" in Object field
4. This is tedious and error-prone

**From Plan 006 UX Spec (lines 556-567):**
> On "Apply Suggestion" click:
> 1. Parse improvement string into S-P-O components
> 2. Update all three fields
> 3. Trigger new existence check
> 4. Clear the suggestion (it's now applied)

## User Experience Goal

### Current Flow (Manual)
```
1. LLM suggests: "Albert Einstein created general relativity"
2. User reads improvement
3. User manually searches and selects each atom (3 actions)
4. Total time: ~30 seconds
```

### New Flow (One-Click Apply)
```
1. LLM suggests: "Albert Einstein created general relativity"
2. User clicks [Apply Suggestion] button
3. All three fields update instantly
4. Existence check runs automatically
5. Total time: ~2 seconds
```

## Acceptance Criteria

### Must Have
1. ✅ "Apply Suggestion" button appears when `suggestedImprovement` exists
2. ✅ Button parses improvement into Subject/Predicate/Object components
3. ✅ Button updates all three AtomSearchInput fields
4. ✅ Existence check runs automatically after apply
5. ✅ Button disappears after being clicked (suggestion consumed)
6. ✅ User can still manually edit fields after applying

### Should Have
7. ✅ Button shows loading state while applying ("Applying...")
8. ✅ Error handling if parsing fails (show warning, don't apply)
9. ✅ Undo functionality (optional - fields are editable anyway)

### Nice to Have
10. ⭐ Keyboard shortcut (Cmd/Ctrl+Enter to apply)
11. ⭐ Animation when fields update
12. ⭐ Confirmation if user has already started editing

## Technical Design

### 1. Parsing Strategy

**Challenge:** `suggestedImprovement` is a free-form string, not structured data.

**Examples:**
- "Albert Einstein created the theory of relativity"
- "Bitcoin → invented by → Satoshi Nakamoto"
- "SpaceX (company) launched Starship (spacecraft)"

**Parsing Approaches:**

#### Option A: Regex-Based Splitting
Use predicate as anchor point:
```typescript
function parseSuggestion(suggestion: string, originalPredicate: string): TripleComponents | null {
    // Try to split on known predicates (created, is, has, uses, etc.)
    const predicates = ['created', 'is a', 'is', 'has', 'uses', 'founded', 'developed'];

    for (const pred of predicates) {
        const regex = new RegExp(`^(.+?)\\s+${pred}\\s+(.+)$`, 'i');
        const match = suggestion.match(regex);

        if (match) {
            return {
                subject: match[1].trim(),
                predicate: pred,
                object: match[2].trim()
            };
        }
    }

    return null;
}
```

**Pros:** Fast, no LLM call needed
**Cons:** Brittle, may fail on complex improvements

#### Option B: Re-extract with LLM
Call `extractClaims()` on the improvement string:
```typescript
async function parseSuggestion(suggestion: string): Promise<TripleComponents | null> {
    const result = await llmService.extractClaims(suggestion);
    if (result.claims.length > 0) {
        const claim = result.claims[0];
        return {
            subject: claim.subject.text,
            predicate: claim.predicate.text,
            object: claim.object.text
        };
    }
    return null;
}
```

**Pros:** Robust, handles all improvements correctly
**Cons:** Costs another LLM call, slower

#### **Recommended: Hybrid Approach**
1. Try regex parsing first (instant)
2. If parsing fails AND LLM is available → re-extract
3. If both fail → show error, don't apply

### 2. AtomSearchInput Integration

**Challenge:** AtomSearchInput expects user to search and select atoms. We need to programmatically set values.

**Solution:** Add `setValue()` method to `AtomSearchInput`:

**File:** `src/ui/components/atom-search-input.ts`

```typescript
export class AtomSearchInput {
    // ... existing code ...

    /**
     * Programmatically set the input value
     * Triggers search and auto-selects first match if available
     * If no match, creates new atom with the label
     */
    async setValue(label: string): Promise<void> {
        // Set input text
        this.inputEl.value = label;

        // Trigger search
        await this.performSearch(label);

        // Auto-select first result if available
        if (this.state.results.length > 0) {
            this.selectResult(0);
        } else {
            // No existing atom, create new one
            this.createNewAtom(label);
        }
    }
}
```

### 3. Apply Suggestion Flow

**File:** `src/ui/modals/claim-modal.ts`

```typescript
/**
 * Apply LLM's suggested improvement to all fields
 */
private async applySuggestion(suggestion: TripleSuggestion): Promise<void> {
    if (!suggestion.llmMetadata?.suggestedImprovement) {
        return;
    }

    // Show loading state on button
    const applyButton = this.llmMetadataEl?.querySelector('.apply-suggestion-btn') as HTMLButtonElement;
    if (applyButton) {
        applyButton.disabled = true;
        applyButton.setText('Applying...');
    }

    try {
        // Parse suggestion into components
        const components = await this.parseSuggestion(
            suggestion.llmMetadata.suggestedImprovement,
            suggestion.predicate
        );

        if (!components) {
            throw new Error('Failed to parse suggestion');
        }

        // Apply to all three fields
        await this.subjectSearch.setValue(components.subject);
        await this.predicateSearch.setValue(components.predicate);
        await this.objectSearch.setValue(components.object);

        // Hide suggestion UI (it's been applied)
        if (this.llmMetadataEl) {
            const improvementEl = this.llmMetadataEl.querySelector('.llm-improvement');
            improvementEl?.remove();
        }

        // Trigger validation and existence check
        this.validateDraft();
        await this.checkIfClaimExists();

        this.plugin.noticeManager.success('Suggestion applied successfully');

    } catch (error) {
        this.plugin.noticeManager.error('Failed to apply suggestion');
        console.error('Apply suggestion error:', error);

        // Reset button
        if (applyButton) {
            applyButton.disabled = false;
            applyButton.setText('Apply Suggestion');
        }
    }
}

/**
 * Parse suggestion string into triple components
 */
private async parseSuggestion(
    suggestion: string,
    originalPredicate: string
): Promise<{ subject: string; predicate: string; object: string } | null> {
    // Try regex parsing first (fast)
    const regexResult = this.parseSuggestionRegex(suggestion, originalPredicate);
    if (regexResult) {
        return regexResult;
    }

    // Fallback: Re-extract with LLM if available
    if (this.plugin.settings.llm.enabled && this.plugin.llmService.isUnlocked()) {
        try {
            const extracted = await this.plugin.llmService.extractClaims(suggestion);
            if (extracted.length > 0) {
                const claim = extracted[0];
                return {
                    subject: claim.subject.text,
                    predicate: claim.predicate.text,
                    object: claim.object.text
                };
            }
        } catch (error) {
            console.debug('LLM re-extraction failed:', error);
        }
    }

    return null;
}

/**
 * Parse suggestion using regex patterns
 */
private parseSuggestionRegex(
    suggestion: string,
    originalPredicate: string
): { subject: string; predicate: string; object: string } | null {
    // Common predicates to try
    const predicates = [
        'created', 'developed', 'founded', 'built', 'invented',
        'is a', 'is an', 'is',
        'has', 'uses', 'contains',
        'launched', 'released', 'published'
    ];

    // Try original predicate first
    predicates.unshift(originalPredicate);

    for (const pred of predicates) {
        const pattern = new RegExp(`^(.+?)\\s+${pred}\\s+(.+)$`, 'i');
        const match = suggestion.match(pattern);

        if (match) {
            return {
                subject: match[1].trim(),
                predicate: pred,
                object: match[2].trim()
            };
        }
    }

    return null;
}
```

### 4. UI Rendering

Update `renderLLMMetadata()` to add Apply button:

```typescript
private renderLLMMetadata(suggestion: TripleSuggestion): void {
    // ... existing metadata rendering ...

    // Suggested improvement with Apply button
    if (metadata.suggestedImprovement) {
        const improvementEl = this.llmMetadataEl.createDiv({
            cls: 'llm-improvement'
        });

        improvementEl.createEl('strong', {
            text: 'Suggested improvement:'
        });

        const suggestionText = improvementEl.createEl('p', {
            text: metadata.suggestedImprovement
        });
        suggestionText.style.marginBottom = '8px';

        // Apply button
        const applyButton = improvementEl.createEl('button', {
            text: 'Apply Suggestion',
            cls: 'apply-suggestion-btn mod-cta'
        });

        applyButton.addEventListener('click', () => {
            this.applySuggestion(suggestion);
        });
    }

    // ... rest of metadata ...
}
```

### 5. CSS Styling

**File:** `styles.css`

```css
/* Apply Suggestion button */
.llm-improvement {
    padding: 12px;
    margin-top: 8px;
    background: var(--background-secondary);
    border-radius: 4px;
    border-left: 3px solid var(--interactive-accent);
}

.llm-improvement strong {
    display: block;
    margin-bottom: 4px;
    color: var(--text-normal);
}

.llm-improvement p {
    color: var(--text-muted);
    font-style: italic;
    margin: 4px 0;
}

.apply-suggestion-btn {
    margin-top: 8px;
    padding: 6px 12px;
    font-size: 13px;
}

.apply-suggestion-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
```

## Testing

### Unit Tests

**File:** `src/ui/modals/claim-modal.spec.ts`

```typescript
describe('ClaimModal - Apply Suggestion', () => {
    it('should parse simple suggestions with regex', () => {
        const modal = new ClaimModal(/*...*/);
        const result = modal.parseSuggestionRegex(
            'Albert Einstein created the theory of relativity',
            'created'
        );

        expect(result).toEqual({
            subject: 'Albert Einstein',
            predicate: 'created',
            object: 'the theory of relativity'
        });
    });

    it('should handle "is a" predicates', () => {
        const result = modal.parseSuggestionRegex(
            'Bitcoin is a cryptocurrency',
            'is'
        );

        expect(result).toEqual({
            subject: 'Bitcoin',
            predicate: 'is a',
            object: 'cryptocurrency'
        });
    });

    it('should return null for unparseable suggestions', () => {
        const result = modal.parseSuggestionRegex(
            'This is not a valid triple structure',
            'invalid'
        );

        expect(result).toBeNull();
    });

    it('should update all three fields when applied', async () => {
        const modal = new ClaimModal(/*...*/);
        modal.onOpen();

        const suggestion: TripleSuggestion = {
            subject: 'Einstein',
            predicate: 'created',
            object: 'relativity',
            confidence: 0.9,
            pattern: 'llm',
            llmMetadata: {
                suggestedImprovement: 'Albert Einstein created general relativity',
                // ... other metadata ...
            }
        };

        await modal.applySuggestion(suggestion);

        expect(modal.draft.subject?.label).toBe('Albert Einstein');
        expect(modal.draft.predicate?.label).toBe('created');
        expect(modal.draft.object?.label).toBe('general relativity');
    });
});
```

### Manual Testing Scenarios

**Scenario 1: Simple Improvement**
1. Select text: "Einstein made relativity"
2. Open modal
3. LLM suggests: "Albert Einstein created the theory of relativity"
4. Click [Apply Suggestion]
5. **Expected:**
   - Subject field updates to "Albert Einstein"
   - Predicate field updates to "created"
   - Object field updates to "theory of relativity"
   - Existence check runs
   - Apply button disappears

**Scenario 2: Improvement with Existing Atoms**
1. Select text: "Bitcoin is money"
2. LLM suggests: "Bitcoin is a cryptocurrency"
3. Click [Apply Suggestion]
4. **Expected:**
   - Subject searches for "Bitcoin" → finds existing atom
   - Predicate searches for "is a" → finds existing atom
   - Object searches for "cryptocurrency" → finds existing atom
   - Status updates to EXISTS (if triple exists)

**Scenario 3: Parsing Failure**
1. Select text with complex improvement: "The relationship between A, B, and C is complicated"
2. Click [Apply Suggestion]
3. **Expected:**
   - Error notice: "Failed to apply suggestion"
   - Fields remain unchanged
   - Button re-enables

## Edge Cases

### 1. User Edits Fields Before Applying
- **Behavior:** Show confirmation modal: "Applying will replace your current edits. Continue?"
- **Implementation:** Check if any fields are non-empty before applying

### 2. Suggestion Contains Parenthetical Info
- Example: "SpaceX (company) launched Starship (spacecraft)"
- **Solution:** Strip parentheticals in parsing: `text.replace(/\s*\([^)]*\)/g, '')`

### 3. LLM Suggests Same as Original
- **Behavior:** Button still appears but is labeled "Apply (no changes)"
- **Result:** Clicking does nothing, just hides button

### 4. Multiple Predicates in Suggestion
- Example: "Einstein was born in Germany and created relativity"
- **Solution:** Parse only first valid triple, show warning about multiple claims

## Implementation Checklist

- [ ] Add `setValue(label)` method to `AtomSearchInput`
- [ ] Add `applySuggestion(suggestion)` method to `ClaimModal`
- [ ] Add `parseSuggestion()` method (hybrid approach)
- [ ] Add `parseSuggestionRegex()` method
- [ ] Update `renderLLMMetadata()` to show Apply button
- [ ] Add CSS styles for improvement section and button
- [ ] Add loading state to button during apply
- [ ] Add error handling for parse failures
- [ ] Write unit tests for parsing logic
- [ ] Write integration tests for full apply flow
- [ ] Manual testing for all scenarios

## Files to Modify

### Core Changes
- `src/ui/components/atom-search-input.ts` - Add `setValue()` method (~30 lines)
- `src/ui/modals/claim-modal.ts` - Add apply logic (~100 lines)
- `styles.css` - Add improvement UI styles (~30 lines)

### Testing
- `src/ui/modals/claim-modal.spec.ts` - Add apply tests (~80 lines)
- `src/ui/components/atom-search-input.spec.ts` - Add setValue tests (~40 lines)

## Estimated Complexity
**Medium** - Requires parsing logic and AtomSearchInput integration

## Success Metrics
1. Users can apply suggestions with one click
2. 90%+ of suggestions parse correctly with regex
3. LLM fallback handles complex cases
4. Time to apply improvements reduced from ~30s to ~2s

## Future Enhancements
1. Show diff preview before applying (what will change)
2. Allow partial application (apply only subject, keep rest)
3. History/undo stack for applied suggestions
4. Keyboard shortcut (Cmd/Ctrl+Enter)
