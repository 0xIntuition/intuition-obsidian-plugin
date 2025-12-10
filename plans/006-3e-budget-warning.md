# Plan 006-3e: Budget Warning Modal

## Status
📋 Ready for Implementation

## Overview
Add a pre-request budget warning modal when users approach their monthly LLM budget limit (≥80%), showing cost estimate and allowing them to proceed or cancel.

## Problem Statement
Currently, budget checking happens in `LLMService.checkBudget()`:
1. Hard block at 100% budget
2. No warning when approaching limit
3. No cost preview before expensive operations
4. Users surprised when budget runs out mid-month

**From Plan 006 UX Spec (lines 332-367):**
> When approaching budget limit:
> - Show "You've used 85% of your monthly budget"
> - Show estimated cost for this operation
> - Allow user to Continue or Cancel
>
> When budget exceeded:
> - Hard block with error message
> - Fall back to regex extraction

**User Selected Preference:** "Only when approaching limit (80%+)"

## User Experience Goal

### Current Flow (No Warning)
```
1. User opens Claim Modal
2. LLM extracts (costs $0.0003)
3. Budget: 95% → 96% (no notification)
4. Next extraction...
5. Budget: 99% → 101% → BLOCKED ❌
6. User frustrated: "Why didn't you warn me?"
```

### New Flow (With Warning)
```
1. User opens Claim Modal
2. Check: budget at 85% → show warning modal
3. Modal: "You've used 85% of your $10 budget. This operation will cost ~$0.0003. Continue?"
4. User clicks [Continue] → Extraction proceeds
5. Next time: 95% → show warning again
6. User can track usage and decide when to stop
```

## Acceptance Criteria

### Must Have
1. ✅ Warning modal appears when budget ≥ warning threshold (default 80%)
2. ✅ Modal shows current usage ($X / $Y) and percentage
3. ✅ Modal shows estimated cost for the current operation
4. ✅ User can click [Continue] to proceed or [Cancel] to abort
5. ✅ If user cancels, fall back to regex extraction (no LLM call)
6. ✅ Hard block at 100% with different modal (no Continue option)

### Should Have
7. ✅ "Don't ask again this session" checkbox
8. ✅ Link to LLM settings to adjust budget
9. ✅ Show days until budget resets

### Nice to Have
10. ⭐ Cost breakdown (input tokens, output tokens, total)
11. ⭐ Usage chart/visualization
12. ⭐ Recommendations for budget size

## Technical Design

### 1. Budget Check Flow

**Current Implementation:**
```typescript
// In LLMService.checkBudget()
if (usageStats.totalCostUSD >= settings.llm.monthlyBudgetUSD) {
    throw new PluginError(LLM_ERRORS.BUDGET_EXCEEDED, ErrorCode.LLM_BUDGET_EXCEEDED, true);
}
```

**New Implementation:**
```typescript
// In LLMService.checkBudget()
async checkBudget(estimatedCost: number): Promise<boolean> {
    const usage = this.plugin.settings.llm.usageStats;
    const budget = this.plugin.settings.llm.monthlyBudgetUSD;

    const currentUsage = usage.totalCostUSD;
    const projectedUsage = currentUsage + estimatedCost;

    const currentPercentage = (currentUsage / budget) * 100;
    const projectedPercentage = (projectedUsage / budget) * 100;

    // Hard block at 100%
    if (currentPercentage >= 100) {
        return this.showBudgetExceededModal();
    }

    // Warning at threshold
    const threshold = this.plugin.settings.llm.warningThreshold || 80;
    if (currentPercentage >= threshold && !this.sessionWarningDismissed) {
        return this.showBudgetWarningModal(currentUsage, budget, estimatedCost);
    }

    // All good
    return true;
}
```

### 2. Budget Warning Modal

**File:** `src/ui/modals/budget-warning-modal.ts` (NEW)

```typescript
import { App, Modal } from 'obsidian';
import type IntuitionPlugin from '../../main';

export class BudgetWarningModal extends Modal {
    private plugin: IntuitionPlugin;
    private currentUsage: number;
    private monthlyBudget: number;
    private estimatedCost: number;
    private onContinue: () => void;
    private onCancel: () => void;

    constructor(
        app: App,
        plugin: IntuitionPlugin,
        currentUsage: number,
        monthlyBudget: number,
        estimatedCost: number,
        onContinue: () => void,
        onCancel: () => void
    ) {
        super(app);
        this.plugin = plugin;
        this.currentUsage = currentUsage;
        this.monthlyBudget = monthlyBudget;
        this.estimatedCost = estimatedCost;
        this.onContinue = onContinue;
        this.onCancel = onCancel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('budget-warning-modal');

        // Header
        contentEl.createEl('h2', { text: '⚠️ Budget Warning' });

        // Usage stats
        const usagePercentage = Math.round((this.currentUsage / this.monthlyBudget) * 100);
        const usageSection = contentEl.createDiv({ cls: 'budget-usage-section' });

        usageSection.createEl('p', {
            text: `You've used ${usagePercentage}% of your monthly budget.`
        });

        // Progress bar
        const progressBar = usageSection.createDiv({ cls: 'budget-progress-bar' });
        const progressFill = progressBar.createDiv({ cls: 'budget-progress-fill' });
        progressFill.style.width = `${Math.min(usagePercentage, 100)}%`;

        // Current usage
        usageSection.createEl('p', {
            text: `Current usage: $${this.currentUsage.toFixed(4)} / $${this.monthlyBudget.toFixed(2)}`,
            cls: 'budget-usage-text'
        });

        // Estimated cost
        const costSection = contentEl.createDiv({ cls: 'budget-cost-section' });
        costSection.createEl('p', {
            text: `This operation will cost approximately $${this.estimatedCost.toFixed(4)}.`
        });

        // Days until reset
        const resetDate = this.getResetDate();
        const daysUntilReset = this.getDaysUntilReset();
        contentEl.createEl('p', {
            text: `Budget resets in ${daysUntilReset} days (${resetDate.toLocaleDateString()})`,
            cls: 'budget-reset-info'
        });

        // Don't ask again checkbox
        const checkboxContainer = contentEl.createDiv({ cls: 'budget-checkbox-container' });
        const checkbox = checkboxContainer.createEl('input', {
            type: 'checkbox',
            cls: 'budget-dismiss-checkbox'
        });
        checkbox.id = 'budget-dismiss';
        checkboxContainer.createEl('label', {
            text: "Don't ask again this session",
            attr: { for: 'budget-dismiss' }
        });

        // Settings link
        const settingsLink = contentEl.createDiv({ cls: 'budget-settings-link' });
        settingsLink.createEl('a', {
            text: 'Adjust budget in settings',
            href: '#'
        }).addEventListener('click', (e) => {
            e.preventDefault();
            this.plugin.settingTab?.display(); // Open settings tab
            this.close();
        });

        // Actions
        const actionsEl = contentEl.createDiv({ cls: 'budget-actions' });

        const cancelBtn = actionsEl.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => {
            this.handleCancel();
        });

        const continueBtn = actionsEl.createEl('button', {
            text: 'Continue Anyway',
            cls: 'mod-warning'
        });
        continueBtn.addEventListener('click', () => {
            this.handleContinue(checkbox.checked);
        });
    }

    private handleContinue(dismissSession: boolean): void {
        if (dismissSession) {
            // Set session flag to not show again
            this.plugin.llmService.sessionWarningDismissed = true;
        }
        this.close();
        this.onContinue();
    }

    private handleCancel(): void {
        this.close();
        this.onCancel();
    }

    private getResetDate(): Date {
        const lastReset = this.plugin.settings.llm.usageStats.lastReset;
        const resetDate = new Date(lastReset);
        resetDate.setMonth(resetDate.getMonth() + 1);
        return resetDate;
    }

    private getDaysUntilReset(): number {
        const now = Date.now();
        const resetDate = this.getResetDate();
        const diff = resetDate.getTime() - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
}
```

### 3. Budget Exceeded Modal

**File:** `src/ui/modals/budget-exceeded-modal.ts` (NEW)

```typescript
import { App, Modal } from 'obsidian';
import type IntuitionPlugin from '../../main';

export class BudgetExceededModal extends Modal {
    private plugin: IntuitionPlugin;

    constructor(app: App, plugin: IntuitionPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('budget-exceeded-modal');

        // Header
        contentEl.createEl('h2', { text: '❌ Monthly Budget Exceeded' });

        // Message
        const budget = this.plugin.settings.llm.monthlyBudgetUSD;
        const usage = this.plugin.settings.llm.usageStats.totalCostUSD;

        contentEl.createEl('p', {
            text: `You've exceeded your monthly budget of $${budget.toFixed(2)}.`
        });

        contentEl.createEl('p', {
            text: `Current usage: $${usage.toFixed(4)}`,
            cls: 'budget-exceeded-usage'
        });

        // Fallback message
        const fallbackMsg = contentEl.createDiv({ cls: 'budget-fallback-message' });
        fallbackMsg.createEl('p', {
            text: 'AI features are disabled until your budget resets.'
        });
        fallbackMsg.createEl('p', {
            text: 'The plugin will continue working with regex-based extraction.'
        });

        // Reset date
        const resetDate = this.getResetDate();
        contentEl.createEl('p', {
            text: `Budget resets on ${resetDate.toLocaleDateString()}`,
            cls: 'budget-reset-info'
        });

        // Actions
        const actionsEl = contentEl.createDiv({ cls: 'budget-actions' });

        const settingsBtn = actionsEl.createEl('button', {
            text: 'Adjust Budget',
            cls: 'mod-cta'
        });
        settingsBtn.addEventListener('click', () => {
            this.plugin.settingTab?.display();
            this.close();
        });

        const okBtn = actionsEl.createEl('button', { text: 'OK' });
        okBtn.addEventListener('click', () => this.close());
    }

    private getResetDate(): Date {
        const lastReset = this.plugin.settings.llm.usageStats.lastReset;
        const resetDate = new Date(lastReset);
        resetDate.setMonth(resetDate.getMonth() + 1);
        return resetDate;
    }
}
```

### 4. LLMService Integration

**File:** `src/services/llm-service.ts`

```typescript
export class LLMService extends BaseService {
    // ... existing properties ...

    // Session state to track warning dismissal
    public sessionWarningDismissed = false;

    /**
     * Check budget before making LLM request
     * Shows modal if approaching/exceeded
     * Returns true if should proceed, false if cancelled
     */
    async checkBudgetWithModal(estimatedCost: number): Promise<boolean> {
        const usage = this.plugin.settings.llm.usageStats;
        const budget = this.plugin.settings.llm.monthlyBudgetUSD;

        const currentUsage = usage.totalCostUSD;
        const currentPercentage = (currentUsage / budget) * 100;

        // Hard block at 100%
        if (currentPercentage >= 100) {
            return new Promise((resolve) => {
                new BudgetExceededModal(this.plugin.app, this.plugin).open();
                resolve(false); // Block operation
            });
        }

        // Warning at threshold
        const threshold = this.plugin.settings.llm.warningThreshold || 80;
        if (currentPercentage >= threshold && !this.sessionWarningDismissed) {
            return new Promise((resolve) => {
                new BudgetWarningModal(
                    this.plugin.app,
                    this.plugin,
                    currentUsage,
                    budget,
                    estimatedCost,
                    () => resolve(true),  // Continue
                    () => resolve(false)  // Cancel
                ).open();
            });
        }

        // All good
        return true;
    }

    /**
     * Extract claims with budget check
     */
    async extractClaims(text: string, context?: string): Promise<ExtractedClaimLLM[]> {
        // Estimate cost
        const estimate = this.estimateCost(text, context);

        // Check budget (may show modal)
        const shouldProceed = await this.checkBudgetWithModal(estimate.estimatedCostUSD);

        if (!shouldProceed) {
            // User cancelled - return empty to trigger regex fallback
            console.debug('LLM extraction cancelled due to budget');
            return [];
        }

        // Proceed with extraction
        // ... existing extraction logic ...
    }
}
```

### 5. CSS Styling

**File:** `styles.css`

```css
/* Budget Warning Modal */
.budget-warning-modal,
.budget-exceeded-modal {
    max-width: 500px;
}

.budget-usage-section {
    margin: 16px 0;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 4px;
}

.budget-progress-bar {
    width: 100%;
    height: 8px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    margin: 8px 0;
    overflow: hidden;
}

.budget-progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.3s ease;
}

.budget-usage-text {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 4px;
}

.budget-cost-section {
    margin: 16px 0;
    padding: 12px;
    background: var(--background-modifier-warning);
    border-radius: 4px;
    border-left: 3px solid var(--text-warning);
}

.budget-reset-info {
    font-size: 12px;
    color: var(--text-faint);
    margin: 12px 0;
}

.budget-checkbox-container {
    margin: 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.budget-dismiss-checkbox {
    margin: 0;
}

.budget-settings-link {
    margin: 8px 0;
    font-size: 13px;
}

.budget-settings-link a {
    color: var(--interactive-accent);
    text-decoration: none;
}

.budget-settings-link a:hover {
    text-decoration: underline;
}

.budget-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
}

/* Budget Exceeded Modal */
.budget-exceeded-usage {
    font-weight: 600;
    color: var(--text-error);
}

.budget-fallback-message {
    margin: 16px 0;
    padding: 12px;
    background: var(--background-modifier-error);
    border-radius: 4px;
    border-left: 3px solid var(--text-error);
}
```

## Testing

### Unit Tests

**File:** `src/services/llm-service.spec.ts`

```typescript
describe('LLMService - Budget Warnings', () => {
    it('should show warning modal at 80% budget', async () => {
        const service = new LLMService(plugin);

        // Set usage to 80%
        plugin.settings.llm.monthlyBudgetUSD = 10;
        plugin.settings.llm.usageStats.totalCostUSD = 8;

        const shouldProceed = await service.checkBudgetWithModal(0.0003);

        // Modal should have been shown
        expect(shouldProceed).toBeDefined();
    });

    it('should block at 100% budget', async () => {
        const service = new LLMService(plugin);

        // Set usage to 100%
        plugin.settings.llm.monthlyBudgetUSD = 10;
        plugin.settings.llm.usageStats.totalCostUSD = 10.5;

        const shouldProceed = await service.checkBudgetWithModal(0.0003);

        expect(shouldProceed).toBe(false);
    });

    it('should not show warning if session dismissed', async () => {
        const service = new LLMService(plugin);
        service.sessionWarningDismissed = true;

        plugin.settings.llm.monthlyBudgetUSD = 10;
        plugin.settings.llm.usageStats.totalCostUSD = 8.5;

        const shouldProceed = await service.checkBudgetWithModal(0.0003);

        expect(shouldProceed).toBe(true); // No modal shown
    });

    it('should allow proceeding below threshold', async () => {
        const service = new LLMService(plugin);

        plugin.settings.llm.monthlyBudgetUSD = 10;
        plugin.settings.llm.usageStats.totalCostUSD = 5; // 50%

        const shouldProceed = await service.checkBudgetWithModal(0.0003);

        expect(shouldProceed).toBe(true);
    });
});
```

### Manual Testing Scenarios

**Scenario 1: Approaching Budget (85%)**
1. Set monthly budget to $10
2. Set current usage to $8.50 (85%)
3. Open Claim Modal with LLM enabled
4. **Expected:**
   - Budget warning modal appears
   - Shows "You've used 85% of your monthly budget"
   - Shows "This operation will cost ~$0.0003"
   - Progress bar at 85%
   - [Cancel] and [Continue Anyway] buttons

**Scenario 2: User Continues**
1. Continue from Scenario 1
2. Click [Continue Anyway]
3. **Expected:**
   - Modal closes
   - LLM extraction proceeds
   - Claim modal shows AI suggestion
   - Next extraction may trigger warning again (if still >80%)

**Scenario 3: User Cancels**
1. Continue from Scenario 1
2. Click [Cancel]
3. **Expected:**
   - Modal closes
   - No LLM call made
   - Claim modal falls back to regex extraction
   - Notice: "Pattern Suggestion (75% confidence): ..."

**Scenario 4: Don't Ask Again This Session**
1. Budget at 85%
2. Check "Don't ask again this session"
3. Click [Continue Anyway]
4. Open another Claim Modal
5. **Expected:**
   - No warning modal shown
   - LLM proceeds directly
   - Continues until plugin reload or 100% budget

**Scenario 5: Budget Exceeded (105%)**
1. Set usage to $10.50 (105%)
2. Open Claim Modal
3. **Expected:**
   - Budget exceeded modal appears (different from warning)
   - No [Continue] button (hard block)
   - Shows reset date
   - Regex extraction used automatically

## Edge Cases

### 1. Budget Reset During Session
- **Behavior:** Next LLM call checks fresh budget
- **Result:** Warnings/blocks cleared automatically

### 2. User Adjusts Budget Mid-Session
- **Behavior:** Percentage recalculated immediately
- **Result:** May drop below threshold, warnings stop

### 3. Concurrent LLM Calls
- **Behavior:** Each call checks budget independently
- **Result:** May show multiple modals (rare, acceptable)

### 4. Modal Open When Claim Modal Closes
- **Behavior:** Budget modal remains until user interacts
- **Result:** User must decide before continuing

## Implementation Checklist

- [ ] Create `BudgetWarningModal` class
- [ ] Create `BudgetExceededModal` class
- [ ] Add `sessionWarningDismissed` flag to `LLMService`
- [ ] Implement `checkBudgetWithModal()` method
- [ ] Update `extractClaims()` to call budget check
- [ ] Add progress bar rendering
- [ ] Add reset date calculation
- [ ] Add "Don't ask again" checkbox logic
- [ ] Add CSS styles for both modals
- [ ] Add settings link navigation
- [ ] Write unit tests for budget thresholds
- [ ] Write unit tests for session dismissal
- [ ] Manual testing for all scenarios

## Files to Modify

### New Files
- `src/ui/modals/budget-warning-modal.ts` - Warning modal (~120 lines)
- `src/ui/modals/budget-exceeded-modal.ts` - Exceeded modal (~80 lines)

### Modified Files
- `src/services/llm-service.ts` - Add modal integration (~60 lines)
- `styles.css` - Add modal styles (~80 lines)

### Testing
- `src/services/llm-service.spec.ts` - Add budget tests (~80 lines)

## Estimated Complexity
**Medium** - Requires modal creation and service integration

## Success Metrics
1. Users are warned before hitting budget limit (0 surprise blocks)
2. Users understand cost implications before proceeding
3. "Don't ask again" reduces friction for power users
4. Budget exceeded fallback is seamless (regex works)

## Future Enhancements
1. Cost breakdown (input tokens × $X + output tokens × $Y)
2. Usage chart/graph over time
3. Budget recommendations based on usage patterns
4. Per-model budget tracking
5. Email notification when budget exceeded
6. Option to auto-increase budget (with confirmation)
