# Plan 006: Claim Modal - User Experience Specification

## Status
📋 UX Specification (Consolidated from Plans 006, 006-2a, 006-2b)

## Overview
This document describes the complete user experience for the Claim Structuring Modal, including both the baseline regex-based implementation and the enhanced LLM-powered flow.

## User Journey

### Entry Points
1. **Command Palette**: "Publish claim to Intuition"
2. **Keyboard Shortcut**: `Cmd/Ctrl+Shift+I`
3. **Context Menu**: Right-click selected text → "Publish to Intuition"

### Prerequisite Checks
Before opening the modal:
1. **Text Selection**: User must have text selected
   - If no selection → Show warning: "Please select text first"
2. **Wallet Connection**: Check if wallet is unlocked
   - If locked → Prompt for password before opening modal
3. **Network Connection**: Verify GraphQL endpoint is reachable
   - If offline → Show warning, allow offline queue (Plan 008)

## Modal Flow - Complete Walkthrough

### Phase 1: Initial Display & Analysis

**Visual Structure:**
```
┌─────────────────────────────────────────────────────┐
│  Publish Claim to Intuition                    [×] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Selected Text                                      │
│  ┌─────────────────────────────────────────────┐  │
│  │ "Einstein created the theory of relativity" │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [AI analyzing...] ⏳  (if LLM enabled)             │
│                                                     │
│  Structure as Triple                                │
│  ┌─────────────────────────────────────────────┐  │
│  │ Subject:   [Einstein                      ▼] │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Predicate: [created                       ▼] │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Object:    [theory of relativity          ▼] │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [Checking knowledge graph...]                     │
│                                                     │
│                          [Cancel] [Create & Stake] │
└─────────────────────────────────────────────────────┘
```

**What happens:**
1. Modal opens immediately with selected text displayed
2. Text validation runs (is this a claim vs opinion/question?)
3. **If LLM enabled:**
   - Show loading indicator "AI analyzing..."
   - Call `LLMService.extractClaims(text)` (1-3 seconds)
   - On success: Pre-fill Subject/Predicate/Object with LLM results
   - On failure: Fall back to regex extraction
4. **If LLM disabled or failed:**
   - Run regex pattern matching (`ClaimParserService.extractTripleRegex()`)
   - Pre-fill fields with regex results
5. Trigger existence check for the extracted triple

### Phase 2: Text Validation Feedback

**Non-claim Detection:**
If the selected text is detected as a non-claim:

```
┌─────────────────────────────────────────────────────┐
│  Selected Text                                      │
│  ┌─────────────────────────────────────────────┐  │
│  │ "Is Einstein a physicist?"                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ⚠️ Questions cannot be claims                      │
│                                                     │
│  (Fields still editable - user can override)        │
└─────────────────────────────────────────────────────┘
```

**Detection rules:**
- Questions (ends with `?`)
- First-person opinions ("I think...", "I believe...")
- Hedged statements ("might be", "could be", "possibly")
- Incomplete sentences
- Metaphors/figurative language (LLM only)

**UX Decision:** Show warning but don't block - let user decide.

### Phase 3: LLM Enhancement (Optional)

**When LLM extraction succeeds:**

```
┌─────────────────────────────────────────────────────┐
│  Structure as Triple                                │
│  ┌─────────────────────────────────────────────┐  │
│  │ Subject:   [Einstein                      ▼] │  │
│  │            (Person) 95% confidence          │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Predicate: [created                       ▼] │  │
│  │            Alternatives: "developed",       │  │
│  │            "formulated", "authored"         │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Object:    [theory of relativity          ▼] │  │
│  │            (Concept) 92% confidence         │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  🤖 AI Extracted (88% confidence)                   │
│                                                     │
│  💡 Suggested Improvement:                          │
│  "Albert Einstein" created "general relativity"     │
│  [Apply Suggestion]                                 │
│                                                     │
│  ⚠️ Warnings:                                        │
│  • This claim is time-sensitive (1915)             │
│  • Consider specifying "general" vs "special"       │
└─────────────────────────────────────────────────────┘
```

**LLM Metadata Display:**
1. **Entity Types**: Show detected type (Person, Organization, Concept, Thing, Place, Event)
2. **Confidence Scores**: Per-entity confidence (color-coded: green ≥80%, yellow ≥50%, red <50%)
3. **Predicate Alternatives**: Clickable suggestions to replace predicate
4. **Suggested Improvements**: One-click apply button
5. **Warnings**: Contextual advice (subjectivity, time-sensitivity, ambiguity)
6. **Reasoning** (optional): Expandable section explaining why LLM chose this structure

**UX Decision:** All fields remain editable - LLM suggestions are starting points, not mandates.

### Phase 4: Atom Search & Selection

**Each field has autocomplete search:**

```
┌─────────────────────────────────────────────────┐
│ Subject:   [Einst_                            ▼] │
│            ┌───────────────────────────────────┐ │
│            │ 🔍 Search results:                │ │
│            │ ────────────────────────────────  │ │
│            │ ✓ Albert Einstein                 │ │
│            │   Physicist (1879-1955)           │ │
│            │   ID: 0x1234...abcd               │ │
│            │                                   │ │
│            │ ✓ Einstein (Physicist)            │ │
│            │   Theoretical physicist           │ │
│            │   ID: 0x5678...efgh               │ │
│            │                                   │ │
│            │ ─────────────────────────────────  │ │
│            │ ➕ Create new atom: "Einst"        │ │
│            └───────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Search behavior (from Plan 005):**
1. Type to search - debounced (300ms)
2. Semantic search via GraphQL `search_term(query)`
3. Results show:
   - Label (atom name)
   - Description/disambiguation (if available)
   - Atom ID (truncated)
   - Existing atom indicator (✓)
4. "Create new atom" option always available at bottom

**Field-specific behavior:**
- **Subject/Object**: Full semantic search
- **Predicate**: Filtered to common predicates + semantic search
  - Common predicates shown first: "is", "has", "uses", "created", "founded"
  - User can still create custom predicates

**When LLM disambiguation is available:**
```
┌─────────────────────────────────────────────────┐
│ Subject:   [Apple_                            ▼] │
│            ┌───────────────────────────────────┐ │
│            │ 🤖 AI suggests: "Apple Inc."      │ │
│            │    (Technology company)           │ │
│            │    Detected from context          │ │
│            │                                   │ │
│            │ Other matches:                    │ │
│            │ ✓ Apple Inc.                      │ │
│            │   Technology company              │ │
│            │                                   │ │
│            │ ✓ Apple (Fruit)                   │ │
│            │   Edible fruit                    │ │
│            └───────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Phase 5: Existence Check

**As soon as all three fields are populated (either from extraction or user input):**

```
┌─────────────────────────────────────────────────────┐
│  Claim Status                                       │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🔍 Checking knowledge graph...               │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Three possible outcomes:**

#### 5a. Claim Already Exists (Exact Match)

```
┌─────────────────────────────────────────────────────┐
│  Claim Status                                       │
│  ┌─────────────────────────────────────────────┐  │
│  │ ✓ This claim exists in the knowledge graph  │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Current Consensus                                  │
│  ┌─────────────────────────────────────────────┐  │
│  │ ████████████████░░░░ 82.3% For              │  │
│  │ ░░░░                17.7% Against           │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Total staked: 123.4567 TRUST                      │
│  47 stakers (32 for, 15 against)                   │
│                                                     │
│                          [Cancel] [Add Stake]      │
└─────────────────────────────────────────────────────┘
```

**What happens:**
- Button changes from "Create & Stake" to "Add Stake"
- Consensus visualization appears
- User can add stake to existing claim (Plan 007)

#### 5b. Claim Does Not Exist

```
┌─────────────────────────────────────────────────────┐
│  Claim Status                                       │
│  ┌─────────────────────────────────────────────┐  │
│  │ ○ This claim does not exist yet              │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  New atoms will be created:                        │
│  • Subject: "Einstein" (new)                        │
│  • Object: "theory of relativity" (new)            │
│  • Predicate: "created" (existing)                 │
│                                                     │
│                          [Cancel] [Create & Stake] │
└─────────────────────────────────────────────────────┘
```

**What happens:**
- Button shows "Create & Stake"
- List of new atoms to be created is shown
- Existing atoms are labeled as "(existing)"

#### 5c. Check Failed (Network Error)

```
┌─────────────────────────────────────────────────────┐
│  Claim Status                                       │
│  ┌─────────────────────────────────────────────┐  │
│  │ ✗ Error checking knowledge graph             │  │
│  │   Network unavailable - check connection     │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  You can still create this claim, but it may       │
│  already exist. Proceeding will attempt to create. │
│                                                     │
│                          [Cancel] [Create Anyway]  │
└─────────────────────────────────────────────────────┘
```

**Graceful degradation:**
- Show error but allow user to proceed
- Warn that claim might already exist
- On-chain deduplication will handle duplicates

### Phase 6: Validation & Submission

**Validation rules:**
1. All three fields must be non-empty
2. Each field must resolve to an atom (existing or new)
3. No circular references (subject ≠ object for identity claims)

**Invalid state:**
```
┌─────────────────────────────────────────────────────┐
│  Validation Errors:                                 │
│  • Subject is required                              │
│  • Predicate must be selected or created            │
│                                                     │
│                          [Cancel] [Create & Stake] │
│                                  (disabled)         │
└─────────────────────────────────────────────────────┘
```

**Valid state:**
```
│                          [Cancel] [Create & Stake] │
│                                  (enabled, blue)   │
```

**On Submit:**
1. Validate all fields
2. Collect draft data:
   ```typescript
   {
     subject: AtomReference,
     predicate: AtomReference,
     object: AtomReference,
     existingTriple: TripleData | null,
     consensus: ConsensusData | null,
     sourceText: string,
     sourceFile: string,
     sourcePosition: { start, end }
   }
   ```
3. Close ClaimModal
4. Open StakeModal (Plan 007) with draft data
5. User sets stake amount and confirms transaction

## Cost Management (LLM-Enabled Flow)

### Budget Warnings

**When approaching budget limit:**
```
┌─────────────────────────────────────────────────────┐
│  ⚠️ AI Budget Warning                               │
│  ┌─────────────────────────────────────────────┐  │
│  │ You've used 85% of your monthly budget       │  │
│  │ This operation will cost ~$0.0003            │  │
│  │ Continue?                                    │  │
│  │                                              │  │
│  │               [Cancel] [Continue]            │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**When budget exceeded:**
```
┌─────────────────────────────────────────────────────┐
│  ❌ Monthly budget exceeded ($10.00)                 │
│  Current usage: $10.23                              │
│                                                     │
│  AI features are disabled until next month.         │
│  Falling back to regex-based extraction.           │
│                                                     │
│                          [OK]                       │
└─────────────────────────────────────────────────────┘
```

**After budget exceeded:**
- Modal continues to work with regex extraction
- No LLM indicators shown
- User is not blocked from creating claims

## Testing Scenarios

### Scenario 1: Simple Claim (Regex-Based)

**Prerequisites:**
- LLM disabled OR LLM unavailable

**Steps:**
1. Select text: `"Ethereum uses proof-of-stake"`
2. Run command: `Cmd+Shift+I`
3. **Expected:**
   - Modal opens
   - Subject: "Ethereum"
   - Predicate: "uses"
   - Object: "proof-of-stake"
   - Status: Checking...
   - After check: "Claim does not exist yet"
4. Modify object to "Proof of Stake" (capitalize)
5. **Expected:**
   - Atom search shows results
   - Select existing atom if available
6. Click "Create & Stake"
7. **Expected:**
   - Modal closes
   - StakeModal opens (Plan 007)

### Scenario 2: LLM-Enhanced Extraction

**Prerequisites:**
- LLM enabled
- API key configured
- Budget available

**Steps:**
1. Select text: `"Despite numerous challenges, SpaceX successfully launched Starship"`
2. Run command: `Cmd+Shift+I`
3. **Expected:**
   - Modal opens
   - "AI analyzing..." indicator appears
   - After 1-3 seconds:
     - Subject: "SpaceX" (Organization, 95%)
     - Predicate: "launched"
     - Object: "Starship" (Thing, 90%)
   - AI badge: "AI Extracted (92% confidence)"
   - No warnings
4. **Expected:**
   - Existence check runs automatically
   - Status: "Claim does not exist yet"
5. Click "Create & Stake"
6. **Expected:**
   - Transition to StakeModal

### Scenario 3: Ambiguous Entity

**Prerequisites:**
- LLM enabled with entity disambiguation

**Steps:**
1. Select text: `"Apple released iPhone"`
2. Run command: `Cmd+Shift+I`
3. **Expected:**
   - Subject: "Apple Inc."
   - Entity type: "Organization"
   - Disambiguation note: "Technology company (not fruit)"
4. Click in Subject field
5. **Expected:**
   - Dropdown shows:
     - "🤖 AI suggests: Apple Inc. (Technology company)"
     - "Other matches:"
     - "Apple Inc." (existing atom)
     - "Apple (Fruit)" (existing atom)
6. Select different option
7. **Expected:**
   - Existence check re-runs with new atom

### Scenario 4: Invalid Input (Question)

**Steps:**
1. Select text: `"Is Einstein a physicist?"`
2. Run command: `Cmd+Shift+I`
3. **Expected:**
   - Modal opens
   - Warning: "⚠️ Questions cannot be claims"
   - Fields still editable
   - Extraction may still attempt (depending on implementation)
4. User can:
   - Edit to make it a statement
   - Cancel
   - Proceed anyway (warning shown but not blocking)

### Scenario 5: Existing Claim with Consensus

**Steps:**
1. Select text with known existing claim
2. Run command: `Cmd+Shift+I`
3. **Expected:**
   - Auto-extraction succeeds
   - Existence check finds match
   - Status: "✓ This claim exists in the knowledge graph"
   - Consensus bar appears (e.g., 75% For, 25% Against)
   - Stats: "Total staked: 50.1234 TRUST, 23 stakers"
   - Button: "Add Stake" (not "Create & Stake")
4. Click "Add Stake"
5. **Expected:**
   - StakeModal opens in "add stake" mode

### Scenario 6: Budget Exceeded

**Prerequisites:**
- LLM enabled
- Monthly budget set to $10.00
- Current usage: $10.05

**Steps:**
1. Select text: `"Bitcoin is decentralized"`
2. Run command: `Cmd+Shift+I`
3. **Expected:**
   - Modal opens
   - No "AI analyzing..." indicator
   - Regex extraction runs immediately
   - No AI badge shown
   - Status bar may show: "AI features disabled (budget exceeded)"
4. Fields are pre-filled with regex results
5. User can proceed normally (no AI features)

### Scenario 7: LLM Suggested Improvement

**Steps:**
1. Select text: `"Einstein made relativity"`
2. Run command: `Cmd+Shift+I`
3. **Expected:**
   - AI extraction:
     - Subject: "Einstein"
     - Predicate: "made" (extracted verbatim)
     - Object: "relativity"
   - Suggested Improvement shown:
     - "Albert Einstein" created "theory of relativity"
   - "Apply Suggestion" button visible
4. Click "Apply Suggestion"
5. **Expected:**
   - Subject updates to "Albert Einstein"
   - Predicate updates to "created"
   - Object updates to "theory of relativity"
   - Existence check re-runs

### Scenario 8: Network Failure During Check

**Steps:**
1. Disconnect internet
2. Select text: `"Python is a programming language"`
3. Run command: `Cmd+Shift+I`
4. **Expected:**
   - Modal opens
   - Extraction succeeds (regex or cached LLM)
   - Existence check fails
   - Status: "✗ Error checking knowledge graph - Network unavailable"
   - Warning: "You can still create this claim..."
   - Button: "Create Anyway" (not "Create & Stake")
5. Click "Create Anyway"
6. **Expected:**
   - Attempt to open StakeModal
   - StakeModal will handle offline state (Plan 008)

## Critical UX Improvements

### 1. Structured LLM Extraction (Current Gap)

**Problem:** Plans don't clearly specify that LLM should return structured triple data.

**Solution:**
- Use `generateObject()` from Vercel AI SDK with Zod schema
- LLM returns JSON:
  ```json
  {
    "claims": [{
      "subject": { "text": "Einstein", "type": "person", "confidence": 0.95 },
      "predicate": { "text": "created", "normalized": "created", "alternatives": ["developed", "formulated"] },
      "object": { "text": "theory of relativity", "type": "concept", "confidence": 0.92 },
      "confidence": 0.88,
      "reasoning": "Clear historical fact...",
      "suggestedImprovement": "Albert Einstein created the theory of relativity",
      "warnings": ["Time-sensitive claim (1915)"]
    }]
  }
  ```
- This is **already specified in Plan 006-2a** lines 469-494 ✓

### 2. Apply Suggestion UX Flow (Missing)

**Problem:** Plan 006-2b mentions "Apply Suggestion" button but doesn't specify behavior.

**Solution:**
1. When LLM returns `suggestedImprovement`:
   - Parse improvement string into S-P-O components
   - Show as editable suggestion (not auto-apply)
2. On "Apply Suggestion" click:
   - Update all three fields
   - Trigger new existence check
   - Clear the suggestion (it's now applied)
3. User can still manually edit after applying

### 3. Predicate Alternatives UX (Missing)

**Problem:** LLM returns alternative predicates but no UI interaction specified.

**Solution:**
- Show alternatives as clickable pills below predicate field
- Example:
  ```
  Predicate: [created                       ▼]
             Alternatives: [developed] [formulated] [authored]
  ```
- Click alternative → updates predicate field → triggers existence check

### 4. Confidence Thresholds (Underspecified)

**Problem:** What confidence score is "good enough"?

**Recommendation:**
- **≥ 0.80**: High confidence (green badge)
- **0.50 - 0.79**: Medium confidence (yellow badge)
- **< 0.50**: Low confidence (red badge)
- **< 0.30**: Show warning: "AI is uncertain about this extraction. Please review carefully."

### 5. Entity Type Display (Optional Enhancement)

**Current:** Entity types are extracted but not prominently displayed.

**Recommendation:**
- Show as subtle badge next to atom name:
  ```
  Subject:   [Einstein                Person 95% ▼]
  Predicate: [created                               ▼]
  Object:    [theory of relativity   Concept 92% ▼]
  ```
- Helps user verify LLM understood context correctly

### 6. Reasoning Expandable Section (Optional)

**Current:** Plan 006-2b line 185-189 shows reasoning in settings list.

**Recommendation:**
- Make reasoning optional/collapsible:
  ```
  🤖 AI Extracted (88% confidence) [Why?]
  ```
- Click "[Why?]" → Expands to show:
  ```
  Reasoning: This is a clear historical fact. Einstein is
  identified as a person (physicist), "created" is the
  appropriate predicate for authorship, and "theory of
  relativity" is a well-known scientific concept.
  ```

### 7. Loading States (Missing)

**Problem:** Modal should show graceful loading states.

**Recommendation:**

**During LLM call (1-3 seconds):**
```
┌─────────────────────────────────────────────────────┐
│  Structure as Triple                                │
│  ┌─────────────────────────────────────────────┐  │
│  │ Subject:   [                              ▼] │  │
│  │            AI analyzing... ⏳               │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Predicate: [                              ▼] │  │
│  │            AI analyzing... ⏳               │  │
│  └─────────────────────────────────────────────┘  │
```

**After extraction completes:**
- Animate fields filling in (smooth transition)
- Show AI badge

**On error:**
- Show brief error message: "AI extraction failed, using fallback"
- Fields populate with regex results
- No AI badge shown

### 8. Keyboard Navigation (Missing)

**Recommendation:**
- `Tab` → Move between fields
- `Enter` in search → Select first result
- `Esc` → Close modal (without saving)
- `Cmd/Ctrl+Enter` → Submit (if valid)

## Implementation Checklist

### Phase 1: Basic Modal (Plan 006)
- [ ] Modal opens with selected text
- [ ] Text validation (claim vs non-claim)
- [ ] Regex-based triple extraction
- [ ] Subject/Predicate/Object input fields
- [ ] Atom search with autocomplete (Plan 005)
- [ ] "Create new atom" option
- [ ] Existence check via GraphQL
- [ ] Consensus display for existing claims
- [ ] Validation (all fields required)
- [ ] Submit button (disabled until valid)

### Phase 2: LLM Integration (Plan 006-2a, 006-2b)
- [ ] LLM service initialized
- [ ] API key encrypted storage
- [ ] Provider selection (Anthropic, OpenAI, etc.)
- [ ] Cost tracking and budget limits
- [ ] `extractClaims()` method returns structured data
- [ ] Fallback to regex on LLM failure

### Phase 3: LLM UX Enhancements (Plan 006-2b)
- [ ] "AI analyzing..." loading indicator
- [ ] AI confidence badge (high/medium/low)
- [ ] Entity type display (Person, Org, Concept, etc.)
- [ ] Predicate alternatives (clickable pills)
- [ ] Suggested improvement with "Apply" button
- [ ] Warnings display (subjective, time-sensitive, etc.)
- [ ] Reasoning (optional/expandable)

### Phase 4: Error Handling & Edge Cases
- [ ] LLM disabled → Regex extraction works
- [ ] Budget exceeded → Fallback to regex
- [ ] Network error → Graceful degradation
- [ ] Invalid text → Warning shown, not blocking
- [ ] Ambiguous entities → Disambiguation UI

### Phase 5: Polish
- [ ] Loading states for all async operations
- [ ] Keyboard navigation
- [ ] Smooth animations
- [ ] Mobile-responsive (if applicable)
- [ ] Accessibility (ARIA labels)

## Open Questions

1. **Cache LLM results?**
   - Should identical text always trigger new LLM call?
   - Recommendation: Cache for 24 hours (Plan 006-2a line 464)

2. **Max text length for LLM?**
   - Current: No limit specified
   - Recommendation: Warn if >500 chars, block if >2000 chars

3. **Multiple claim extraction?**
   - What if text contains multiple claims?
   - Current: Extract only first claim
   - Future: Show "2 more claims detected" with option to extract all

4. **Undo/Redo for "Apply Suggestion"?**
   - Should user be able to revert after applying?
   - Recommendation: Not needed - fields are always manually editable

5. **Show cost estimate before LLM call?**
   - Current: Only budget warnings shown
   - Recommendation: Optional "Show cost estimate" toggle in settings

## Success Metrics

**User successfully creates claim when:**
1. Text is selected
2. Modal opens without errors
3. Triple is extracted (LLM or regex)
4. All fields are valid
5. User clicks "Create & Stake"
6. Transition to StakeModal succeeds

**LLM extraction is considered successful when:**
1. Extraction completes in <3 seconds
2. Confidence score ≥ 0.5
3. All three components extracted
4. No critical errors in reasoning

**Fallback is considered graceful when:**
1. LLM failure is silent (no error popup)
2. Regex extraction runs immediately
3. User can still complete workflow
4. No data loss

## Conclusion

This UX plan consolidates all specifications from Plans 006, 006-2a, and 006-2b into a single, testable flow. The key improvements are:

1. **Structured LLM output** - Already specified in 006-2a ✓
2. **Apply Suggestion UX** - Now detailed
3. **Predicate alternatives** - Clickable pills
4. **Loading states** - All async operations covered
5. **Graceful degradation** - LLM → Regex fallback
6. **Budget management** - Warnings and blocking behavior
7. **Error handling** - Network, validation, API failures

Next step: Compare current implementation against this specification to identify gaps.
