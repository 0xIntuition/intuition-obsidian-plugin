# Plan 010: Knowledge Graph Hover Cards

## Objective
Implement rich hover cards that appear when hovering over decorated entities, showing detailed information from the knowledge graph.

## Prerequisites
- Plan 004 (Intuition SDK Integration)
- Plan 009 (Basic Entity Decorations)

## Deliverables
1. Hover card component with entity data
2. Top claims/triples involving the entity
3. User's position display (if any)
4. Quick actions (stake, view in explorer)
5. Hover state management (delays, positioning)

## Files to Create

```
src/
  types/
    hover-cards.ts           # Hover card types
  services/
    hover-card-service.ts    # Card data fetching
  ui/
    components/
      hover-card.ts          # Main card component
```

## Data Models

```typescript
// src/types/hover-cards.ts
import { AtomData, TripleData, VaultData } from './intuition';

export interface HoverCardData {
  entity: AtomData;
  trustScore: number;
  totalStaked: bigint;
  stakerCount: number;

  // Related claims (top 5)
  topClaims: TripleData[];

  // User's position if any
  userPosition: UserPosition | null;
}

export interface UserPosition {
  vaultId: string;
  shares: bigint;
  assets: bigint;
  pnlPercent: number;
}

export interface HoverCardConfig {
  showDelay: number;    // ms before showing (default: 300)
  hideDelay: number;    // ms before hiding (default: 200)
  maxWidth: number;     // pixels (default: 400)
  maxClaims: number;    // top N claims (default: 5)
}

export const DEFAULT_HOVER_CONFIG: HoverCardConfig = {
  showDelay: 300,
  hideDelay: 200,
  maxWidth: 400,
  maxClaims: 5,
};
```

## Implementation

### Hover Card Service (src/services/hover-card-service.ts)

```typescript
import { IntuitionService } from './intuition-service';
import { WalletService } from './wallet-service';
import { HoverCardData } from '../types/hover-cards';
import { AtomData } from '../types/intuition';
import IntuitionPlugin from '../main';

export class HoverCardService {
  private plugin: IntuitionPlugin;
  private intuitionService: IntuitionService;
  private walletService: WalletService;
  private cache: Map<string, { data: HoverCardData; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minute

  constructor(
    plugin: IntuitionPlugin,
    intuitionService: IntuitionService,
    walletService: WalletService
  ) {
    this.plugin = plugin;
    this.intuitionService = intuitionService;
    this.walletService = walletService;
  }

  async getHoverCardData(atomId: string): Promise<HoverCardData | null> {
    // Check cache
    const cached = this.cache.get(atomId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      // Fetch atom data
      const atom = await this.intuitionService.getAtom(atomId);
      if (!atom) return null;

      // Fetch related triples (where this atom is subject)
      const triples = await this.fetchRelatedTriples(atomId);

      // Fetch user position if wallet connected
      let userPosition = null;
      if (this.walletService.isUnlocked() && atom.vault) {
        userPosition = await this.fetchUserPosition(atom.vault.id);
      }

      // Calculate trust score
      const trustScore = this.calculateTrustScore(atom);

      const data: HoverCardData = {
        entity: atom,
        trustScore,
        totalStaked: atom.vault?.totalAssets || 0n,
        stakerCount: atom.vault?.positionCount || 0,
        topClaims: triples.slice(0, 5),
        userPosition,
      };

      // Cache result
      this.cache.set(atomId, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      console.error('Failed to fetch hover card data:', error);
      return null;
    }
  }

  private async fetchRelatedTriples(atomId: string): Promise<any[]> {
    // Query triples where this atom is subject
    const query = `
      query GetRelatedTriples($atomId: String!) {
        triples(
          where: { subject_id: { _eq: $atomId } }
          limit: 10
          order_by: { vault: { position_count: desc } }
        ) {
          id
          subject { id term_id label }
          predicate { id term_id label }
          object { id term_id label }
          vault { position_count current_share_price }
          counter_vault { position_count current_share_price }
        }
      }
    `;

    try {
      const response = await this.intuitionService.graphql.query(query, { atomId });
      return response.triples || [];
    } catch {
      return [];
    }
  }

  private async fetchUserPosition(vaultId: string): Promise<any | null> {
    const address = this.walletService.getAddress();
    if (!address) return null;

    try {
      const positions = await this.intuitionService.getUserPositions(address);
      return positions.find(p => p.vaultId === vaultId) || null;
    } catch {
      return null;
    }
  }

  private calculateTrustScore(atom: AtomData): number {
    if (!atom.vault) return 0;

    // Simple trust score based on staker count
    // More sophisticated calculation would consider stake amounts
    const stakerCount = atom.vault.positionCount;

    if (stakerCount >= 100) return 95;
    if (stakerCount >= 50) return 85;
    if (stakerCount >= 20) return 75;
    if (stakerCount >= 10) return 65;
    if (stakerCount >= 5) return 55;
    if (stakerCount >= 1) return 45;
    return 0;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

### Hover Card Component (src/ui/components/hover-card.ts)

```typescript
import { formatEther } from 'viem';
import { HoverCardData, HoverCardConfig, DEFAULT_HOVER_CONFIG } from '../../types/hover-cards';
import { getTrustTier, getTrustColor } from '../../types/decorations';
import { NETWORKS } from '../../types/networks';
import IntuitionPlugin from '../../main';

export class HoverCard {
  private plugin: IntuitionPlugin;
  private config: HoverCardConfig;
  private element: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentAtomId: string | null = null;

  constructor(plugin: IntuitionPlugin, config: Partial<HoverCardConfig> = {}) {
    this.plugin = plugin;
    this.config = { ...DEFAULT_HOVER_CONFIG, ...config };
  }

  show(atomId: string, anchorEl: HTMLElement): void {
    // Cancel any pending hide
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // If same atom, just keep showing
    if (this.element && this.currentAtomId === atomId) {
      return;
    }

    // Schedule show
    this.showTimeout = setTimeout(async () => {
      this.currentAtomId = atomId;
      await this.render(atomId, anchorEl);
    }, this.config.showDelay);
  }

  scheduleHide(): void {
    // Cancel any pending show
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    // Schedule hide
    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, this.config.hideDelay);
  }

  cancelHide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.currentAtomId = null;
  }

  private async render(atomId: string, anchorEl: HTMLElement): Promise<void> {
    // Fetch data
    const data = await this.plugin.hoverCardService.getHoverCardData(atomId);
    if (!data) return;

    // Remove existing card
    this.hide();

    // Create card element
    this.element = document.createElement('div');
    this.element.className = 'intuition-hover-card';
    this.element.style.maxWidth = `${this.config.maxWidth}px`;

    // Keep card visible when hovering over it
    this.element.addEventListener('mouseenter', () => this.cancelHide());
    this.element.addEventListener('mouseleave', () => this.scheduleHide());

    // Render content
    this.renderHeader(data);
    this.renderTrustSection(data);
    this.renderClaims(data);
    this.renderUserPosition(data);
    this.renderActions(data);

    // Position card
    document.body.appendChild(this.element);
    this.positionCard(anchorEl);
  }

  private renderHeader(data: HoverCardData): void {
    const header = this.element!.createDiv({ cls: 'hover-card-header' });

    // Icon/Image
    if (data.entity.emoji) {
      header.createSpan({ cls: 'entity-icon', text: data.entity.emoji });
    } else if (data.entity.image) {
      const img = header.createEl('img', { cls: 'entity-icon' });
      img.src = data.entity.image;
    }

    // Title and type
    const titleSection = header.createDiv({ cls: 'entity-title-section' });
    titleSection.createEl('h4', { text: data.entity.label, cls: 'entity-name' });
    titleSection.createSpan({ text: data.entity.type, cls: 'entity-type' });
  }

  private renderTrustSection(data: HoverCardData): void {
    const section = this.element!.createDiv({ cls: 'hover-card-trust' });

    // Trust score badge
    const tier = getTrustTier(data.trustScore);
    const scoreBadge = section.createDiv({ cls: `trust-score tier-${tier}` });
    scoreBadge.style.backgroundColor = getTrustColor(tier);
    scoreBadge.createSpan({ text: `${data.trustScore}%` });
    scoreBadge.createSpan({ text: tier.charAt(0).toUpperCase() + tier.slice(1) + ' Trust', cls: 'trust-label' });

    // Stats
    const stats = section.createDiv({ cls: 'trust-stats' });
    const staked = Number(data.totalStaked) / 1e18;
    stats.createSpan({ text: `${staked.toFixed(2)} TRUST staked` });
    stats.createSpan({ text: `${data.stakerCount} stakers` });
  }

  private renderClaims(data: HoverCardData): void {
    if (data.topClaims.length === 0) return;

    const section = this.element!.createDiv({ cls: 'hover-card-claims' });
    section.createEl('h5', { text: 'Top Claims' });

    const list = section.createEl('ul');
    for (const claim of data.topClaims) {
      const item = list.createEl('li');
      item.createSpan({ text: `[${claim.predicate.label}] ` });
      item.createSpan({ text: claim.object.label, cls: 'claim-object' });

      // Show consensus if available
      if (claim.vault && claim.counter_vault) {
        const forCount = claim.vault.position_count || 0;
        const againstCount = claim.counter_vault.position_count || 0;
        const total = forCount + againstCount;
        if (total > 0) {
          const percent = Math.round((forCount / total) * 100);
          item.createSpan({ text: ` ${percent}%`, cls: 'claim-consensus' });
        }
      }
    }
  }

  private renderUserPosition(data: HoverCardData): void {
    if (!data.userPosition) return;

    const section = this.element!.createDiv({ cls: 'hover-card-position' });
    section.createEl('h5', { text: 'Your Position' });

    const pos = data.userPosition;
    const details = section.createDiv({ cls: 'position-details' });

    details.createSpan({ text: `${formatEther(pos.shares)} shares` });
    details.createSpan({ text: `${formatEther(pos.assets)} TRUST value` });

    if (pos.pnlPercent !== 0) {
      const pnlClass = pos.pnlPercent >= 0 ? 'positive' : 'negative';
      const pnlSign = pos.pnlPercent >= 0 ? '+' : '';
      details.createSpan({
        text: `${pnlSign}${pos.pnlPercent.toFixed(2)}%`,
        cls: `pnl ${pnlClass}`,
      });
    }
  }

  private renderActions(data: HoverCardData): void {
    const section = this.element!.createDiv({ cls: 'hover-card-actions' });

    // View in explorer
    const network = NETWORKS[this.plugin.settings.network];
    const explorerUrl = `${network.explorerUrl}/atom/${data.entity.termId}`;

    const explorerBtn = section.createEl('a', {
      text: 'View in Explorer',
      cls: 'hover-card-action',
      href: explorerUrl,
    });
    explorerBtn.target = '_blank';

    // Stake button
    const stakeBtn = section.createEl('button', {
      text: 'Stake',
      cls: 'hover-card-action mod-cta',
    });
    stakeBtn.addEventListener('click', () => {
      // Open atom staking modal
      this.hide();
      this.plugin.noticeManager.info('Atom staking coming soon');
    });
  }

  private positionCard(anchorEl: HTMLElement): void {
    if (!this.element) return;

    const anchorRect = anchorEl.getBoundingClientRect();
    const cardRect = this.element.getBoundingClientRect();

    // Default: below and centered
    let left = anchorRect.left + (anchorRect.width / 2) - (cardRect.width / 2);
    let top = anchorRect.bottom + 8;

    // Adjust if off-screen right
    if (left + cardRect.width > window.innerWidth - 16) {
      left = window.innerWidth - cardRect.width - 16;
    }

    // Adjust if off-screen left
    if (left < 16) {
      left = 16;
    }

    // If would be off-screen bottom, show above
    if (top + cardRect.height > window.innerHeight - 16) {
      top = anchorRect.top - cardRect.height - 8;
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }
}
```

### Integrate with Trust Badge (update trust-decoration.ts)

```typescript
// In TrustBadgeWidget class:
toDOM(): HTMLElement {
  const badge = document.createElement('span');
  // ... existing code ...

  if (this.decoration.status === 'found' && this.decoration.atomData) {
    // Add hover listeners
    badge.addEventListener('mouseenter', () => {
      this.plugin.hoverCard.show(this.decoration.atomData!.termId, badge);
    });

    badge.addEventListener('mouseleave', () => {
      this.plugin.hoverCard.scheduleHide();
    });
  }

  return badge;
}
```

## CSS Styles (add to styles.css)

```css
/* Hover Card */
.intuition-hover-card {
  position: fixed;
  z-index: 1000;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 16px;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.hover-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.hover-card-header .entity-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background-secondary);
}

.hover-card-header .entity-name {
  margin: 0;
  font-size: 16px;
}

.hover-card-header .entity-type {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--background-modifier-border);
  padding: 2px 6px;
  border-radius: 4px;
}

.hover-card-trust {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 6px;
  margin-bottom: 12px;
}

.hover-card-trust .trust-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: 6px;
  color: white;
}

.hover-card-trust .trust-score span:first-child {
  font-size: 20px;
  font-weight: 700;
}

.hover-card-trust .trust-label {
  font-size: 10px;
  opacity: 0.9;
}

.hover-card-trust .trust-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--text-muted);
}

.hover-card-claims h5,
.hover-card-position h5 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.hover-card-claims ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.hover-card-claims li {
  padding: 4px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.hover-card-claims li:last-child {
  border-bottom: none;
}

.hover-card-claims .claim-object {
  font-weight: 500;
}

.hover-card-claims .claim-consensus {
  color: var(--text-muted);
  margin-left: 4px;
}

.hover-card-position {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--background-modifier-border);
}

.hover-card-position .position-details {
  display: flex;
  gap: 12px;
  font-size: 13px;
}

.hover-card-position .pnl.positive {
  color: var(--text-success);
}

.hover-card-position .pnl.negative {
  color: var(--text-error);
}

.hover-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--background-modifier-border);
}

.hover-card-action {
  flex: 1;
  text-align: center;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
}

.hover-card-action:not(.mod-cta) {
  background: var(--background-secondary);
  color: var(--text-normal);
}

.hover-card-action.mod-cta {
  background: var(--interactive-accent);
  color: white;
  border: none;
}
```

## Acceptance Criteria
- [ ] Hover over badge shows card after 300ms delay
- [ ] Card shows entity name, type, and icon
- [ ] Trust score displays with correct tier color
- [ ] Top claims list shows (up to 5)
- [ ] User position shows if wallet connected
- [ ] "View in Explorer" opens correct URL
- [ ] "Stake" button works
- [ ] Card hides when mouse leaves (with delay)
- [ ] Card positions correctly (no overflow)
- [ ] Card stays visible when hovering over it

## Testing
1. Hover over trust badge - verify card appears
2. Move mouse away - verify card hides
3. Move mouse to card - verify it stays
4. Check positioning at screen edges
5. Verify external link works
6. Test with/without wallet connected

## Estimated Effort
Medium - Rich UI component with positioning logic
