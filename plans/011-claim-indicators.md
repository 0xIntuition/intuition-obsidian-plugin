# Plan 011: Claim Existence Indicators

## Objective
Detect assertion-like sentences in notes and indicate whether they exist as Triples in the public knowledge graph, showing verification status.

## Prerequisites
- Plan 004 (Intuition SDK Integration)
- Plan 009 (Basic Entity Decorations)

## Deliverables
1. Claim extraction from paragraph text
2. Triple matching against knowledge graph
3. Inline verification indicators
4. Verification status explanations
5. Quick publish for unverified claims

## Files to Create

```
src/
  types/
    claim-indicators.ts      # Indicator types
  services/
    claim-extraction.ts      # Sentence-level claim detection
    claim-matching.ts        # Triple matching service
  ui/
    extensions/
      claim-indicator.ts     # CodeMirror extension
    components/
      claim-tooltip.ts       # Status explanation tooltip
```

## Data Models

```typescript
// src/types/claim-indicators.ts
import { TripleData, ConsensusData } from './intuition';

export interface ExtractedClaim {
  id: string;
  text: string;
  position: { from: number; to: number };

  // Parsed components
  suggestedSubject: string | null;
  suggestedPredicate: string | null;
  suggestedObject: string | null;

  // Analysis
  confidence: number;       // 0-1, how likely this is a verifiable claim
  isHedged: boolean;        // Contains "might", "could", etc.
  isFirstPerson: boolean;   // Contains "I think", "I believe"
  isQuestion: boolean;      // Ends with ?
}

export type ClaimVerificationStatus =
  | 'verified'     // Exists with strong positive consensus (>75%)
  | 'contested'    // Exists but mixed consensus (40-75%)
  | 'disputed'     // Exists with negative consensus (<40%)
  | 'unstaked'     // Exists but minimal stake (<$10)
  | 'not-found'    // No matching claim in graph
  | 'excluded'     // Hedged/first-person/question - not checkable
  | 'checking';    // Currently verifying

export interface ClaimIndicator {
  claim: ExtractedClaim;
  status: ClaimVerificationStatus;
  matchedTriple: TripleData | null;
  consensus: ConsensusData | null;
  matchConfidence: number;  // How confident we are in the match
}

export function getStatusIcon(status: ClaimVerificationStatus): string {
  switch (status) {
    case 'verified': return '✓';
    case 'contested': return '⚠';
    case 'disputed': return '✗';
    case 'unstaked': return '○';
    case 'not-found': return '·';
    case 'excluded': return '';
    case 'checking': return '◐';
  }
}

export function getStatusColor(status: ClaimVerificationStatus): string {
  switch (status) {
    case 'verified': return '#22c55e';
    case 'contested': return '#eab308';
    case 'disputed': return '#ef4444';
    case 'unstaked': return '#9ca3af';
    case 'not-found': return '#6b7280';
    case 'excluded': return 'transparent';
    case 'checking': return '#9ca3af';
  }
}
```

## Implementation

### Claim Extraction Service (src/services/claim-extraction.ts)

```typescript
import { ExtractedClaim } from '../types/claim-indicators';

export class ClaimExtractionService {
  // Patterns that indicate hedged language
  private hedgePatterns = /\b(might|could|may|possibly|perhaps|probably|likely|unlikely|seems?|appears?|suggests?)\b/i;

  // Patterns that indicate first-person opinion
  private firstPersonPatterns = /^(I|We)\s+(think|believe|feel|guess|suppose|imagine|hope|doubt|wonder)/i;

  // Common assertion verbs
  private assertionVerbs = /\b(is|are|was|were|has|have|had|does|do|did|uses?|creates?|enables?|provides?|supports?|requires?)\b/i;

  extractClaims(content: string): ExtractedClaim[] {
    const claims: ExtractedClaim[] = [];

    // Split into sentences
    const sentences = this.splitIntoSentences(content);

    for (const sentence of sentences) {
      const claim = this.analyzeSentence(sentence);
      if (claim) {
        claims.push(claim);
      }
    }

    return claims;
  }

  private splitIntoSentences(content: string): Array<{ text: string; from: number; to: number }> {
    const sentences: Array<{ text: string; from: number; to: number }> = [];

    // Simple sentence splitting (can be improved with NLP)
    const sentenceRegex = /[^.!?\n]+[.!?]?/g;
    let match;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const text = match[0].trim();
      if (text.length > 10 && text.length < 300) { // Reasonable sentence length
        sentences.push({
          text,
          from: match.index,
          to: match.index + match[0].length,
        });
      }
    }

    return sentences;
  }

  private analyzeSentence(sentence: { text: string; from: number; to: number }): ExtractedClaim | null {
    const { text, from, to } = sentence;

    // Check exclusion criteria
    const isQuestion = text.trim().endsWith('?');
    const isHedged = this.hedgePatterns.test(text);
    const isFirstPerson = this.firstPersonPatterns.test(text);

    // Must contain an assertion verb
    const hasAssertionVerb = this.assertionVerbs.test(text);

    // Calculate confidence
    let confidence = 0;

    if (hasAssertionVerb) confidence += 0.3;
    if (!isQuestion) confidence += 0.2;
    if (!isHedged) confidence += 0.2;
    if (!isFirstPerson) confidence += 0.2;
    if (this.containsNamedEntity(text)) confidence += 0.1;

    // Skip very low confidence
    if (confidence < 0.4) return null;

    // Try to extract subject-predicate-object
    const { subject, predicate, object } = this.extractComponents(text);

    return {
      id: crypto.randomUUID(),
      text,
      position: { from, to },
      suggestedSubject: subject,
      suggestedPredicate: predicate,
      suggestedObject: object,
      confidence,
      isHedged,
      isFirstPerson,
      isQuestion,
    };
  }

  private containsNamedEntity(text: string): boolean {
    // Simple heuristic: contains capitalized words that aren't at sentence start
    const words = text.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      if (/^[A-Z][a-z]/.test(words[i])) {
        return true;
      }
    }
    return false;
  }

  private extractComponents(text: string): {
    subject: string | null;
    predicate: string | null;
    object: string | null;
  } {
    // Simple pattern matching (same as claim-parser-service)
    const patterns = [
      { regex: /^(.+?)\s+is\s+(?:a\s+)?(.+)$/i, pred: 'is' },
      { regex: /^(.+?)\s+uses\s+(.+)$/i, pred: 'uses' },
      { regex: /^(.+?)\s+has\s+(.+)$/i, pred: 'has' },
      { regex: /^(.+?)\s+(created|founded|built)\s+by\s+(.+)$/i, pred: null },
    ];

    for (const { regex, pred } of patterns) {
      const match = text.match(regex);
      if (match) {
        if (pred === null) {
          // Passive pattern
          return {
            subject: match[3]?.trim() || null,
            predicate: match[2]?.trim() || null,
            object: match[1]?.trim() || null,
          };
        }
        return {
          subject: match[1]?.trim() || null,
          predicate: pred,
          object: match[2]?.trim() || null,
        };
      }
    }

    return { subject: null, predicate: null, object: null };
  }
}
```

### Claim Matching Service (src/services/claim-matching.ts)

```typescript
import { IntuitionService } from './intuition-service';
import { ExtractedClaim, ClaimIndicator, ClaimVerificationStatus } from '../types/claim-indicators';
import IntuitionPlugin from '../main';

export class ClaimMatchingService {
  private plugin: IntuitionPlugin;
  private intuitionService: IntuitionService;

  constructor(plugin: IntuitionPlugin, intuitionService: IntuitionService) {
    this.plugin = plugin;
    this.intuitionService = intuitionService;
  }

  async matchClaims(claims: ExtractedClaim[]): Promise<ClaimIndicator[]> {
    const indicators: ClaimIndicator[] = [];

    for (const claim of claims) {
      const indicator = await this.matchSingleClaim(claim);
      indicators.push(indicator);
    }

    return indicators;
  }

  private async matchSingleClaim(claim: ExtractedClaim): Promise<ClaimIndicator> {
    // Check if excluded
    if (claim.isQuestion || claim.isHedged || claim.isFirstPerson) {
      return {
        claim,
        status: 'excluded',
        matchedTriple: null,
        consensus: null,
        matchConfidence: 0,
      };
    }

    // Need all components to search
    if (!claim.suggestedSubject || !claim.suggestedPredicate || !claim.suggestedObject) {
      return {
        claim,
        status: 'not-found',
        matchedTriple: null,
        consensus: null,
        matchConfidence: 0,
      };
    }

    try {
      // Search for matching atoms
      const [subjectAtoms, predicateAtoms, objectAtoms] = await Promise.all([
        this.intuitionService.searchAtoms({ query: claim.suggestedSubject, limit: 5 }),
        this.intuitionService.searchAtoms({ query: claim.suggestedPredicate, limit: 5 }),
        this.intuitionService.searchAtoms({ query: claim.suggestedObject, limit: 5 }),
      ]);

      // Try to find a matching triple
      for (const subject of subjectAtoms.items) {
        for (const predicate of predicateAtoms.items) {
          for (const object of objectAtoms.items) {
            const triple = await this.intuitionService.findTriple(
              subject.termId,
              predicate.termId,
              object.termId
            );

            if (triple) {
              // Calculate consensus
              const consensus = this.intuitionService.calculateConsensus(
                triple.forVault,
                triple.againstVault
              );

              // Determine status based on consensus
              const status = this.getStatusFromConsensus(consensus, triple);
              const matchConfidence = this.calculateMatchConfidence(
                claim,
                subject.label,
                predicate.label,
                object.label
              );

              return {
                claim,
                status,
                matchedTriple: triple,
                consensus,
                matchConfidence,
              };
            }
          }
        }
      }

      // No match found
      return {
        claim,
        status: 'not-found',
        matchedTriple: null,
        consensus: null,
        matchConfidence: 0,
      };
    } catch {
      return {
        claim,
        status: 'not-found',
        matchedTriple: null,
        consensus: null,
        matchConfidence: 0,
      };
    }
  }

  private getStatusFromConsensus(consensus: any, triple: any): ClaimVerificationStatus {
    const totalStaked = consensus.totalStaked;
    const minStake = BigInt(10e18); // $10 equivalent

    if (totalStaked < minStake) {
      return 'unstaked';
    }

    const forPercent = consensus.forPercentage;

    if (forPercent >= 75) return 'verified';
    if (forPercent >= 40) return 'contested';
    return 'disputed';
  }

  private calculateMatchConfidence(
    claim: ExtractedClaim,
    matchedSubject: string,
    matchedPredicate: string,
    matchedObject: string
  ): number {
    let confidence = 0;

    // Compare with claim suggestions
    if (claim.suggestedSubject?.toLowerCase().includes(matchedSubject.toLowerCase())) {
      confidence += 0.33;
    }
    if (claim.suggestedPredicate?.toLowerCase() === matchedPredicate.toLowerCase()) {
      confidence += 0.34;
    }
    if (claim.suggestedObject?.toLowerCase().includes(matchedObject.toLowerCase())) {
      confidence += 0.33;
    }

    return confidence;
  }
}
```

### CodeMirror Extension (src/ui/extensions/claim-indicator.ts)

```typescript
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { ClaimExtractionService } from '../../services/claim-extraction';
import { ClaimMatchingService } from '../../services/claim-matching';
import { ClaimIndicator, getStatusIcon, getStatusColor } from '../../types/claim-indicators';
import IntuitionPlugin from '../../main';

class ClaimIndicatorWidget extends WidgetType {
  constructor(
    private indicator: ClaimIndicator,
    private plugin: IntuitionPlugin
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const { status, consensus } = this.indicator;

    // Don't render for excluded claims
    if (status === 'excluded') {
      return document.createElement('span');
    }

    const badge = document.createElement('span');
    badge.className = `intuition-claim-indicator status-${status}`;
    badge.style.color = getStatusColor(status);

    const icon = getStatusIcon(status);
    badge.textContent = icon;

    // Build tooltip
    let tooltip = '';
    switch (status) {
      case 'verified':
        tooltip = `Verified claim (${consensus?.forPercentage.toFixed(0)}% consensus)`;
        break;
      case 'contested':
        tooltip = `Contested claim (${consensus?.forPercentage.toFixed(0)}% consensus)`;
        break;
      case 'disputed':
        tooltip = `Disputed claim (${consensus?.forPercentage.toFixed(0)}% consensus)`;
        break;
      case 'unstaked':
        tooltip = 'Claim exists but has minimal stake';
        break;
      case 'not-found':
        tooltip = 'Not in knowledge graph - click to publish';
        break;
      case 'checking':
        tooltip = 'Verifying...';
        break;
    }
    badge.title = tooltip;

    // Click handler
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleClick();
    });

    return badge;
  }

  private handleClick(): void {
    const { claim, status, matchedTriple } = this.indicator;

    if (status === 'not-found') {
      // Open claim modal to publish
      // TODO: Pass pre-filled data
      this.plugin.noticeManager.info('Opening claim publisher...');
    } else if (matchedTriple) {
      // Open details or staking
      this.plugin.noticeManager.info(`View: ${matchedTriple.subject.label} → ${matchedTriple.object.label}`);
    }
  }

  eq(other: ClaimIndicatorWidget): boolean {
    return (
      this.indicator.claim.id === other.indicator.claim.id &&
      this.indicator.status === other.indicator.status
    );
  }
}

export function createClaimIndicatorPlugin(plugin: IntuitionPlugin) {
  const extractionService = new ClaimExtractionService();
  const matchingService = new ClaimMatchingService(plugin, plugin.intuitionService);

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private isUpdating = false;

      constructor(view: EditorView) {
        this.decorations = Decoration.none;

        if (plugin.settings.features.enableClaimIndicators) {
          this.updateDecorations(view);
        }
      }

      update(update: ViewUpdate) {
        if (!plugin.settings.features.enableClaimIndicators) {
          this.decorations = Decoration.none;
          return;
        }

        if (update.docChanged || update.viewportChanged) {
          this.updateDecorations(update.view);
        }
      }

      private async updateDecorations(view: EditorView) {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
          const content = view.state.doc.toString();

          // Extract claims from visible viewport for performance
          const { from, to } = view.viewport;
          const visibleContent = content.slice(from, to);
          const claims = extractionService.extractClaims(visibleContent);

          // Adjust positions
          for (const claim of claims) {
            claim.position.from += from;
            claim.position.to += from;
          }

          // Match claims (async)
          const indicators = await matchingService.matchClaims(claims);

          // Build decorations
          const builder = new RangeSetBuilder<Decoration>();

          // Sort by position
          indicators.sort((a, b) => a.claim.position.from - b.claim.position.from);

          for (const indicator of indicators) {
            if (indicator.status === 'excluded') continue;

            const widget = Decoration.widget({
              widget: new ClaimIndicatorWidget(indicator, plugin),
              side: 1, // After the sentence
            });

            builder.add(
              indicator.claim.position.to,
              indicator.claim.position.to,
              widget
            );
          }

          this.decorations = builder.finish();
        } finally {
          this.isUpdating = false;
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
```

## CSS Styles (add to styles.css)

```css
/* Claim Indicators */
.intuition-claim-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  vertical-align: middle;
}

.intuition-claim-indicator:hover {
  transform: scale(1.2);
}

.intuition-claim-indicator.status-verified {
  background: rgba(34, 197, 94, 0.1);
}

.intuition-claim-indicator.status-contested {
  background: rgba(234, 179, 8, 0.1);
}

.intuition-claim-indicator.status-disputed {
  background: rgba(239, 68, 68, 0.1);
}

.intuition-claim-indicator.status-unstaked,
.intuition-claim-indicator.status-not-found {
  background: rgba(107, 114, 128, 0.1);
}

.intuition-claim-indicator.status-checking {
  animation: pulse 1s ease-in-out infinite;
}
```

## Acceptance Criteria
- [ ] Declarative sentences get analyzed
- [ ] Verified claims show green checkmark (✓)
- [ ] Contested claims show warning (⚠)
- [ ] Disputed claims show red X (✗)
- [ ] Unknown claims show gray dot (·)
- [ ] Hedged sentences are excluded
- [ ] First-person statements are excluded
- [ ] Questions are excluded
- [ ] Click indicator opens claim details/publisher
- [ ] Performance acceptable for long docs
- [ ] Feature toggleable in settings

## Testing Strategy

### Test Files to Create

```
src/
  types/
    claim-indicators.spec.ts     # Indicator type tests
  services/
    claim-extraction.spec.ts     # Sentence extraction tests
    claim-matching.spec.ts       # Triple matching tests
  ui/
    extensions/
      claim-indicator.spec.ts    # CodeMirror extension tests
    components/
      claim-tooltip.spec.ts      # Tooltip tests

tests/
  integration/
    claim-indicators.integration.spec.ts  # End-to-end indicator tests
  fixtures/
    claims.ts                    # Claim test fixtures
    sentences.ts                 # Sentence test data
```

### Unit Tests

#### src/services/claim-extraction.spec.ts (~50 tests, 95% coverage)

**Sentence Splitting (10 tests)**
- Should split content by periods
- Should split content by exclamation marks
- Should split content by question marks
- Should handle newlines as delimiters
- Should filter sentences < 10 characters
- Should filter sentences > 300 characters
- Should capture correct positions
- Should handle consecutive punctuation
- Should handle abbreviations (e.g., "Dr.", "U.S.")
- Should handle decimal numbers in sentences

**Hedge Pattern Detection (8 tests)**
- Should detect "might" as hedged
- Should detect "could" as hedged
- Should detect "may" as hedged
- Should detect "possibly" as hedged
- Should detect "perhaps" as hedged
- Should detect "seems" as hedged
- Should be case-insensitive
- Should not match within words (e.g., "nightmare")

**First-Person Detection (6 tests)**
- Should detect "I think" as first-person
- Should detect "I believe" as first-person
- Should detect "We think" as first-person
- Should only match at sentence start
- Should be case-insensitive
- Should not match mid-sentence

**Assertion Verb Detection (8 tests)**
- Should detect "is/are" verbs
- Should detect "has/have" verbs
- Should detect "does/do" verbs
- Should detect "uses" verb
- Should detect "creates" verb
- Should detect "provides" verb
- Should be case-insensitive
- Should handle verb conjugations

**Confidence Calculation (8 tests)**
- Should add 0.3 for assertion verb
- Should add 0.2 for non-question
- Should add 0.2 for non-hedged
- Should add 0.2 for non-first-person
- Should add 0.1 for named entity
- Should return null if confidence < 0.4
- Should calculate combined confidence correctly
- Should cap at 1.0 maximum

**Component Extraction (10 tests)**
- Should extract "X is Y" pattern
- Should extract "X uses Y" pattern
- Should extract "X has Y" pattern
- Should extract "X created by Y" passive pattern
- Should handle "is a" construction
- Should handle complex subjects
- Should handle complex objects
- Should return nulls if no pattern matches
- Should trim extracted components
- Should handle multiple pattern matches (use first)

**Mock Requirements:**
```typescript
// tests/fixtures/sentences.ts
export const testSentences = {
  assertion: 'Ethereum uses proof-of-stake.',
  hedged: 'Bitcoin might become more scalable.',
  firstPerson: 'I think blockchain is revolutionary.',
  question: 'What is decentralization?',
  tooShort: 'Hi there.',
  tooLong: 'A'.repeat(350),
  validClaim: 'Solana is a fast blockchain platform.',
  passive: 'Bitcoin was created by Satoshi Nakamoto.',
};

export const expectedExtraction = {
  validClaim: {
    suggestedSubject: 'Solana',
    suggestedPredicate: 'is',
    suggestedObject: 'a fast blockchain platform',
    confidence: 0.9,
    isHedged: false,
    isFirstPerson: false,
    isQuestion: false,
  },
};
```

#### src/services/claim-matching.spec.ts (~40 tests, 90% coverage)

**matchClaims() (5 tests)**
- Should process array of claims
- Should return ClaimIndicator for each claim
- Should maintain claim order
- Should handle empty array
- Should handle concurrent matching

**matchSingleClaim() - Exclusions (6 tests)**
- Should return excluded status for questions
- Should return excluded status for hedged claims
- Should return excluded status for first-person claims
- Should return not-found for missing subject
- Should return not-found for missing predicate
- Should return not-found for missing object

**matchSingleClaim() - Atom Search (10 tests)**
- Should search for subject atoms
- Should search for predicate atoms
- Should search for object atoms
- Should limit search to 5 results per term
- Should handle search errors gracefully
- Should try multiple atom combinations
- Should find exact label matches
- Should handle partial matches
- Should return not-found if no atoms found
- Should handle concurrent searches

**matchSingleClaim() - Triple Lookup (8 tests)**
- Should find triple with matching atoms
- Should try all atom combinations
- Should calculate consensus for found triple
- Should determine status from consensus
- Should calculate match confidence
- Should return first matching triple
- Should handle triple lookup errors
- Should return not-found if no triple matches

**getStatusFromConsensus() (6 tests)**
- Should return unstaked for < $10 equivalent stake
- Should return verified for >= 75% consensus
- Should return contested for 40-75% consensus
- Should return disputed for < 40% consensus
- Should handle edge case values
- Should use bigint comparison correctly

**calculateMatchConfidence() (5 tests)**
- Should add 0.33 for subject match
- Should add 0.34 for predicate match
- Should add 0.33 for object match
- Should handle case-insensitive comparison
- Should handle partial matches

#### src/ui/extensions/claim-indicator.spec.ts (~35 tests, 85% coverage)

**ClaimIndicatorWidget - Rendering (10 tests)**
- Should create span element
- Should not render for excluded claims
- Should show ✓ for verified status
- Should show ⚠ for contested status
- Should show ✗ for disputed status
- Should show ○ for unstaked status
- Should show · for not-found status
- Should show ◐ for checking status
- Should apply correct color per status
- Should set appropriate tooltip text

**ClaimIndicatorWidget - Click Handler (5 tests)**
- Should handle click for not-found (open publisher)
- Should handle click for found (show details)
- Should prevent event propagation
- Should prevent default behavior
- Should access claim data correctly

**ClaimIndicatorWidget - Equality (4 tests)**
- Should return true for same claim and status
- Should return false for different claim ID
- Should return false for different status
- Should handle null comparisons

**ViewPlugin - Initialization (4 tests)**
- Should start with empty decorations
- Should check enableClaimIndicators setting
- Should initialize extraction service
- Should initialize matching service

**ViewPlugin - Updates (8 tests)**
- Should update on document change
- Should update on viewport change
- Should skip if feature disabled
- Should extract claims from visible viewport
- Should adjust positions for viewport offset
- Should match claims asynchronously
- Should build decorations from indicators
- Should skip excluded indicators in decorations

**ViewPlugin - Performance (4 tests)**
- Should prevent concurrent updates
- Should handle rapid document changes
- Should limit viewport extraction
- Should sort decorations by position

#### src/types/claim-indicators.spec.ts (~15 tests, 100% coverage)

**getStatusIcon() (7 tests)**
- Should return ✓ for verified
- Should return ⚠ for contested
- Should return ✗ for disputed
- Should return ○ for unstaked
- Should return · for not-found
- Should return empty for excluded
- Should return ◐ for checking

**getStatusColor() (7 tests)**
- Should return green for verified
- Should return yellow for contested
- Should return red for disputed
- Should return gray for unstaked
- Should return darker gray for not-found
- Should return transparent for excluded
- Should return gray for checking

**Type Validations (1 test)**
- Should validate ExtractedClaim structure

### Integration Tests

#### tests/integration/claim-indicators.integration.spec.ts (~25 tests)

**Extraction to Display Flow (8 tests)**
- Should extract claims from note content
- Should display indicator after sentence
- Should match claim against knowledge graph
- Should show correct status indicator
- Should update on content change
- Should handle multiple claims
- Should cache matching results
- Should handle new claims added

**Status Display (6 tests)**
- Should show verified for high consensus claims
- Should show contested for mixed consensus claims
- Should show disputed for low consensus claims
- Should show not-found for missing claims
- Should handle claims with no stake
- Should update status on data refresh

**User Interactions (5 tests)**
- Should open publisher for not-found claims
- Should show details for found claims
- Should toggle via settings
- Should respect feature toggle
- Should integrate with claim modal

**Exclusion Logic (6 tests)**
- Should not show indicator for questions
- Should not show indicator for hedged statements
- Should not show indicator for first-person statements
- Should not show indicator for short sentences
- Should handle mixed content correctly
- Should skip code blocks and frontmatter

### Test Fixtures

```typescript
// tests/fixtures/claims.ts
export const mockExtractedClaim: ExtractedClaim = {
  id: 'claim-1',
  text: 'Ethereum uses proof-of-stake.',
  position: { from: 0, to: 31 },
  suggestedSubject: 'Ethereum',
  suggestedPredicate: 'uses',
  suggestedObject: 'proof-of-stake',
  confidence: 0.9,
  isHedged: false,
  isFirstPerson: false,
  isQuestion: false,
};

export const mockClaimIndicator: ClaimIndicator = {
  claim: mockExtractedClaim,
  status: 'verified',
  matchedTriple: {
    id: 'triple-1',
    tripleId: '123',
    subject: { id: '1', termId: '1', label: 'Ethereum' },
    predicate: { id: '2', termId: '2', label: 'uses' },
    object: { id: '3', termId: '3', label: 'proof-of-stake' },
    forVault: {
      id: 'vault-1',
      totalAssets: BigInt(100e18),
      totalShares: BigInt(100e18),
      currentSharePrice: BigInt(1e18),
      positionCount: 80,
    },
    againstVault: {
      id: 'vault-2',
      totalAssets: BigInt(20e18),
      totalShares: BigInt(20e18),
      currentSharePrice: BigInt(1e18),
      positionCount: 10,
    },
  },
  consensus: {
    forPercentage: 83.3,
    againstPercentage: 16.7,
    totalStaked: BigInt(120e18),
    forStaked: BigInt(100e18),
    againstStaked: BigInt(20e18),
  },
  matchConfidence: 0.95,
};

export const mockExcludedClaim: ExtractedClaim = {
  ...mockExtractedClaim,
  id: 'claim-2',
  text: 'I think Ethereum is good.',
  isFirstPerson: true,
  confidence: 0.3,
};

export const mockNotFoundClaim: ClaimIndicator = {
  claim: {
    ...mockExtractedClaim,
    id: 'claim-3',
    text: 'FooBar uses BazQux.',
    suggestedSubject: 'FooBar',
    suggestedObject: 'BazQux',
  },
  status: 'not-found',
  matchedTriple: null,
  consensus: null,
  matchConfidence: 0,
};
```

### Mock Requirements

```typescript
// Claim extraction service mock
export const createMockExtractionService = () => ({
  extractClaims: vi.fn().mockReturnValue([mockExtractedClaim]),
  splitIntoSentences: vi.fn(),
  analyzeSentence: vi.fn(),
});

// Claim matching service mock
export const createMockMatchingService = () => ({
  matchClaims: vi.fn().mockResolvedValue([mockClaimIndicator]),
  matchSingleClaim: vi.fn(),
});
```

### Coverage Targets

| File | Target | Notes |
|------|--------|-------|
| claim-extraction.ts | 95% | Regex/NLP logic, highly testable |
| claim-matching.ts | 90% | Async matching logic |
| claim-indicator.ts | 85% | CodeMirror extension |
| types/claim-indicators.ts | 100% | Pure functions |
| claim-tooltip.ts | 90% | UI component |

**Overall Plan 011 Target: 90%+ coverage, ~140 tests**

### Manual Testing Checklist
1. Write sentence "Ethereum uses proof-of-stake" - verify indicator
2. Write "I think Ethereum is good" - verify excluded
3. Write "Ethereum might be scalable" - verify excluded
4. Write "What is Ethereum?" - verify excluded
5. Write false claim - verify disputed/not-found
6. Toggle feature off - verify indicators hidden

## Estimated Effort
High - NLP extraction with async matching
