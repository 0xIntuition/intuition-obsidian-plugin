# Plan 006-3a: Loading States During LLM Extraction

## Status
📋 Ready for Implementation

## Overview
Add visual loading indicators during LLM claim extraction to improve perceived performance and user understanding of what's happening.

## Problem Statement
Currently, when the Claim Modal opens:
1. Modal appears instantly with empty fields
2. Auto-extraction happens in background (fire-and-forget)
3. No visual feedback that AI is working
4. Fields suddenly populate 1-3 seconds later with no explanation

Users may not realize:
- AI is analyzing their text
- They should wait a moment before manually filling fields
- Whether extraction succeeded or failed

## User Experience Goal

### Current Flow (No Loading State)
```
1. Modal opens → [Empty fields]
2. (1-3 seconds pass silently)
3. Fields populate → Notice shown "AI Suggestion (87% confidence): ..."
```

### New Flow (With Loading State)
```
1. Modal opens → [Empty fields]
2. Loading indicator appears → "✨ AI analyzing your claim..."
3. (1-3 seconds pass)
4. Loading indicator disappears
5. Fields populate → Notice shown "AI Suggestion (87% confidence): ..."
```

## Acceptance Criteria

### Must Have
1. ✅ Loading indicator appears immediately when modal opens
2. ✅ Indicator shows "AI analyzing..." text with animated icon
3. ✅ Indicator disappears when extraction completes (success OR failure)
4. ✅ Indicator disappears if LLM is disabled/unavailable (instant fallback to regex)
5. ✅ Fields remain editable during loading (don't block user input)
6. ✅ Loading state doesn't prevent modal from opening (non-blocking)

### Should Have
7. ✅ Different messaging for LLM vs regex extraction
   - LLM: "✨ AI analyzing your claim..."
   - Regex: "🔍 Analyzing text patterns..."
8. ✅ Graceful timeout if LLM takes >10 seconds (hide indicator, show notice)

### Nice to Have
9. ⭐ Animated spinner or pulse effect
10. ⭐ Progress percentage (if deterministic)

## Implementation Plan

### Phase 1: Add Loading State to Modal

**File:** `src/ui/modals/claim-modal.ts`

#### 1.1 Add Loading State Property
```typescript
export class ClaimModal extends Modal {
    // ... existing properties ...

    // Add loading state tracking
    private isExtracting = false;
    private extractionTimeout: NodeJS.Timeout | null = null;
    private loadingIndicatorEl: HTMLElement | null = null;
```

#### 1.2 Render Loading Indicator
Add new method to render loading UI:
```typescript
/**
 * Render loading indicator for extraction
 */
private renderLoadingIndicator(type: 'llm' | 'regex' = 'llm'): void {
    // Clear existing indicator
    if (this.loadingIndicatorEl) {
        this.loadingIndicatorEl.remove();
    }

    // Create loading section (insert after original text, before triple inputs)
    this.loadingIndicatorEl = this.contentEl.createDiv({
        cls: 'claim-extraction-loading'
    });

    const spinner = this.loadingIndicatorEl.createSpan({
        cls: 'loading-spinner'
    });

    const text = type === 'llm'
        ? '✨ AI analyzing your claim...'
        : '🔍 Analyzing text patterns...';

    this.loadingIndicatorEl.createSpan({
        text: text,
        cls: 'loading-text'
    });
}

/**
 * Hide loading indicator
 */
private hideLoadingIndicator(): void {
    if (this.loadingIndicatorEl) {
        this.loadingIndicatorEl.remove();
        this.loadingIndicatorEl = null;
    }

    if (this.extractionTimeout) {
        clearTimeout(this.extractionTimeout);
        this.extractionTimeout = null;
    }

    this.isExtracting = false;
}
```

#### 1.3 Update `autoExtract()` Method
Modify existing extraction flow to show/hide loading:
```typescript
private async autoExtract(): Promise<void> {
    // Determine if LLM will be used
    const willUseLLM = this.plugin.settings.llm.enabled
        && this.plugin.llmService.isUnlocked();

    // Show loading indicator
    this.isExtracting = true;
    this.renderLoadingIndicator(willUseLLM ? 'llm' : 'regex');

    // Set timeout to hide indicator if extraction takes too long
    this.extractionTimeout = setTimeout(() => {
        this.hideLoadingIndicator();
        this.plugin.noticeManager.warning(
            'Extraction is taking longer than expected'
        );
    }, 10000); // 10 second timeout

    try {
        const suggestion = await this.plugin.claimParserService.extractTriple(
            this.selectedText
        );

        // Hide loading BEFORE showing results
        this.hideLoadingIndicator();

        if (
            !suggestion ||
            suggestion.confidence < ClaimModal.MIN_AUTO_SUGGESTION_CONFIDENCE
        ) {
            return;
        }

        // ... existing suggestion handling ...

    } catch (error) {
        console.debug('Auto-extraction failed:', error);
        this.hideLoadingIndicator();
    }
}
```

#### 1.4 Update `onClose()` Cleanup
Ensure loading state is cleaned up:
```typescript
onClose() {
    // ... existing cleanup ...

    // Clear loading indicator
    this.hideLoadingIndicator();
}
```

### Phase 2: Add CSS Styling

**File:** `styles.css`

#### 2.1 Loading Indicator Styles
```css
/* Loading indicator for claim extraction */
.claim-extraction-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    margin: 12px 0;
    background: var(--background-secondary);
    border-radius: 4px;
    border-left: 3px solid var(--interactive-accent);
}

.claim-extraction-loading .loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--text-faint);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.claim-extraction-loading .loading-text {
    color: var(--text-muted);
    font-size: 14px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

### Phase 3: Testing

#### Unit Tests
**File:** `src/ui/modals/claim-modal.spec.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaimModal } from './claim-modal';
// ... imports ...

describe('ClaimModal - Loading States', () => {
    let modal: ClaimModal;

    beforeEach(() => {
        // Setup modal with mocked plugin
    });

    it('should show loading indicator when LLM is enabled', async () => {
        // Mock LLM enabled
        modal.onOpen();

        // Check for loading indicator
        const loadingEl = modal.contentEl.querySelector('.claim-extraction-loading');
        expect(loadingEl).toBeTruthy();
        expect(loadingEl?.textContent).toContain('AI analyzing');
    });

    it('should hide loading indicator after extraction completes', async () => {
        // Mock extraction
        modal.onOpen();
        await waitForExtraction();

        const loadingEl = modal.contentEl.querySelector('.claim-extraction-loading');
        expect(loadingEl).toBeNull();
    });

    it('should timeout and hide indicator after 10 seconds', async () => {
        vi.useFakeTimers();
        modal.onOpen();

        vi.advanceTimersByTime(10000);

        const loadingEl = modal.contentEl.querySelector('.claim-extraction-loading');
        expect(loadingEl).toBeNull();

        vi.useRealTimers();
    });

    it('should show regex loading when LLM is disabled', () => {
        // Mock LLM disabled
        modal.onOpen();

        const loadingEl = modal.contentEl.querySelector('.claim-extraction-loading');
        expect(loadingEl?.textContent).toContain('Analyzing text patterns');
    });
});
```

#### Manual Testing Scenarios

**Scenario 1: LLM Enabled, Fast Response**
1. Enable LLM in settings
2. Unlock LLM service
3. Select text: "Bitcoin is a cryptocurrency"
4. Open Claim Modal (Cmd+Shift+I)
5. **Expected:**
   - Loading indicator appears immediately
   - Shows "✨ AI analyzing your claim..."
   - Disappears after 1-3 seconds
   - Fields populate with AI suggestion

**Scenario 2: LLM Disabled, Regex Fallback**
1. Disable LLM in settings
2. Select text: "Ethereum uses proof-of-stake"
3. Open Claim Modal
4. **Expected:**
   - Loading indicator appears immediately
   - Shows "🔍 Analyzing text patterns..."
   - Disappears after <500ms (regex is fast)
   - Fields populate with regex extraction

**Scenario 3: LLM Timeout**
1. Enable LLM but with slow/failing API
2. Select text
3. Open Claim Modal
4. Wait 10+ seconds
5. **Expected:**
   - Loading indicator appears
   - After 10s, indicator disappears
   - Warning notice: "Extraction is taking longer than expected"
   - Modal remains functional, fields stay editable

**Scenario 4: User Starts Typing During Loading**
1. Open modal (loading appears)
2. Immediately click in Subject field and start typing
3. **Expected:**
   - Loading indicator still visible
   - User can type without interruption
   - When extraction completes, notice shown but fields NOT overwritten

## Edge Cases

### 1. User Closes Modal During Extraction
- **Behavior:** Timeout cleared in `onClose()`
- **Result:** No memory leak, clean state

### 2. LLM Service Locked
- **Behavior:** Falls back to regex immediately
- **Result:** Loading shows "Analyzing text patterns" briefly

### 3. Empty/Invalid Text
- **Behavior:** Extraction fails fast
- **Result:** Loading disappears immediately, no suggestion shown

### 4. Network Error
- **Behavior:** LLM fails, fallback to regex
- **Result:** Loading disappears, regex suggestion shown

## Implementation Checklist

- [ ] Add `isExtracting`, `extractionTimeout`, `loadingIndicatorEl` properties
- [ ] Implement `renderLoadingIndicator(type)` method
- [ ] Implement `hideLoadingIndicator()` method
- [ ] Update `autoExtract()` to show/hide loading
- [ ] Update `onClose()` to cleanup loading state
- [ ] Add CSS styles for loading indicator
- [ ] Add spin animation keyframes
- [ ] Write unit tests for loading states
- [ ] Manual testing for all 4 scenarios
- [ ] Test edge cases (modal close, timeout, errors)

## Files to Modify

### Core Changes
- `src/ui/modals/claim-modal.ts` - Add loading state logic (~50 lines)
- `styles.css` - Add loading indicator styles (~30 lines)

### Testing
- `src/ui/modals/claim-modal.spec.ts` - New file for modal tests (~100 lines)

## Estimated Complexity
**Low** - Straightforward UI change with no data model impact

## Success Metrics
1. Users see immediate feedback when modal opens
2. Perceived performance improves (users understand delay)
3. No increase in confusion about why fields populate later
4. Loading state never blocks or interrupts user actions

## Future Enhancements
1. Progress percentage for multi-claim extraction
2. Animated pulse on fields when they populate
3. Sound effect when extraction completes (optional setting)
4. Different icons for different LLM providers
