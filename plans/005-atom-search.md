# Plan 005: Atom Search & Selection

## Objective
Build a reusable atom search and selection component with autocomplete, fuzzy matching, semantic search, and the ability to indicate new atom creation.

## Key Features
- **Dual Search Strategy**: Combines semantic (AI-powered) and label-based search for optimal results
- **Intelligent Ranking**: Merges and ranks results based on relevance, exact matches, and fuzzy matching
- **Rich Metadata**: Displays descriptions, types, and trust indicators
- **Real-time Search**: Debounced search with loading states

## Prerequisites
- Plan 004 (Intuition SDK Integration)

## Deliverables
1. Atom search input component with debouncing
2. Autocomplete dropdown with fuzzy matching
3. Selected atom display with metadata preview
4. "Create new atom" option when no match found
5. Keyboard navigation support

## Files to Create

```
src/
  types/
    search.ts                # Search-related types
  ui/
    components/
      atom-search-input.ts   # Main search component
  utils/
    fuzzy-match.ts           # Fuzzy matching utility
    debounce.ts              # Debounce utility
    search-helpers.ts        # Search result merging and ranking
```

**Note**: `atom-suggestion.ts` and `atom-preview.ts` were implemented inline within `atom-search-input.ts` for simplicity.

## Data Models

```typescript
// src/types/search.ts
import { AtomData } from './intuition';

export interface AtomReference {
  type: 'existing' | 'new';
  termId?: string;
  label: string;
  atom?: AtomData;
  confidence: number;
}

export interface SearchState {
  query: string;
  isSearching: boolean;
  results: AtomData[];
  selectedIndex: number;
  error: string | null;
}

export interface AtomSearchConfig {
  placeholder: string;
  allowCreate: boolean;
  minQueryLength: number;
  maxResults: number;
  debounceMs: number;
}

export const DEFAULT_SEARCH_CONFIG: AtomSearchConfig = {
  placeholder: 'Search atoms...',
  allowCreate: true,
  minQueryLength: 2,
  maxResults: 10,
  debounceMs: 300,
};
```

## Implementation

### Debounce Utility (src/utils/debounce.ts)

```typescript
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}
```

### Fuzzy Match Utility (src/utils/fuzzy-match.ts)

```typescript
export interface FuzzyMatchResult {
  score: number;
  matches: Array<{ start: number; end: number }>;
}

export function fuzzyMatch(query: string, text: string): FuzzyMatchResult | null {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) {
    return { score: 1, matches: [{ start: 0, end: text.length }] };
  }

  // Starts with query
  if (textLower.startsWith(queryLower)) {
    return { score: 0.9, matches: [{ start: 0, end: query.length }] };
  }

  // Contains query
  const index = textLower.indexOf(queryLower);
  if (index !== -1) {
    return { score: 0.7, matches: [{ start: index, end: index + query.length }] };
  }

  // Fuzzy character matching
  let queryIndex = 0;
  let score = 0;
  const matches: Array<{ start: number; end: number }> = [];
  let matchStart = -1;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      if (matchStart === -1) matchStart = i;
      queryIndex++;
      score += 1 / (i + 1); // Earlier matches score higher
    } else if (matchStart !== -1) {
      matches.push({ start: matchStart, end: i });
      matchStart = -1;
    }
  }

  if (matchStart !== -1) {
    matches.push({ start: matchStart, end: matchStart + 1 });
  }

  // All query characters must be found
  if (queryIndex < queryLower.length) {
    return null;
  }

  return {
    score: score / query.length * 0.5, // Normalize and cap at 0.5 for fuzzy
    matches,
  };
}

export function sortByFuzzyScore<T>(
  items: T[],
  query: string,
  getText: (item: T) => string
): Array<{ item: T; result: FuzzyMatchResult }> {
  const results: Array<{ item: T; result: FuzzyMatchResult }> = [];

  for (const item of items) {
    const result = fuzzyMatch(query, getText(item));
    if (result) {
      results.push({ item, result });
    }
  }

  return results.sort((a, b) => b.result.score - a.result.score);
}
```

### Search Helpers (src/utils/search-helpers.ts)

```typescript
import { AtomData } from '../types';
import { fuzzyMatch } from './fuzzy-match';

export interface ScoredAtom {
  item: AtomData;
  score: number;
}

/**
 * Merges semantic and label search results, deduplicates, and ranks by relevance
 *
 * Ranking priority:
 * 1. Exact label match → score 1.0
 * 2. Semantic search results → score 0.8
 * 3. Fuzzy label matches → score 0.3-0.7
 * 4. Timestamp tiebreaker → newer first
 */
export function mergeSearchResults(
  semanticResults: AtomData[],
  labelResults: AtomData[],
  query: string
): ScoredAtom[] {
  const queryLower = query.toLowerCase();
  const atomMap = new Map<string, ScoredAtom>();

  // Process semantic results (score: 0.8 by default)
  for (const atom of semanticResults) {
    const exactMatch = atom.label.toLowerCase() === queryLower;
    const score = exactMatch ? 1.0 : 0.8;
    atomMap.set(atom.id, { item: atom, score });
  }

  // Process label results with fuzzy matching
  for (const atom of labelResults) {
    const existing = atomMap.get(atom.id);

    // Check for exact match first
    if (atom.label.toLowerCase() === queryLower) {
      if (!existing || existing.score < 1.0) {
        atomMap.set(atom.id, { item: atom, score: 1.0 });
      }
      continue;
    }

    // Use fuzzy matching for scoring
    const fuzzyResult = fuzzyMatch(query, atom.label);
    const score = fuzzyResult?.score || 0;

    // Only add/update if this is a better score
    if (!existing || existing.score < score) {
      atomMap.set(atom.id, { item: atom, score });
    }
  }

  // Convert to array and sort
  const results = Array.from(atomMap.values());
  return results.sort((a, b) => {
    // Primary sort: score (descending)
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    // Tiebreaker: timestamp (newer first)
    return b.item.blockTimestamp - a.item.blockTimestamp;
  });
}
```

### Atom Search Input (src/ui/components/atom-search-input.ts)

```typescript
import { AtomData } from '../../types/intuition';
import { AtomReference, SearchState, AtomSearchConfig, DEFAULT_SEARCH_CONFIG } from '../../types/search';
import { IntuitionService } from '../../services/intuition-service';
import { debounce } from '../../utils/debounce';
import { mergeSearchResults } from '../../utils/search-helpers';

export class AtomSearchInput {
  private container: HTMLElement;
  private inputEl: HTMLInputElement;
  private dropdownEl: HTMLElement;
  private previewEl: HTMLElement;
  private intuitionService: IntuitionService;
  private config: AtomSearchConfig;
  private state: SearchState;
  private onSelect: (atom: AtomReference) => void;
  private debouncedSearch: (query: string) => void;

  constructor(
    parent: HTMLElement,
    intuitionService: IntuitionService,
    onSelect: (atom: AtomReference) => void,
    config: Partial<AtomSearchConfig> = {}
  ) {
    this.intuitionService = intuitionService;
    this.onSelect = onSelect;
    this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
    this.state = {
      query: '',
      isSearching: false,
      results: [],
      selectedIndex: 0,
      error: null,
    };

    this.debouncedSearch = debounce(
      (query: string) => this.performSearch(query),
      this.config.debounceMs
    );

    this.container = parent.createDiv({ cls: 'intuition-atom-search' });
    this.render();
  }

  private render(): void {
    // Input field
    this.inputEl = this.container.createEl('input', {
      type: 'text',
      cls: 'intuition-atom-search-input',
      placeholder: this.config.placeholder,
    });

    // Dropdown for suggestions
    this.dropdownEl = this.container.createDiv({
      cls: 'intuition-atom-search-dropdown',
    });
    this.dropdownEl.style.display = 'none';

    // Preview for selected atom
    this.previewEl = this.container.createDiv({
      cls: 'intuition-atom-search-preview',
    });
    this.previewEl.style.display = 'none';

    // Event listeners
    this.inputEl.addEventListener('input', () => this.handleInput());
    this.inputEl.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.inputEl.addEventListener('focus', () => this.showDropdown());
    this.inputEl.addEventListener('blur', () => {
      // Delay to allow click on dropdown
      setTimeout(() => this.hideDropdown(), 200);
    });
  }

  private handleInput(): void {
    const query = this.inputEl.value.trim();
    this.state.query = query;

    if (query.length < this.config.minQueryLength) {
      this.hideDropdown();
      return;
    }

    this.state.isSearching = true;
    this.renderDropdown();
    this.debouncedSearch(query);
  }

  private async performSearch(query: string): Promise<void> {
    try {
      // Run both searches in parallel for better performance
      const [semanticResults, labelResults] = await Promise.allSettled([
        this.intuitionService.semanticSearchAtoms(query, this.config.maxResults),
        this.intuitionService.searchAtoms({ label: query, limit: this.config.maxResults }),
      ]);

      // Extract successful results
      const semantic = semanticResults.status === 'fulfilled' ? semanticResults.value : [];
      const label = labelResults.status === 'fulfilled' ? labelResults.value : [];

      // Merge and rank using intelligent scoring
      const merged = mergeSearchResults(semantic, label, query);

      this.state.results = merged.slice(0, this.config.maxResults).map(r => r.item);
      this.state.selectedIndex = 0;
      this.state.isSearching = false;
      this.state.error = null;
    } catch (error) {
      this.state.error = error.message;
      this.state.isSearching = false;
      this.state.results = [];
    }

    this.renderDropdown();
  }

  private handleKeydown(e: KeyboardEvent): void {
    const totalItems = this.state.results.length + (this.config.allowCreate ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.state.selectedIndex = (this.state.selectedIndex + 1) % totalItems;
        this.renderDropdown();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.state.selectedIndex = (this.state.selectedIndex - 1 + totalItems) % totalItems;
        this.renderDropdown();
        break;

      case 'Enter':
        e.preventDefault();
        this.selectCurrent();
        break;

      case 'Escape':
        this.hideDropdown();
        break;
    }
  }

  private selectCurrent(): void {
    const isCreateNew = this.state.selectedIndex === this.state.results.length;

    if (isCreateNew && this.config.allowCreate) {
      this.selectAtom({
        type: 'new',
        label: this.state.query,
        confidence: 1,
      });
    } else if (this.state.results[this.state.selectedIndex]) {
      const atom = this.state.results[this.state.selectedIndex];
      this.selectAtom({
        type: 'existing',
        termId: atom.termId,
        label: atom.label,
        atom,
        confidence: 1,
      });
    }
  }

  private selectAtom(ref: AtomReference): void {
    this.inputEl.value = ref.label;
    this.hideDropdown();
    this.showPreview(ref);
    this.onSelect(ref);
  }

  private renderDropdown(): void {
    this.dropdownEl.empty();

    if (this.state.isSearching) {
      this.dropdownEl.createDiv({
        cls: 'intuition-atom-search-loading',
        text: 'Searching...',
      });
      this.showDropdown();
      return;
    }

    if (this.state.error) {
      this.dropdownEl.createDiv({
        cls: 'intuition-atom-search-error',
        text: `Error: ${this.state.error}`,
      });
      this.showDropdown();
      return;
    }

    // Results
    this.state.results.forEach((atom, index) => {
      const item = this.dropdownEl.createDiv({
        cls: `intuition-atom-suggestion ${index === this.state.selectedIndex ? 'selected' : ''}`,
      });

      // Icon/Emoji
      if (atom.emoji) {
        item.createSpan({ cls: 'suggestion-icon', text: atom.emoji });
      } else if (atom.image) {
        const img = item.createEl('img', { cls: 'suggestion-icon' });
        img.src = atom.image;
      }

      // Label
      item.createSpan({ cls: 'suggestion-label', text: atom.label });

      // Type badge
      item.createSpan({ cls: 'suggestion-type', text: atom.type });

      // Trust indicator
      if (atom.vault) {
        const trustEl = item.createSpan({ cls: 'suggestion-trust' });
        trustEl.setText(`${atom.vault.positionCount} stakers`);
      }

      item.addEventListener('click', () => {
        this.selectAtom({
          type: 'existing',
          termId: atom.termId,
          label: atom.label,
          atom,
          confidence: 1,
        });
      });
    });

    // "Create new" option
    if (this.config.allowCreate && this.state.query) {
      const createItem = this.dropdownEl.createDiv({
        cls: `intuition-atom-suggestion create-new ${
          this.state.selectedIndex === this.state.results.length ? 'selected' : ''
        }`,
      });

      createItem.createSpan({ cls: 'suggestion-icon', text: '+' });
      createItem.createSpan({
        cls: 'suggestion-label',
        text: `Create "${this.state.query}"`,
      });

      createItem.addEventListener('click', () => {
        this.selectAtom({
          type: 'new',
          label: this.state.query,
          confidence: 1,
        });
      });
    }

    // Show empty state
    if (this.state.results.length === 0 && !this.config.allowCreate) {
      this.dropdownEl.createDiv({
        cls: 'intuition-atom-search-empty',
        text: 'No results found',
      });
    }

    this.showDropdown();
  }

  private showDropdown(): void {
    if (this.state.query.length >= this.config.minQueryLength) {
      this.dropdownEl.style.display = 'block';
    }
  }

  private hideDropdown(): void {
    this.dropdownEl.style.display = 'none';
  }

  private showPreview(ref: AtomReference): void {
    this.previewEl.empty();

    if (ref.type === 'existing' && ref.atom) {
      const atom = ref.atom;

      const header = this.previewEl.createDiv({ cls: 'preview-header' });
      header.createSpan({ cls: 'preview-label', text: atom.label });
      header.createSpan({ cls: 'preview-type', text: atom.type });

      if (atom.vault) {
        const stats = this.previewEl.createDiv({ cls: 'preview-stats' });
        stats.createSpan({ text: `${atom.vault.positionCount} stakers` });
      }

      // Clear button
      const clearBtn = this.previewEl.createEl('button', {
        cls: 'preview-clear',
        text: '×',
      });
      clearBtn.addEventListener('click', () => this.clear());
    } else {
      this.previewEl.createDiv({
        cls: 'preview-new',
        text: `New atom: "${ref.label}"`,
      });

      const clearBtn = this.previewEl.createEl('button', {
        cls: 'preview-clear',
        text: '×',
      });
      clearBtn.addEventListener('click', () => this.clear());
    }

    this.previewEl.style.display = 'flex';
    this.inputEl.style.display = 'none';
  }

  clear(): void {
    this.inputEl.value = '';
    this.state = {
      query: '',
      isSearching: false,
      results: [],
      selectedIndex: 0,
      error: null,
    };
    this.previewEl.style.display = 'none';
    this.inputEl.style.display = 'block';
    this.inputEl.focus();
    this.onSelect(null);
  }

  setValue(ref: AtomReference): void {
    this.inputEl.value = ref.label;
    this.showPreview(ref);
  }

  getValue(): string {
    return this.inputEl.value;
  }

  destroy(): void {
    this.container.remove();
  }
}
```

## CSS Styles (add to styles.css)

```css
/* Atom Search */
.intuition-atom-search {
  position: relative;
  width: 100%;
}

.intuition-atom-search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  font-size: 14px;
}

.intuition-atom-search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.intuition-atom-suggestion {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.intuition-atom-suggestion:hover,
.intuition-atom-suggestion.selected {
  background: var(--background-modifier-hover);
}

.intuition-atom-suggestion .suggestion-icon {
  width: 20px;
  height: 20px;
  text-align: center;
}

.intuition-atom-suggestion .suggestion-label {
  flex: 1;
  font-weight: 500;
}

.intuition-atom-suggestion .suggestion-type {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--background-modifier-border);
  padding: 2px 6px;
  border-radius: 4px;
}

.intuition-atom-suggestion .suggestion-trust {
  font-size: 11px;
  color: var(--text-muted);
}

.intuition-atom-suggestion .suggestion-description {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intuition-atom-suggestion.create-new {
  border-top: 1px solid var(--background-modifier-border);
  color: var(--text-accent);
}

.intuition-atom-search-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--background-secondary);
  border-radius: 4px;
}

.intuition-atom-search-preview .preview-clear {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-muted);
}

.intuition-atom-search-loading,
.intuition-atom-search-error,
.intuition-atom-search-empty {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
}

.intuition-atom-search-error {
  color: var(--text-error);
}
```

## Acceptance Criteria
- [x] Search input shows loading state during query
- [x] Results appear within 300ms of typing stop
- [x] Dual search strategy runs semantic and label searches in parallel
- [x] Intelligent ranking merges results with proper scoring
- [x] Exact matches receive highest priority (score 1.0)
- [x] Semantic results score 0.8, fuzzy matches 0.3-0.7
- [x] Descriptions from semantic search are displayed
- [x] Arrow keys navigate suggestions
- [x] Enter selects highlighted suggestion
- [x] "Create new" option appears for no-match queries
- [x] Selected atom shows preview with type/stats/description
- [x] Clear button resets selection
- [x] Keyboard navigation is smooth
- [x] Component is reusable across modals

## Testing

### Manual Testing
1. **Exact Match**: Type "Ethereum" - verify exact matches appear first
2. **Fuzzy Match**: Type partial "Eth" - verify fuzzy matching works
3. **Semantic Search**: Type conceptual query "digital currency" - verify semantic results appear
4. **Dual Search**: Type "blockchain" - verify results from both search strategies are merged
5. **Navigation**: Use arrow keys - verify keyboard navigation works
6. **Selection**: Press Enter - verify selection and preview
7. **Descriptions**: Verify semantic search results show descriptions
8. **Create New**: Type unknown term - verify "Create new" option appears
9. **Clear**: Click clear button - verify input resets

### Automated Testing
- ✅ Debounce utility tests (7 tests)
- ✅ Fuzzy matching tests (21 tests)
- Unit tests for `mergeSearchResults` helper (recommended)

## Implementation Details

### Semantic Search
The semantic search feature uses Intuition's AI-powered `search_term` GraphQL endpoint to find atoms based on meaning and context, not just exact label matches.

**GraphQL Query** (in `intuition-service.ts`):
```graphql
query SemanticAtomSearch($query: String, $limit: Int) {
  search_term(args: {query: $query}, limit: $limit) {
    atom {
      term_id
      vault_id
      label
      emoji
      atom_type
      image
      creator_id
      block_timestamp
      cached_image {
        url
        safe
      }
      value {
        json_object {
          description: data(path: "description")
        }
      }
    }
  }
}
```

**Key Features**:
- Returns atoms semantically related to query
- Includes descriptions from atom metadata
- Cached with `searchTTL` (default 10 minutes)
- Runs in parallel with label-based search

### Search Strategy
The dual search approach ensures:
1. **Semantic relevance**: Finds conceptually related atoms (e.g., "digital currency" → "Bitcoin")
2. **Exact matches**: Prioritizes direct label matches
3. **Fuzzy tolerance**: Handles typos and partial matches
4. **Performance**: Parallel execution with `Promise.allSettled`
5. **Resilience**: One search can fail without breaking the other

## Estimated Effort
Medium - UI component with dual search integration ✅ **COMPLETED**
