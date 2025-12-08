# Plan 006: Claim Structuring Modal

## Objective
Build the main claim structuring modal that transforms selected text into a Triple (Subject/Predicate/Object) with atom search and creation capabilities.

## Prerequisites
- Plan 004 (Intuition SDK Integration)
- Plan 005 (Atom Search & Selection)

## Deliverables
1. Claim structuring modal with text display
2. Triple extraction heuristics from text
3. Subject/Predicate/Object selection fields
4. Claim existence check against knowledge graph
5. Current consensus display when claim exists
6. Validation and error messaging

## Files to Create

```
src/
  types/
    claims.ts                # Claim-related types
  services/
    claim-parser-service.ts  # Text-to-triple parsing
  ui/
    modals/
      claim-modal.ts         # Main claim modal
    components/
      triple-input.ts        # Triple input group
      claim-status.ts        # Existence status display
      consensus-display.ts   # Consensus visualization
```

## Data Models

```typescript
// src/types/claims.ts
import { AtomReference } from './search';
import { TripleData, ConsensusData } from './intuition';

export interface ClaimDraft {
  id: string;
  sourceText: string;
  sourceFile: string;
  sourcePosition: { start: number; end: number };

  subject: AtomReference | null;
  predicate: AtomReference | null;
  object: AtomReference | null;

  existingTriple: TripleData | null;
  consensus: ConsensusData | null;

  isValid: boolean;
  validationErrors: string[];
}

export interface TripleSuggestion {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  pattern: ExtractionPattern;
}

export type ExtractionPattern =
  | 'is-a'      // "X is Y" / "X is a Y"
  | 'verb'      // "X [verb] Y"
  | 'passive'   // "X [verb] by Y"
  | 'has'       // "X has Y"
  | 'uses'      // "X uses Y"
  | 'manual';   // User-specified

export type ClaimStatus =
  | 'checking'
  | 'exists-match'      // Exact triple exists
  | 'exists-similar'    // Similar triple exists
  | 'not-found'         // No matching triple
  | 'error';
```

## Implementation

### Claim Parser Service (src/services/claim-parser-service.ts)

```typescript
import { TripleSuggestion, ExtractionPattern } from '../types/claims';

export class ClaimParserService {
  private patterns: Array<{
    regex: RegExp;
    pattern: ExtractionPattern;
    extract: (match: RegExpMatchArray) => { subject: string; predicate: string; object: string };
  }> = [
    // "X is a Y" / "X is Y"
    {
      regex: /^(.+?)\s+is\s+(?:a\s+)?(.+)$/i,
      pattern: 'is-a',
      extract: (m) => ({ subject: m[1].trim(), predicate: 'is', object: m[2].trim() }),
    },
    // "X uses Y"
    {
      regex: /^(.+?)\s+uses\s+(.+)$/i,
      pattern: 'uses',
      extract: (m) => ({ subject: m[1].trim(), predicate: 'uses', object: m[2].trim() }),
    },
    // "X has Y"
    {
      regex: /^(.+?)\s+has\s+(.+)$/i,
      pattern: 'has',
      extract: (m) => ({ subject: m[1].trim(), predicate: 'has', object: m[2].trim() }),
    },
    // "X created by Y" / "X founded by Y"
    {
      regex: /^(.+?)\s+(created|founded|built|made)\s+by\s+(.+)$/i,
      pattern: 'passive',
      extract: (m) => ({ subject: m[3].trim(), predicate: m[2].toLowerCase(), object: m[1].trim() }),
    },
    // "X [verb] Y" (generic)
    {
      regex: /^(.+?)\s+(enables|provides|supports|requires|implements|extends)\s+(.+)$/i,
      pattern: 'verb',
      extract: (m) => ({ subject: m[1].trim(), predicate: m[2].toLowerCase(), object: m[3].trim() }),
    },
  ];

  extractTriple(text: string): TripleSuggestion | null {
    // Clean the text
    const cleaned = text
      .replace(/[.!?]+$/, '')  // Remove trailing punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();

    for (const { regex, pattern, extract } of this.patterns) {
      const match = cleaned.match(regex);
      if (match) {
        const { subject, predicate, object } = extract(match);
        return {
          subject,
          predicate,
          object,
          confidence: this.calculateConfidence(subject, predicate, object),
          pattern,
        };
      }
    }

    return null;
  }

  suggestTriples(text: string): TripleSuggestion[] {
    const suggestions: TripleSuggestion[] = [];

    // Try the main extraction
    const primary = this.extractTriple(text);
    if (primary) {
      suggestions.push(primary);
    }

    // Could add alternative interpretations here

    return suggestions;
  }

  private calculateConfidence(subject: string, predicate: string, object: string): number {
    let confidence = 0.5; // Base confidence

    // Boost for clear subjects (capitalized words, known entities)
    if (/^[A-Z]/.test(subject)) confidence += 0.1;

    // Boost for short, clear predicates
    if (predicate.length < 15) confidence += 0.1;

    // Boost for clear objects
    if (/^[A-Z]/.test(object)) confidence += 0.1;

    // Penalty for very long components
    if (subject.length > 50) confidence -= 0.2;
    if (object.length > 50) confidence -= 0.2;

    return Math.max(0.1, Math.min(1, confidence));
  }

  // Check if text is likely a claim (vs question, opinion, etc.)
  isLikelyClaim(text: string): { isClaim: boolean; reason?: string } {
    const trimmed = text.trim();

    // Questions
    if (trimmed.endsWith('?')) {
      return { isClaim: false, reason: 'Questions cannot be claims' };
    }

    // First-person opinions
    if (/^I\s+(think|believe|feel|guess)/i.test(trimmed)) {
      return { isClaim: false, reason: 'First-person opinions are subjective' };
    }

    // Hedged statements
    if (/\b(might|could|maybe|possibly|perhaps)\b/i.test(trimmed)) {
      return { isClaim: false, reason: 'Hedged statements lack certainty' };
    }

    return { isClaim: true };
  }
}
```

### Claim Modal (src/ui/modals/claim-modal.ts)

```typescript
import { App, Modal, Setting } from 'obsidian';
import IntuitionPlugin from '../../main';
import { AtomSearchInput } from '../components/atom-search-input';
import { ClaimParserService } from '../../services/claim-parser-service';
import { ClaimDraft, ClaimStatus, TripleSuggestion } from '../../types/claims';
import { AtomReference } from '../../types/search';
import { ConsensusData } from '../../types/intuition';

export class ClaimModal extends Modal {
  plugin: IntuitionPlugin;
  private sourceText: string;
  private sourceFile: string;
  private sourcePosition: { start: number; end: number };
  private parser: ClaimParserService;

  private draft: ClaimDraft;
  private status: ClaimStatus = 'checking';

  private subjectSearch: AtomSearchInput;
  private predicateSearch: AtomSearchInput;
  private objectSearch: AtomSearchInput;

  private statusEl: HTMLElement;
  private consensusEl: HTMLElement;
  private actionsEl: HTMLElement;

  constructor(
    app: App,
    plugin: IntuitionPlugin,
    sourceText: string,
    sourceFile: string,
    sourcePosition: { start: number; end: number }
  ) {
    super(app);
    this.plugin = plugin;
    this.sourceText = sourceText;
    this.sourceFile = sourceFile;
    this.sourcePosition = sourcePosition;
    this.parser = new ClaimParserService();

    this.draft = {
      id: crypto.randomUUID(),
      sourceText,
      sourceFile,
      sourcePosition,
      subject: null,
      predicate: null,
      object: null,
      existingTriple: null,
      consensus: null,
      isValid: false,
      validationErrors: [],
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('intuition-claim-modal');

    // Header
    contentEl.createEl('h2', { text: 'Publish Claim to Intuition' });

    // Source text display
    this.renderSourceText(contentEl);

    // Triple input section
    this.renderTripleInputs(contentEl);

    // Status section
    this.statusEl = contentEl.createDiv({ cls: 'claim-status-section' });

    // Consensus display
    this.consensusEl = contentEl.createDiv({ cls: 'claim-consensus-section' });

    // Actions
    this.actionsEl = contentEl.createDiv({ cls: 'claim-actions' });
    this.renderActions();

    // Auto-extract from text
    this.autoExtract();
  }

  private renderSourceText(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'source-text-section' });
    section.createEl('label', { text: 'Selected Text' });

    const textBox = section.createDiv({ cls: 'source-text-box' });
    textBox.createEl('p', { text: `"${this.sourceText}"` });

    // Show if it's likely a claim
    const analysis = this.parser.isLikelyClaim(this.sourceText);
    if (!analysis.isClaim) {
      const warning = section.createDiv({ cls: 'source-text-warning' });
      warning.createSpan({ text: '⚠️ ' + analysis.reason });
    }
  }

  private renderTripleInputs(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'triple-input-section' });
    section.createEl('h3', { text: 'Structure as Triple' });

    // Subject
    const subjectRow = section.createDiv({ cls: 'triple-row' });
    subjectRow.createEl('label', { text: 'Subject' });
    const subjectContainer = subjectRow.createDiv({ cls: 'triple-input-container' });
    this.subjectSearch = new AtomSearchInput(
      subjectContainer,
      this.plugin.intuitionService,
      (ref) => this.handleAtomSelect('subject', ref),
      { placeholder: 'Search or create subject...' }
    );

    // Predicate
    const predicateRow = section.createDiv({ cls: 'triple-row' });
    predicateRow.createEl('label', { text: 'Predicate' });
    const predicateContainer = predicateRow.createDiv({ cls: 'triple-input-container' });
    this.predicateSearch = new AtomSearchInput(
      predicateContainer,
      this.plugin.intuitionService,
      (ref) => this.handleAtomSelect('predicate', ref),
      { placeholder: 'Search or create predicate...', allowCreate: true }
    );

    // Object
    const objectRow = section.createDiv({ cls: 'triple-row' });
    objectRow.createEl('label', { text: 'Object' });
    const objectContainer = objectRow.createDiv({ cls: 'triple-input-container' });
    this.objectSearch = new AtomSearchInput(
      objectContainer,
      this.plugin.intuitionService,
      (ref) => this.handleAtomSelect('object', ref),
      { placeholder: 'Search or create object...' }
    );
  }

  private autoExtract(): void {
    const suggestion = this.parser.extractTriple(this.sourceText);

    if (suggestion) {
      // Set the input values (user can modify)
      this.subjectSearch.setValue({
        type: 'new',
        label: suggestion.subject,
        confidence: suggestion.confidence,
      });
      this.predicateSearch.setValue({
        type: 'new',
        label: suggestion.predicate,
        confidence: suggestion.confidence,
      });
      this.objectSearch.setValue({
        type: 'new',
        label: suggestion.object,
        confidence: suggestion.confidence,
      });

      // Update draft
      this.draft.subject = { type: 'new', label: suggestion.subject, confidence: suggestion.confidence };
      this.draft.predicate = { type: 'new', label: suggestion.predicate, confidence: suggestion.confidence };
      this.draft.object = { type: 'new', label: suggestion.object, confidence: suggestion.confidence };

      // Check for existing
      this.checkExistingTriple();
    }
  }

  private handleAtomSelect(field: 'subject' | 'predicate' | 'object', ref: AtomReference | null): void {
    this.draft[field] = ref;
    this.validateDraft();
    this.checkExistingTriple();
  }

  private validateDraft(): void {
    const errors: string[] = [];

    if (!this.draft.subject) errors.push('Subject is required');
    if (!this.draft.predicate) errors.push('Predicate is required');
    if (!this.draft.object) errors.push('Object is required');

    this.draft.validationErrors = errors;
    this.draft.isValid = errors.length === 0;

    this.renderActions();
  }

  private async checkExistingTriple(): Promise<void> {
    if (!this.draft.subject || !this.draft.predicate || !this.draft.object) {
      this.status = 'checking';
      this.renderStatus();
      return;
    }

    // Only check if all are existing atoms
    if (
      this.draft.subject.type === 'existing' &&
      this.draft.predicate.type === 'existing' &&
      this.draft.object.type === 'existing'
    ) {
      this.status = 'checking';
      this.renderStatus();

      try {
        const triple = await this.plugin.intuitionService.findTriple(
          this.draft.subject.termId!,
          this.draft.predicate.termId!,
          this.draft.object.termId!
        );

        if (triple) {
          this.draft.existingTriple = triple;
          this.draft.consensus = this.plugin.intuitionService.calculateConsensus(
            triple.forVault,
            triple.againstVault
          );
          this.status = 'exists-match';
        } else {
          this.draft.existingTriple = null;
          this.draft.consensus = null;
          this.status = 'not-found';
        }
      } catch (error) {
        this.status = 'error';
      }
    } else {
      // At least one new atom
      this.draft.existingTriple = null;
      this.draft.consensus = null;
      this.status = 'not-found';
    }

    this.renderStatus();
    this.renderConsensus();
  }

  private renderStatus(): void {
    this.statusEl.empty();

    const statusBox = this.statusEl.createDiv({ cls: 'claim-status-box' });

    switch (this.status) {
      case 'checking':
        statusBox.addClass('status-checking');
        statusBox.createSpan({ text: '🔍 Checking knowledge graph...' });
        break;

      case 'exists-match':
        statusBox.addClass('status-exists');
        statusBox.createSpan({ text: '✓ This claim exists in the knowledge graph' });
        break;

      case 'not-found':
        statusBox.addClass('status-new');
        statusBox.createSpan({ text: '○ This claim does not exist yet' });
        if (this.draft.subject?.type === 'new' ||
            this.draft.predicate?.type === 'new' ||
            this.draft.object?.type === 'new') {
          const newAtoms = [];
          if (this.draft.subject?.type === 'new') newAtoms.push('subject');
          if (this.draft.predicate?.type === 'new') newAtoms.push('predicate');
          if (this.draft.object?.type === 'new') newAtoms.push('object');
          statusBox.createEl('small', {
            text: `New atoms will be created: ${newAtoms.join(', ')}`,
          });
        }
        break;

      case 'error':
        statusBox.addClass('status-error');
        statusBox.createSpan({ text: '✗ Error checking knowledge graph' });
        break;
    }
  }

  private renderConsensus(): void {
    this.consensusEl.empty();

    if (!this.draft.consensus || this.status !== 'exists-match') {
      return;
    }

    const consensus = this.draft.consensus;

    const header = this.consensusEl.createDiv({ cls: 'consensus-header' });
    header.createEl('h4', { text: 'Current Consensus' });

    // Consensus bar
    const barContainer = this.consensusEl.createDiv({ cls: 'consensus-bar-container' });

    const forBar = barContainer.createDiv({ cls: 'consensus-bar for' });
    forBar.style.width = `${consensus.forPercentage}%`;
    forBar.createSpan({ text: `${consensus.forPercentage.toFixed(1)}% For` });

    const againstBar = barContainer.createDiv({ cls: 'consensus-bar against' });
    againstBar.style.width = `${consensus.againstPercentage}%`;
    againstBar.createSpan({ text: `${consensus.againstPercentage.toFixed(1)}% Against` });

    // Stats
    const stats = this.consensusEl.createDiv({ cls: 'consensus-stats' });
    const totalStaked = Number(consensus.totalStaked) / 1e18;
    stats.createSpan({ text: `Total staked: ${totalStaked.toFixed(4)} TRUST` });

    if (this.draft.existingTriple) {
      const forCount = this.draft.existingTriple.forVault.positionCount;
      const againstCount = this.draft.existingTriple.againstVault.positionCount;
      stats.createSpan({ text: `${forCount + againstCount} stakers` });
    }
  }

  private renderActions(): void {
    this.actionsEl.empty();

    // Validation errors
    if (this.draft.validationErrors.length > 0) {
      const errorList = this.actionsEl.createDiv({ cls: 'validation-errors' });
      this.draft.validationErrors.forEach(err => {
        errorList.createEl('div', { text: `• ${err}`, cls: 'validation-error' });
      });
    }

    // Buttons
    const buttons = this.actionsEl.createDiv({ cls: 'action-buttons' });

    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const nextBtn = buttons.createEl('button', {
      text: this.status === 'exists-match' ? 'Add Stake' : 'Create & Stake',
      cls: 'mod-cta',
    });
    nextBtn.disabled = !this.draft.isValid;
    nextBtn.addEventListener('click', () => this.proceedToStake());
  }

  private proceedToStake(): void {
    if (!this.draft.isValid) return;

    // Open stake modal (Plan 007)
    // For now, just log
    console.log('Proceeding to stake with draft:', this.draft);
    this.plugin.noticeManager.info('Stake flow coming in Plan 007');

    // The stake modal will be opened here
    // new StakeModal(this.app, this.plugin, this.draft).open();
    // this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();

    // Cleanup
    this.subjectSearch?.destroy();
    this.predicateSearch?.destroy();
    this.objectSearch?.destroy();
  }
}
```

### Register Command (update main.ts)

```typescript
// In main.ts onload()
this.addCommand({
  id: 'publish-claim',
  name: 'Publish claim to Intuition',
  editorCallback: (editor, view) => {
    const selection = editor.getSelection();
    if (!selection) {
      this.noticeManager.warning('Please select text first');
      return;
    }

    const cursor = editor.getCursor('from');
    const start = editor.posToOffset(cursor);
    const end = start + selection.length;

    new ClaimModal(
      this.app,
      this,
      selection,
      view.file?.path || 'unknown',
      { start, end }
    ).open();
  },
});

// Also add keyboard shortcut
this.addCommand({
  id: 'publish-claim-hotkey',
  name: 'Publish selection to Intuition (hotkey)',
  hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
  editorCallback: (editor, view) => {
    // Same as above
  },
});
```

## CSS Styles (add to styles.css)

```css
/* Claim Modal */
.intuition-claim-modal {
  max-width: 600px;
}

.source-text-section {
  margin-bottom: 20px;
}

.source-text-box {
  background: var(--background-secondary);
  padding: 12px;
  border-radius: 4px;
  border-left: 3px solid var(--text-accent);
}

.source-text-box p {
  margin: 0;
  font-style: italic;
}

.source-text-warning {
  margin-top: 8px;
  color: var(--text-warning);
  font-size: 12px;
}

.triple-input-section h3 {
  margin-bottom: 12px;
}

.triple-row {
  margin-bottom: 12px;
}

.triple-row label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

.claim-status-box {
  padding: 12px;
  border-radius: 4px;
  margin: 16px 0;
}

.claim-status-box.status-checking {
  background: var(--background-secondary);
}

.claim-status-box.status-exists {
  background: rgba(0, 200, 100, 0.1);
  border: 1px solid rgba(0, 200, 100, 0.3);
}

.claim-status-box.status-new {
  background: rgba(100, 100, 255, 0.1);
  border: 1px solid rgba(100, 100, 255, 0.3);
}

.claim-status-box.status-error {
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.3);
}

.consensus-bar-container {
  display: flex;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.consensus-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
}

.consensus-bar.for {
  background: rgba(0, 200, 100, 0.8);
  color: white;
}

.consensus-bar.against {
  background: rgba(255, 100, 100, 0.8);
  color: white;
}

.consensus-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.validation-errors {
  margin-bottom: 12px;
}

.validation-error {
  color: var(--text-error);
  font-size: 12px;
}
```

## Acceptance Criteria
- [ ] Modal opens with selected text displayed
- [ ] Auto-extraction suggests Subject/Predicate/Object
- [ ] Each field has atom search with autocomplete
- [ ] "Create new atom" available for each field
- [ ] Existence check shows claim status
- [ ] Existing claims show consensus percentage
- [ ] Validation prevents invalid submissions
- [ ] Modal accessible via command palette
- [ ] Hotkey Ctrl/Cmd+Shift+I works
- [ ] Cancel closes modal without action

## Testing
1. Select text "Ethereum uses proof-of-stake"
2. Invoke command - verify modal opens
3. Verify auto-extraction fills fields
4. Modify subject to existing atom - verify search
5. Check status shows if claim exists
6. Try with invalid/hedged text
7. Test keyboard shortcut

## Estimated Effort
High - Core user workflow with multiple components
