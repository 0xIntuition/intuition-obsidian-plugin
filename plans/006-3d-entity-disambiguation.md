# Plan 006-3d: Entity Disambiguation (Search + Badge)

## Status
📋 Ready for Implementation

## Overview
Add entity disambiguation to help users select the correct atom when names are ambiguous (e.g., "Apple" the company vs. "Apple" the fruit).

## Problem Statement
**Ambiguous entities** are common in knowledge graphs:
- "Apple" → Apple Inc. (company) vs. apple (fruit)
- "Jordan" → Michael Jordan (person) vs. Jordan (country)
- "Mercury" → element vs. planet vs. Roman god
- "Amazon" → company vs. rainforest vs. river

Currently:
1. Atom search returns all matches with no disambiguation
2. User must guess which is correct based on truncated IDs
3. No LLM guidance on which entity makes sense in context

**User Selected Priority:** "Both - in search AND as badge"

## User Experience Goal

### Current Flow (No Disambiguation)
```
User types: "Apple"
Search results:
  - Apple Inc. (0x1234...abcd)
  - Apple (0x5678...efgh)
  - Apple Computer (0x9abc...def0)

User thinks: "Which one? 🤔"
User guesses → 33% chance of wrong selection
```

### New Flow (With Disambiguation)
```
User types: "Apple"
Search results:
  - 🤖 AI suggests: Apple Inc. (Technology company)
  - Apple Inc. (Organization) ✓
  - Apple (Fruit)
  - Apple Computer (Historical name)

User sees badge after selection:
  Subject: [Apple Inc. ▼]  Organization 95%

User thinks: "Ah, the company. Correct!" ✓
```

## Acceptance Criteria

### Must Have (Search Dropdown)
1. ✅ When LLM detects ambiguous entity, show "AI suggests" result first
2. ✅ Disambiguation text appears in search results (e.g., "Technology company")
3. ✅ Entity type shown for all results (Person, Organization, Concept, etc.)
4. ✅ LLM suggestion visually distinguished (icon, bold, color)

### Must Have (Selected Atom Badge)
5. ✅ After atom selection, show entity type badge next to field
6. ✅ Badge shows type + confidence (e.g., "Person 92%")
7. ✅ Badge color-coded by confidence (green ≥80%, yellow ≥50%, red <50%)
8. ✅ Badge is subtle and doesn't clutter UI

### Should Have
9. ✅ Disambiguation persists in `AtomReference` data model
10. ✅ Badge clickable to show full entity details (optional tooltip)

### Nice to Have
11. ⭐ Badge shows warning icon if confidence <50%
12. ⭐ "Did you mean?" suggestions if user selects low-confidence atom

## Technical Design

### Challenge: Where Does Disambiguation Come From?

**Current State:**
- `AtomSearchInput` queries `IntuitionService.searchAtoms()` and `semanticSearchAtoms()`
- GraphQL returns basic atom data: `{ termId, label, type, emoji, description }`
- **No entity disambiguation** in GraphQL responses

**Three Approaches:**

#### Option A: LLM Disambiguates on Search (Real-Time)
When user types "Apple":
1. `AtomSearchInput` calls `LLMService.disambiguateEntity('Apple', context)`
2. LLM returns: `{ suggestedId, type: 'organization', reasoning: 'Technology company' }`
3. Search results re-ordered to prioritize suggestion

**Pros:** Always accurate, context-aware
**Cons:** Costs LLM call per search, slow (1-2s), budget impact

#### Option B: Use Cached LLM Metadata from Extraction
When claim is extracted:
1. LLM already detected entity types in `extractClaims()`
2. Store entity metadata in `TripleSuggestion.llmMetadata`
3. When user opens search, pre-populate with LLM's entity type

**Pros:** No extra LLM calls, instant, already implemented
**Cons:** Only works if user doesn't change extraction, no help for manual entry

#### Option C: Hybrid Approach (Recommended)
1. **If LLM extraction succeeded:** Use cached entity types from metadata
2. **If user manually searches:** Show entity type from GraphQL (if available)
3. **If still ambiguous AND LLM enabled:** Lazy-load disambiguation on hover/selection

**Pros:** Balances cost, speed, and accuracy
**Cons:** More complex logic

### Recommended Implementation: Option C (Hybrid)

---

## Implementation Plan

### Phase 1: Extend Data Model

#### 1.1 Add Disambiguation to `AtomReference`

**File:** `src/types/search.ts`

```typescript
export interface AtomReference {
    type: 'existing' | 'new';
    termId?: string;
    label: string;
    emoji?: string;

    // NEW: Entity disambiguation
    entityType?: 'person' | 'organization' | 'concept' | 'thing' | 'place' | 'event' | 'unknown';
    disambiguation?: string; // Human-readable clarification
    confidence?: number; // 0-1, how confident this is the right entity
}
```

#### 1.2 Update `TripleSuggestion` Usage

**File:** `src/ui/modals/claim-modal.ts`

When auto-extraction succeeds, pass entity metadata to search inputs:
```typescript
private async autoExtract(): Promise<void> {
    const suggestion = await this.plugin.claimParserService.extractTriple(
        this.selectedText
    );

    if (suggestion?.llmMetadata) {
        // Pre-populate search inputs with LLM entity metadata
        this.subjectSearch.setEntityHint({
            type: suggestion.llmMetadata.subjectType,
            disambiguation: suggestion.llmMetadata.subjectDisambiguation,
            confidence: suggestion.llmMetadata.subjectConfidence
        });

        this.objectSearch.setEntityHint({
            type: suggestion.llmMetadata.objectType,
            disambiguation: suggestion.llmMetadata.objectDisambiguation,
            confidence: suggestion.llmMetadata.objectConfidence
        });
    }
}
```

---

### Phase 2: Update `AtomSearchInput` Component

**File:** `src/ui/components/atom-search-input.ts`

#### 2.1 Add Entity Hint State
```typescript
export class AtomSearchInput {
    // ... existing properties ...

    // Entity hint from LLM (if available)
    private entityHint: {
        type?: string;
        disambiguation?: string;
        confidence?: number;
    } | null = null;

    /**
     * Set entity type hint from LLM extraction
     * This helps prioritize search results
     */
    setEntityHint(hint: { type?: string; disambiguation?: string; confidence?: number }): void {
        this.entityHint = hint;
    }
}
```

#### 2.2 Enhance Search Result Rendering
```typescript
private renderSearchResults(): void {
    // ... existing code ...

    this.state.results.forEach((atom, index) => {
        const resultEl = this.dropdownEl.createDiv({
            cls: 'atom-search-result',
        });

        // Check if this atom matches LLM hint
        const isLLMSuggestion = this.isLLMSuggestion(atom);

        if (isLLMSuggestion) {
            resultEl.addClass('llm-suggested');
            const suggestionBadge = resultEl.createSpan({
                text: '🤖 AI suggests',
                cls: 'llm-suggestion-badge'
            });
        }

        // ... existing label/emoji rendering ...

        // Show entity type (from GraphQL or LLM hint)
        const entityType = this.getEntityType(atom);
        if (entityType) {
            const typeBadge = resultEl.createSpan({
                text: entityType,
                cls: 'entity-type-badge'
            });
        }

        // Show disambiguation if available
        const disambiguation = atom.description || this.entityHint?.disambiguation;
        if (disambiguation) {
            const disambigEl = resultEl.createSpan({
                text: disambiguation,
                cls: 'entity-disambiguation'
            });
        }

        // ... rest of result rendering ...
    });
}

/**
 * Check if atom matches LLM's suggested entity
 */
private isLLMSuggestion(atom: AtomData): boolean {
    if (!this.entityHint) return false;

    // Match by label similarity and type
    const labelMatch = atom.label.toLowerCase() === this.inputEl.value.toLowerCase();
    const typeMatch = this.entityHint.type && atom.type === this.entityHint.type;

    return labelMatch && typeMatch;
}

/**
 * Get entity type display string
 */
private getEntityType(atom: AtomData): string | null {
    // Prefer LLM hint if available
    if (this.entityHint?.type) {
        return this.capitalizeFirst(this.entityHint.type);
    }

    // Fallback to GraphQL type if available
    if (atom.type) {
        return this.capitalizeFirst(atom.type);
    }

    return null;
}
```

#### 2.3 Update Selection Callback
```typescript
private selectResult(index: number): void {
    const atom = this.state.results[index];

    const reference: AtomReference = {
        type: 'existing',
        termId: atom.termId,
        label: atom.label,
        emoji: atom.emoji,

        // Include entity metadata
        entityType: this.entityHint?.type as any,
        disambiguation: this.entityHint?.disambiguation,
        confidence: this.entityHint?.confidence
    };

    this.onSelect(reference);
    this.closeDropdown();
}
```

---

### Phase 3: Add Entity Badge to Claim Modal

**File:** `src/ui/modals/claim-modal.ts`

#### 3.1 Render Entity Badges
```typescript
private renderTripleInputs(): void {
    // ... existing field rendering ...

    // Subject field with badge
    const subjectField = this.tripleInputsEl.createDiv({
        cls: 'claim-field'
    });
    const subjectLabel = subjectField.createDiv({ cls: 'field-label-row' });
    subjectLabel.createEl('label', { text: 'Subject' });
    const subjectBadge = subjectLabel.createSpan({ cls: 'entity-badge' });
    this.subjectBadgeEl = subjectBadge; // Store reference

    const subjectContainer = subjectField.createDiv();
    this.subjectSearch = new AtomSearchInput(
        subjectContainer,
        this.plugin.intuitionService,
        (ref) => {
            this.handleAtomSelection('subject', ref);
            this.updateEntityBadge('subject', ref);
        },
        { placeholder: 'Search or create subject...', allowCreate: true }
    );

    // Repeat for predicate and object...
}

/**
 * Update entity type badge after selection
 */
private updateEntityBadge(
    field: 'subject' | 'predicate' | 'object',
    ref: AtomReference | null
): void {
    const badgeEl = this.getBadgeElement(field);
    if (!badgeEl) return;

    badgeEl.empty();

    if (!ref || !ref.entityType) return;

    // Create badge with type and confidence
    const type = this.capitalizeFirst(ref.entityType);
    const confidence = ref.confidence ? Math.round(ref.confidence * 100) : null;

    const badgeText = confidence
        ? `${type} ${confidence}%`
        : type;

    badgeEl.setText(badgeText);
    badgeEl.addClass('entity-badge-visible');

    // Color-code by confidence
    if (confidence) {
        if (confidence >= 80) {
            badgeEl.addClass('high-confidence');
        } else if (confidence >= 50) {
            badgeEl.addClass('medium-confidence');
        } else {
            badgeEl.addClass('low-confidence');
        }
    }

    // Add tooltip with disambiguation
    if (ref.disambiguation) {
        badgeEl.setAttribute('aria-label', ref.disambiguation);
        badgeEl.setAttribute('title', ref.disambiguation);
    }
}

private getBadgeElement(field: 'subject' | 'predicate' | 'object'): HTMLElement | null {
    if (field === 'subject') return this.subjectBadgeEl;
    if (field === 'predicate') return this.predicateBadgeEl;
    if (field === 'object') return this.objectBadgeEl;
    return null;
}
```

---

### Phase 4: CSS Styling

**File:** `styles.css`

#### 4.1 Search Result Disambiguation
```css
/* LLM Suggestion Badge in Search Results */
.atom-search-result.llm-suggested {
    border-left: 3px solid var(--interactive-accent);
    background: var(--background-secondary-alt);
}

.llm-suggestion-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--interactive-accent);
    margin-right: 6px;
}

/* Entity Type Badge in Search */
.entity-type-badge {
    display: inline-block;
    padding: 2px 6px;
    margin-left: 6px;
    font-size: 10px;
    font-weight: 500;
    border-radius: 3px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
}

/* Entity Disambiguation Text */
.entity-disambiguation {
    display: block;
    font-size: 11px;
    color: var(--text-faint);
    font-style: italic;
    margin-top: 2px;
}
```

#### 4.2 Entity Badge (Selected Atom)
```css
/* Entity Badge Next to Field Label */
.field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.entity-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.entity-badge.entity-badge-visible {
    opacity: 1;
}

.entity-badge.high-confidence {
    background: var(--background-modifier-success);
    color: var(--text-success);
}

.entity-badge.medium-confidence {
    background: var(--background-modifier-warning);
    color: var(--text-warning);
}

.entity-badge.low-confidence {
    background: var(--background-modifier-error);
    color: var(--text-error);
}
```

---

## Testing

### Unit Tests

**File:** `src/ui/components/atom-search-input.spec.ts`

```typescript
describe('AtomSearchInput - Entity Disambiguation', () => {
    it('should prioritize LLM-suggested result', () => {
        const input = new AtomSearchInput(/*...*/);

        input.setEntityHint({
            type: 'organization',
            disambiguation: 'Technology company',
            confidence: 0.95
        });

        input.performSearch('Apple');

        const suggestedResult = input.containerEl.querySelector('.llm-suggested');
        expect(suggestedResult).toBeTruthy();
        expect(suggestedResult?.textContent).toContain('AI suggests');
    });

    it('should show entity type badge in results', () => {
        const input = new AtomSearchInput(/*...*/);
        input.performSearch('Einstein');

        const typeBadge = input.containerEl.querySelector('.entity-type-badge');
        expect(typeBadge?.textContent).toBe('Person');
    });

    it('should include entity metadata in selection', () => {
        const onSelect = vi.fn();
        const input = new AtomSearchInput(containerEl, service, onSelect);

        input.setEntityHint({
            type: 'person',
            confidence: 0.92
        });

        input.performSearch('Einstein');
        input.selectResult(0);

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: 'person',
                confidence: 0.92
            })
        );
    });
});
```

**File:** `src/ui/modals/claim-modal.spec.ts`

```typescript
describe('ClaimModal - Entity Badges', () => {
    it('should show entity badge after atom selection', () => {
        const modal = new ClaimModal(/*...*/);
        modal.onOpen();

        const ref: AtomReference = {
            type: 'existing',
            termId: '0x123',
            label: 'Albert Einstein',
            entityType: 'person',
            confidence: 0.95
        };

        modal.handleAtomSelection('subject', ref);

        const badge = modal.contentEl.querySelector('.entity-badge');
        expect(badge?.textContent).toBe('Person 95%');
        expect(badge?.classList.contains('high-confidence')).toBe(true);
    });

    it('should color-code badge by confidence', () => {
        const modal = new ClaimModal(/*...*/);
        modal.onOpen();

        // High confidence (green)
        modal.updateEntityBadge('subject', {
            type: 'existing',
            label: 'Test',
            entityType: 'person',
            confidence: 0.9
        });
        expect(modal.subjectBadgeEl?.classList.contains('high-confidence')).toBe(true);

        // Medium confidence (yellow)
        modal.updateEntityBadge('subject', {
            type: 'existing',
            label: 'Test',
            entityType: 'concept',
            confidence: 0.6
        });
        expect(modal.subjectBadgeEl?.classList.contains('medium-confidence')).toBe(true);

        // Low confidence (red)
        modal.updateEntityBadge('subject', {
            type: 'existing',
            label: 'Test',
            entityType: 'unknown',
            confidence: 0.3
        });
        expect(modal.subjectBadgeEl?.classList.contains('low-confidence')).toBe(true);
    });
});
```

### Manual Testing Scenarios

**Scenario 1: LLM Disambiguation in Search**
1. Enable LLM
2. Select text: "Apple released iPhone"
3. Open Claim Modal
4. **Expected:**
   - Auto-extraction sets entity hint: Apple = Organization
   - Click Subject field
   - First result: "🤖 AI suggests: Apple Inc. (Technology company)"
   - Other results: "Apple (Fruit)", etc.

**Scenario 2: Entity Badge Display**
1. Continue from Scenario 1
2. Select "Apple Inc." from search
3. **Expected:**
   - Badge appears next to Subject label: "Organization 95%"
   - Badge is green (high confidence)
   - Hover shows tooltip: "Technology company"

**Scenario 3: Low Confidence Warning**
1. Select text: "Mercury is toxic"
2. Open Claim Modal
3. **Expected:**
   - LLM detects "Mercury" but low confidence (element vs. planet?)
   - Badge shows: "Concept 45%" in red/yellow
   - User can manually verify selection

**Scenario 4: Manual Entry (No LLM Hint)**
1. Disable LLM
2. Open Claim Modal
3. Manually search for "Jordan"
4. **Expected:**
   - No "AI suggests" banner
   - Results show entity types if available from GraphQL
   - User selects manually

## Edge Cases

### 1. LLM Hint Doesn't Match Any Atom
- **Behavior:** Show hint as "Create new atom" with disambiguation
- **Result:** User creates new atom "Apple Inc. (Technology company)"

### 2. Multiple Atoms Match Hint
- **Behavior:** Prioritize first match, show all in results
- **Result:** User can choose between similar atoms

### 3. User Ignores LLM Suggestion
- **Behavior:** User can select any result
- **Result:** Badge shows selected atom's entity type (not LLM hint)

### 4. Confidence <30% (Very Uncertain)
- **Behavior:** Show warning icon in badge
- **Result:** User knows to double-check selection

## Implementation Checklist

- [ ] Add `entityType`, `disambiguation`, `confidence` to `AtomReference`
- [ ] Add `entityHint` state to `AtomSearchInput`
- [ ] Implement `setEntityHint()` method in `AtomSearchInput`
- [ ] Update search result rendering to show LLM suggestion badge
- [ ] Update search result rendering to show entity type
- [ ] Update selection callback to include entity metadata
- [ ] Add `subjectBadgeEl`, `predicateBadgeEl`, `objectBadgeEl` to `ClaimModal`
- [ ] Implement `updateEntityBadge()` method
- [ ] Update `autoExtract()` to set entity hints
- [ ] Add CSS for LLM suggestion badge in search
- [ ] Add CSS for entity type badges in search
- [ ] Add CSS for entity badges (high/medium/low confidence colors)
- [ ] Write unit tests for entity hints in search
- [ ] Write unit tests for badge rendering
- [ ] Manual testing for all scenarios

## Files to Modify

### Core Changes
- `src/types/search.ts` - Extend `AtomReference` (~5 lines)
- `src/ui/components/atom-search-input.ts` - Add entity hints (~100 lines)
- `src/ui/modals/claim-modal.ts` - Add badges (~80 lines)
- `styles.css` - Add disambiguation styles (~60 lines)

### Testing
- `src/ui/components/atom-search-input.spec.ts` - Add disambiguation tests (~60 lines)
- `src/ui/modals/claim-modal.spec.ts` - Add badge tests (~80 lines)

## Estimated Complexity
**High** - Requires data model extension, component integration, and UI polish

## Success Metrics
1. Users correctly identify ambiguous entities ≥90% of the time
2. LLM suggestions are accepted ≥80% when shown
3. Low-confidence badges prevent incorrect selections
4. Disambiguation improves claim quality (fewer "wrong Apple" errors)

## Future Enhancements
1. Real-time LLM disambiguation on search (if budget allows)
2. "Did you mean?" suggestions after selection
3. Entity history (remember user's past selections for "Apple")
4. Visual entity preview (image, description) on hover
5. Confidence explanation tooltip ("Why 45%? Multiple meanings detected")
