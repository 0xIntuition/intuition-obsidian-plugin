# Plan 006-3c: Predicate Alternatives UI

## Status
📋 Ready for Implementation

## Overview
Add clickable predicate alternative pills below the predicate field, allowing users to quickly swap predicates without manual searching.

## Problem Statement
When LLM extracts a claim, it provides `predicateAlternatives` in the metadata:
```typescript
{
  predicate: { text: 'created', alternatives: ['developed', 'formulated', 'authored'] },
  // ...
}
```

Currently:
1. Alternatives are in the data model but **not displayed** in the UI
2. Users must manually search for alternative predicates
3. No visual indication that better predicates might exist

**From Plan 006 UX Spec (lines 569-580):**
> Show alternatives as clickable pills below predicate field
> ```
> Predicate: [created                       ▼]
>            Alternatives: [developed] [formulated] [authored]
> ```
> Click alternative → updates predicate field → triggers existence check

## User Experience Goal

### Current Flow (Manual)
```
1. LLM extracts: predicate = "created"
2. User wonders: "Is there a better verb?"
3. User manually searches for "developed", "formulated", etc.
4. Total time: ~20 seconds per alternative
```

### New Flow (Clickable Pills)
```
1. LLM extracts: predicate = "created"
2. User sees pills: [developed] [formulated] [authored]
3. User clicks "developed" → Predicate field updates
4. Existence check runs automatically
5. Total time: ~1 second
```

## Acceptance Criteria

### Must Have
1. ✅ Predicate alternatives displayed as clickable pills below predicate field
2. ✅ Pills only appear when LLM metadata includes alternatives
3. ✅ Clicking pill updates predicate field value
4. ✅ Existence check runs automatically after click
5. ✅ Current predicate is visually distinguished (if it's in alternatives list)

### Should Have
6. ✅ Pills have hover state for discoverability
7. ✅ Maximum 5 alternatives shown (avoid clutter)
8. ✅ Pills sorted by relevance/likelihood (if confidence scores available)

### Nice to Have
9. ⭐ "Show more" if >5 alternatives exist
10. ⭐ Pill shows confidence/score on hover
11. ⭐ Animation when predicate changes

## Technical Design

### 1. Data Flow

**Current State:**
```typescript
// LLM returns alternatives in ExtractedClaimLLM
{
  predicate: {
    text: 'created',
    normalized: 'created',
    alternatives: ['developed', 'formulated', 'authored']
  }
}

// This gets mapped to TripleSuggestion.llmMetadata.predicateAlternatives
{
  predicateAlternatives: ['developed', 'formulated', 'authored']
}
```

**No changes needed to data model** - alternatives already flow through correctly.

### 2. UI Implementation

**File:** `src/ui/modals/claim-modal.ts`

#### 2.1 Store Current Suggestion
Add property to track suggestion for alternative clicks:
```typescript
export class ClaimModal extends Modal {
    // ... existing properties ...

    // Track current suggestion for predicate alternatives
    private currentSuggestion: TripleSuggestion | null = null;
}
```

#### 2.2 Render Predicate Alternatives
Add new method to render pills:
```typescript
/**
 * Render predicate alternatives as clickable pills
 */
private renderPredicateAlternatives(alternatives: string[]): void {
    // Clear existing alternatives
    const existingAlts = this.tripleInputsEl.querySelector('.predicate-alternatives');
    if (existingAlts) {
        existingAlts.remove();
    }

    // Only show if we have alternatives
    if (!alternatives || alternatives.length === 0) {
        return;
    }

    // Find the predicate field container
    const predicateField = this.tripleInputsEl.querySelector('.claim-field:nth-child(2)');
    if (!predicateField) return;

    // Create alternatives container
    const altContainer = predicateField.createDiv({
        cls: 'predicate-alternatives'
    });

    altContainer.createSpan({
        text: 'Alternatives: ',
        cls: 'alternatives-label'
    });

    const pillsContainer = altContainer.createDiv({
        cls: 'alternatives-pills'
    });

    // Limit to 5 alternatives
    const maxAlternatives = 5;
    const displayAlternatives = alternatives.slice(0, maxAlternatives);

    // Render each alternative as a pill
    displayAlternatives.forEach(alt => {
        const pill = pillsContainer.createEl('button', {
            text: alt,
            cls: 'predicate-pill'
        });

        pill.addEventListener('click', () => {
            this.selectPredicateAlternative(alt);
        });
    });

    // Show "more" indicator if truncated
    if (alternatives.length > maxAlternatives) {
        const moreText = altContainer.createSpan({
            text: `+${alternatives.length - maxAlternatives} more`,
            cls: 'alternatives-more'
        });
        moreText.style.fontSize = '12px';
        moreText.style.color = 'var(--text-muted)';
    }
}

/**
 * Handle clicking a predicate alternative
 */
private async selectPredicateAlternative(predicate: string): Promise<void> {
    try {
        // Update predicate field
        await this.predicateSearch.setValue(predicate);

        // Trigger validation and existence check
        this.validateDraft();
        await this.checkIfClaimExists();

        // Show feedback
        this.plugin.noticeManager.success(`Predicate updated to "${predicate}"`);

    } catch (error) {
        this.plugin.noticeManager.error('Failed to update predicate');
        console.error('Predicate alternative error:', error);
    }
}
```

#### 2.3 Update LLM Metadata Rendering
Modify `renderLLMMetadata()` to call alternatives renderer:
```typescript
private renderLLMMetadata(suggestion: TripleSuggestion): void {
    if (!suggestion.llmMetadata) return;

    // Store suggestion for later use
    this.currentSuggestion = suggestion;

    const metadata = suggestion.llmMetadata;

    // ... existing metadata rendering ...

    // Render predicate alternatives (after triple inputs)
    if (metadata.predicateAlternatives && metadata.predicateAlternatives.length > 0) {
        this.renderPredicateAlternatives(metadata.predicateAlternatives);
    }
}
```

#### 2.4 Update Auto-Extract Flow
Ensure alternatives render after extraction:
```typescript
private async autoExtract(): Promise<void> {
    try {
        const suggestion = await this.plugin.claimParserService.extractTriple(
            this.selectedText
        );

        this.hideLoadingIndicator();

        if (!suggestion || suggestion.confidence < ClaimModal.MIN_AUTO_SUGGESTION_CONFIDENCE) {
            return;
        }

        // Show notice
        // ...

        // Render LLM metadata (includes alternatives)
        if (suggestion.pattern === 'llm' && suggestion.llmMetadata) {
            this.renderLLMMetadata(suggestion);
        }

    } catch (error) {
        console.debug('Auto-extraction failed:', error);
        this.hideLoadingIndicator();
    }
}
```

### 3. CSS Styling

**File:** `styles.css`

```css
/* Predicate Alternatives Pills */
.predicate-alternatives {
    margin-top: 8px;
    padding: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.alternatives-label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
}

.alternatives-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.predicate-pill {
    padding: 4px 12px;
    font-size: 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.15s ease;
}

.predicate-pill:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    transform: translateY(-1px);
}

.predicate-pill:active {
    transform: translateY(0);
}

.predicate-pill.is-selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    font-weight: 500;
}

.alternatives-more {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
}
```

### 4. Enhanced Features (Optional)

#### 4.1 Highlight Current Predicate
Show which alternative is currently selected:
```typescript
private renderPredicateAlternatives(alternatives: string[]): void {
    // ... existing code ...

    displayAlternatives.forEach(alt => {
        const pill = pillsContainer.createEl('button', {
            text: alt,
            cls: 'predicate-pill'
        });

        // Highlight if this is the current predicate
        if (this.draft.predicate?.label === alt) {
            pill.addClass('is-selected');
        }

        pill.addEventListener('click', () => {
            this.selectPredicateAlternative(alt);
        });
    });
}
```

#### 4.2 Show Confidence on Hover (Future)
If LLM provides confidence scores per alternative:
```typescript
const pill = pillsContainer.createEl('button', {
    text: alt,
    cls: 'predicate-pill'
});

// Add confidence tooltip if available
if (altWithConfidence) {
    pill.setAttribute('aria-label', `Confidence: ${Math.round(conf * 100)}%`);
}
```

## Testing

### Unit Tests

**File:** `src/ui/modals/claim-modal.spec.ts`

```typescript
describe('ClaimModal - Predicate Alternatives', () => {
    it('should render alternatives as pills when LLM metadata exists', () => {
        const modal = new ClaimModal(/*...*/);
        modal.onOpen();

        const suggestion: TripleSuggestion = {
            subject: 'Bitcoin',
            predicate: 'is',
            object: 'cryptocurrency',
            confidence: 0.9,
            pattern: 'llm',
            llmMetadata: {
                predicateAlternatives: ['represents', 'functions as', 'serves as'],
                // ... other metadata ...
            }
        };

        modal.renderLLMMetadata(suggestion);

        const pills = modal.contentEl.querySelectorAll('.predicate-pill');
        expect(pills.length).toBe(3);
        expect(pills[0].textContent).toBe('represents');
        expect(pills[1].textContent).toBe('functions as');
        expect(pills[2].textContent).toBe('serves as');
    });

    it('should not render alternatives if none exist', () => {
        const modal = new ClaimModal(/*...*/);
        modal.onOpen();

        const suggestion: TripleSuggestion = {
            subject: 'Bitcoin',
            predicate: 'is',
            object: 'cryptocurrency',
            confidence: 0.9,
            pattern: 'llm',
            llmMetadata: {
                predicateAlternatives: [],
                // ... other metadata ...
            }
        };

        modal.renderLLMMetadata(suggestion);

        const pills = modal.contentEl.querySelectorAll('.predicate-pill');
        expect(pills.length).toBe(0);
    });

    it('should limit to 5 alternatives', () => {
        const modal = new ClaimModal(/*...*/);
        modal.onOpen();

        const suggestion: TripleSuggestion = {
            // ... with 10 alternatives ...
            llmMetadata: {
                predicateAlternatives: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
            }
        };

        modal.renderLLMMetadata(suggestion);

        const pills = modal.contentEl.querySelectorAll('.predicate-pill');
        expect(pills.length).toBe(5);

        const moreText = modal.contentEl.querySelector('.alternatives-more');
        expect(moreText?.textContent).toContain('+5 more');
    });

    it('should update predicate field when pill is clicked', async () => {
        const modal = new ClaimModal(/*...*/);
        modal.onOpen();

        // Render alternatives
        modal.renderPredicateAlternatives(['developed', 'created', 'built']);

        // Click second pill
        const pills = modal.contentEl.querySelectorAll('.predicate-pill');
        (pills[1] as HTMLButtonElement).click();

        await waitForAsync();

        expect(modal.draft.predicate?.label).toBe('created');
    });

    it('should trigger existence check after selecting alternative', async () => {
        const modal = new ClaimModal(/*...*/);
        const checkSpy = vi.spyOn(modal, 'checkIfClaimExists');

        modal.onOpen();
        modal.renderPredicateAlternatives(['developed']);

        const pill = modal.contentEl.querySelector('.predicate-pill') as HTMLButtonElement;
        pill.click();

        await waitForAsync();

        expect(checkSpy).toHaveBeenCalled();
    });
});
```

### Manual Testing Scenarios

**Scenario 1: LLM Provides Alternatives**
1. Enable LLM in settings
2. Select text: "Einstein made relativity"
3. Open Claim Modal
4. **Expected:**
   - LLM extracts predicate: "made"
   - Pills appear: [created] [developed] [formulated]
   - Pills are clickable and styled

**Scenario 2: Click Alternative**
1. Continue from Scenario 1
2. Click [created] pill
3. **Expected:**
   - Predicate field updates to "created"
   - Existence check runs (status updates)
   - Success notice: "Predicate updated to 'created'"
   - Pill highlights to show selection

**Scenario 3: No Alternatives Available**
1. Select text: "Bitcoin is a cryptocurrency"
2. Open Claim Modal
3. **Expected:**
   - If LLM doesn't provide alternatives, no pills shown
   - Predicate field still editable normally

**Scenario 4: Many Alternatives (>5)**
1. Mock LLM to return 10 alternatives
2. Open Claim Modal
3. **Expected:**
   - Only 5 pills shown
   - "+5 more" text appears
   - No layout overflow

## Edge Cases

### 1. Alternative Already Selected
- **Behavior:** Pill is highlighted with `.is-selected` class
- **Result:** Clicking it again does nothing (no-op)

### 2. User Manually Changes Predicate
- **Behavior:** Pills remain visible but selection highlight updates
- **Result:** User can still click pills to revert

### 3. Alternative Not in Atom Database
- **Behavior:** `setValue()` creates new atom
- **Result:** Field shows new label, status becomes NEW

### 4. Network Error During Update
- **Behavior:** Show error notice, field reverts
- **Result:** Pills remain clickable for retry

## Implementation Checklist

- [ ] Add `currentSuggestion` property to `ClaimModal`
- [ ] Implement `renderPredicateAlternatives(alternatives)` method
- [ ] Implement `selectPredicateAlternative(predicate)` method
- [ ] Update `renderLLMMetadata()` to call alternatives renderer
- [ ] Add CSS styles for pills and container
- [ ] Add hover/active states for pills
- [ ] Add `.is-selected` styling for current predicate
- [ ] Implement 5-alternative limit with "+N more" text
- [ ] Write unit tests for rendering logic
- [ ] Write unit tests for selection behavior
- [ ] Manual testing for all scenarios

## Files to Modify

### Core Changes
- `src/ui/modals/claim-modal.ts` - Add alternatives rendering (~80 lines)
- `styles.css` - Add pill styles (~60 lines)

### Testing
- `src/ui/modals/claim-modal.spec.ts` - Add alternatives tests (~100 lines)

## Estimated Complexity
**Medium** - Requires UI rendering and field integration

## Success Metrics
1. Users discover alternative predicates without searching
2. Click-to-apply reduces time from ~20s to ~1s
3. Alternatives are visually discoverable (clear affordance)
4. No performance impact from rendering pills

## Future Enhancements
1. "Show all" expansion for >5 alternatives
2. Confidence scores on hover tooltips
3. Sort alternatives by semantic similarity
4. Allow drag-and-drop to reorder alternatives
5. Add alternatives for subject/object (if LLM provides them)
