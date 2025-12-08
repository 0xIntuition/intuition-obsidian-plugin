# Plan 009: Basic Entity Decorations

## Objective
Implement inline decorations that show trust scores next to wikilinks and recognized entities in notes.

## Prerequisites
- Plan 004 (Intuition SDK Integration)

## Deliverables
1. CodeMirror editor extension for decorations
2. Entity detection (wikilinks primarily)
3. Trust score badge rendering
4. Batch entity lookup with caching
5. Toggle decorations via command/setting

## Files to Create

```
src/
  types/
    decorations.ts           # Decoration types
  services/
    decoration-service.ts    # Decoration management
    entity-detector.ts       # Entity detection
  ui/
    extensions/
      trust-decoration.ts    # CodeMirror extension
    components/
      trust-badge.ts         # Trust score badge
  styles/
    decorations.css          # Badge styles
```

## Data Models

```typescript
// src/types/decorations.ts
import { AtomData } from './intuition';

export interface EntityMatch {
  text: string;
  type: 'wikilink' | 'tag' | 'url';
  position: { from: number; to: number };
}

export interface EntityDecoration {
  entity: EntityMatch;
  atomId: string | null;
  atomData: AtomData | null;
  trustScore: number | null;
  status: DecorationStatus;
}

export type DecorationStatus =
  | 'loading'
  | 'found'
  | 'not-found'
  | 'error';

export type TrustTier = 'high' | 'medium' | 'low' | 'negative' | 'unknown';

export interface TrustBadgeData {
  score: number;
  tier: TrustTier;
  totalStaked: bigint;
  stakerCount: number;
}

export function getTrustTier(score: number | null): TrustTier {
  if (score === null) return 'unknown';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'negative';
}

export function getTrustColor(tier: TrustTier): string {
  switch (tier) {
    case 'high': return '#22c55e';     // Green
    case 'medium': return '#eab308';   // Yellow
    case 'low': return '#f97316';      // Orange
    case 'negative': return '#ef4444'; // Red
    case 'unknown': return '#9ca3af';  // Gray
  }
}
```

## Implementation

### Entity Detector (src/services/entity-detector.ts)

```typescript
import { EntityMatch } from '../types/decorations';

export class EntityDetector {
  // Detect wikilinks: [[Entity Name]]
  private wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

  // Detect hashtags: #EntityName
  private tagRegex = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;

  detectEntities(content: string): EntityMatch[] {
    const entities: EntityMatch[] = [];

    // Find wikilinks
    let match;
    while ((match = this.wikilinkRegex.exec(content)) !== null) {
      entities.push({
        text: match[1], // The linked text (without | alias)
        type: 'wikilink',
        position: {
          from: match.index,
          to: match.index + match[0].length,
        },
      });
    }

    // Reset regex lastIndex
    this.wikilinkRegex.lastIndex = 0;

    // Find tags (optional - can be enabled via settings)
    // while ((match = this.tagRegex.exec(content)) !== null) { ... }

    return entities;
  }

  // Extract entity name from various formats
  normalizeEntityName(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ');
  }
}
```

### Decoration Service (src/services/decoration-service.ts)

```typescript
import { Events } from 'obsidian';
import { IntuitionService } from './intuition-service';
import { EntityDetector } from './entity-detector';
import { CacheService } from './cache-service';
import { EntityMatch, EntityDecoration, TrustBadgeData, getTrustTier } from '../types/decorations';
import { AtomData } from '../types/intuition';
import IntuitionPlugin from '../main';

export class DecorationService extends Events {
  private plugin: IntuitionPlugin;
  private intuitionService: IntuitionService;
  private entityDetector: EntityDetector;
  private cache: CacheService;

  // Map of entity text -> atom data (for quick lookup)
  private entityAtomMap: Map<string, AtomData | null> = new Map();

  // Pending lookups to batch
  private pendingLookups: Set<string> = new Set();
  private lookupTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(plugin: IntuitionPlugin, intuitionService: IntuitionService) {
    super();
    this.plugin = plugin;
    this.intuitionService = intuitionService;
    this.entityDetector = new EntityDetector();
    this.cache = new CacheService();
  }

  detectEntities(content: string): EntityMatch[] {
    return this.entityDetector.detectEntities(content);
  }

  async getDecorations(entities: EntityMatch[]): Promise<EntityDecoration[]> {
    const decorations: EntityDecoration[] = [];

    // Collect entities that need lookup
    const needsLookup: EntityMatch[] = [];

    for (const entity of entities) {
      const normalized = this.entityDetector.normalizeEntityName(entity.text);

      if (this.entityAtomMap.has(normalized)) {
        // Already have data
        const atomData = this.entityAtomMap.get(normalized);
        decorations.push(this.createDecoration(entity, atomData));
      } else {
        // Need to look up
        needsLookup.push(entity);
        decorations.push({
          entity,
          atomId: null,
          atomData: null,
          trustScore: null,
          status: 'loading',
        });
      }
    }

    // Schedule batch lookup
    if (needsLookup.length > 0) {
      this.scheduleBatchLookup(needsLookup);
    }

    return decorations;
  }

  private scheduleBatchLookup(entities: EntityMatch[]): void {
    for (const entity of entities) {
      this.pendingLookups.add(entity.text);
    }

    // Debounce lookups
    if (this.lookupTimeout) {
      clearTimeout(this.lookupTimeout);
    }

    this.lookupTimeout = setTimeout(() => {
      this.executeBatchLookup();
    }, 100); // 100ms debounce
  }

  private async executeBatchLookup(): Promise<void> {
    const lookups = Array.from(this.pendingLookups);
    this.pendingLookups.clear();

    // Look up each entity
    const results = await Promise.all(
      lookups.map(async (text) => {
        const normalized = this.entityDetector.normalizeEntityName(text);

        try {
          // Search for atom
          const response = await this.intuitionService.searchAtoms({
            query: text,
            limit: 1,
          });

          if (response.items.length > 0) {
            // Check for exact match
            const exactMatch = response.items.find(
              a => this.entityDetector.normalizeEntityName(a.label) === normalized
            );

            const atom = exactMatch || response.items[0];
            this.entityAtomMap.set(normalized, atom);
            return { text, atom };
          } else {
            this.entityAtomMap.set(normalized, null);
            return { text, atom: null };
          }
        } catch {
          return { text, atom: null };
        }
      })
    );

    // Notify listeners that decorations are ready
    this.trigger('decorations-updated', results);
  }

  private createDecoration(entity: EntityMatch, atomData: AtomData | null): EntityDecoration {
    if (!atomData) {
      return {
        entity,
        atomId: null,
        atomData: null,
        trustScore: null,
        status: 'not-found',
      };
    }

    // Calculate trust score from vault data
    let trustScore: number | null = null;
    if (atomData.vault) {
      // For atoms, trust is based on total stakers/stake
      // This is simplified - full implementation would consider for/against
      trustScore = Math.min(100, atomData.vault.positionCount * 2);
    }

    return {
      entity,
      atomId: atomData.termId,
      atomData,
      trustScore,
      status: 'found',
    };
  }

  getBadgeData(decoration: EntityDecoration): TrustBadgeData | null {
    if (decoration.status !== 'found' || !decoration.atomData) {
      return null;
    }

    const atom = decoration.atomData;
    const score = decoration.trustScore || 0;

    return {
      score,
      tier: getTrustTier(score),
      totalStaked: atom.vault?.totalAssets || 0n,
      stakerCount: atom.vault?.positionCount || 0,
    };
  }

  clearCache(): void {
    this.entityAtomMap.clear();
    this.cache.clear();
  }
}
```

### CodeMirror Extension (src/ui/extensions/trust-decoration.ts)

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
import { DecorationService } from '../../services/decoration-service';
import { EntityDecoration, getTrustTier, getTrustColor } from '../../types/decorations';
import IntuitionPlugin from '../../main';

class TrustBadgeWidget extends WidgetType {
  constructor(
    private decoration: EntityDecoration,
    private plugin: IntuitionPlugin
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const badge = document.createElement('span');
    badge.className = 'intuition-trust-badge';

    if (this.decoration.status === 'loading') {
      badge.classList.add('loading');
      badge.textContent = '...';
      return badge;
    }

    if (this.decoration.status === 'not-found') {
      badge.classList.add('unknown');
      badge.textContent = '?';
      badge.title = 'Not in knowledge graph';
      return badge;
    }

    if (this.decoration.status === 'found' && this.decoration.trustScore !== null) {
      const tier = getTrustTier(this.decoration.trustScore);
      badge.classList.add(`tier-${tier}`);
      badge.style.backgroundColor = getTrustColor(tier);

      const score = this.decoration.trustScore;
      badge.textContent = `${score}%`;

      const stakerCount = this.decoration.atomData?.vault?.positionCount || 0;
      badge.title = `Trust: ${score}% | ${stakerCount} stakers`;

      // Click to show hover card (Plan 010)
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Will open hover card in Plan 010
        console.log('Badge clicked:', this.decoration.atomData);
      });
    }

    return badge;
  }

  eq(other: TrustBadgeWidget): boolean {
    return (
      this.decoration.entity.text === other.decoration.entity.text &&
      this.decoration.status === other.decoration.status &&
      this.decoration.trustScore === other.decoration.trustScore
    );
  }
}

export function createTrustDecorationPlugin(plugin: IntuitionPlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private decorationService: DecorationService;
      private pendingUpdate = false;

      constructor(view: EditorView) {
        this.decorationService = plugin.decorationService;
        this.decorations = Decoration.none;

        // Initial decoration
        this.updateDecorations(view);

        // Listen for decoration updates
        this.decorationService.on('decorations-updated', () => {
          if (!this.pendingUpdate) {
            this.pendingUpdate = true;
            requestAnimationFrame(() => {
              this.updateDecorations(view);
              this.pendingUpdate = false;
            });
          }
        });
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.updateDecorations(update.view);
        }
      }

      private async updateDecorations(view: EditorView) {
        if (!plugin.settings.features.enableDecorations) {
          this.decorations = Decoration.none;
          return;
        }

        const content = view.state.doc.toString();
        const entities = this.decorationService.detectEntities(content);
        const decorationData = await this.decorationService.getDecorations(entities);

        const builder = new RangeSetBuilder<Decoration>();

        // Sort by position
        decorationData.sort((a, b) => a.entity.position.from - b.entity.position.from);

        for (const dec of decorationData) {
          // Add widget after the wikilink
          const widget = Decoration.widget({
            widget: new TrustBadgeWidget(dec, plugin),
            side: 1, // After
          });

          builder.add(dec.entity.position.to, dec.entity.position.to, widget);
        }

        this.decorations = builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
```

### Register Extension (update main.ts)

```typescript
import { createTrustDecorationPlugin } from './ui/extensions/trust-decoration';

// In onload():
this.registerEditorExtension(createTrustDecorationPlugin(this));

// Add command to toggle decorations
this.addCommand({
  id: 'toggle-decorations',
  name: 'Toggle entity decorations',
  callback: () => {
    this.settings.features.enableDecorations = !this.settings.features.enableDecorations;
    this.saveSettings();
    // Force editor refresh
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() === 'markdown') {
        // Trigger re-render
        leaf.view.editor?.refresh();
      }
    });
  },
});
```

## CSS Styles (add to styles.css)

```css
/* Trust Badges */
.intuition-trust-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 18px;
  padding: 0 4px;
  margin-left: 4px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  vertical-align: middle;
}

.intuition-trust-badge.loading {
  background: var(--background-modifier-border);
  color: var(--text-muted);
  animation: pulse 1.5s ease-in-out infinite;
}

.intuition-trust-badge.unknown {
  background: #9ca3af;
  color: white;
  font-size: 12px;
}

.intuition-trust-badge.tier-high {
  background: #22c55e;
}

.intuition-trust-badge.tier-medium {
  background: #eab308;
}

.intuition-trust-badge.tier-low {
  background: #f97316;
}

.intuition-trust-badge.tier-negative {
  background: #ef4444;
}

.intuition-trust-badge:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Reading view decorations */
.markdown-preview-view .intuition-trust-badge {
  margin-left: 2px;
}
```

## Acceptance Criteria
- [ ] Wikilinks show trust badge after link
- [ ] Badge color reflects trust tier (green/yellow/orange/red/gray)
- [ ] Badges update when file content changes
- [ ] Entity lookup is batched for performance
- [ ] Unknown entities show gray "?" badge
- [ ] Decorations toggle via command
- [ ] Decorations respect settings toggle
- [ ] No decorations in source view mode
- [ ] Badges are clickable (for hover card)
- [ ] Loading state shows while fetching

## Testing
1. Create note with wikilinks like [[Ethereum]], [[Bitcoin]]
2. Verify badges appear after each link
3. Check colors match trust tiers
4. Toggle decorations off - verify hidden
5. Add new wikilink - verify badge appears
6. Check performance with many links (>50)

## Estimated Effort
Medium - CodeMirror extension with async data
