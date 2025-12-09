# Plan 012: Portfolio Dashboard

## Objective
Create a sidebar view showing the user's staked positions across the knowledge graph with P&L tracking and management capabilities.

## Prerequisites
- Plan 003 (Wallet Infrastructure)
- Plan 004 (Intuition SDK Integration)

## Deliverables
1. Portfolio sidebar view
2. Position list with current values
3. P&L calculations and display
4. Position filtering and sorting
5. Quick actions (view details, redeem)

## Files to Create

```
src/
  types/
    portfolio.ts             # Portfolio types
  services/
    portfolio-service.ts     # Position tracking
  ui/
    views/
      portfolio-view.ts      # Main sidebar view
    components/
      portfolio-summary.ts   # Total value/P&L
      position-card.ts       # Individual position
      position-filters.ts    # Sort/filter controls
```

## Data Models

```typescript
// src/types/portfolio.ts
import { TripleData, AtomData } from './intuition';

export interface Portfolio {
  address: string;
  totalValue: bigint;
  totalCost: bigint;       // Sum of all deposits
  unrealizedPnL: bigint;   // totalValue - totalCost
  pnlPercent: number;

  positions: Position[];

  lastUpdated: number;
}

export interface Position {
  id: string;
  type: 'atom' | 'triple';

  // The entity being staked on
  triple?: TripleData;
  atom?: AtomData;

  // Position details
  vaultId: string;
  side: 'for' | 'against' | 'neutral'; // neutral for atoms

  // Holdings
  shares: bigint;
  currentValue: bigint;     // Current value in TRUST
  costBasis: bigint;        // Original deposit amount
  unrealizedPnL: bigint;
  pnlPercent: number;

  // Context
  consensus: number;        // Current consensus (for triples)
  stakerCount: number;
  sharePrice: bigint;

  // Timestamps
  entryTimestamp: number;
  lastActivityTimestamp: number;
}

export interface PortfolioStats {
  totalPositions: number;
  profitablePositions: number;
  losingPositions: number;
  bestPosition: Position | null;
  worstPosition: Position | null;
}

export type PositionSortBy =
  | 'value-desc'
  | 'value-asc'
  | 'pnl-desc'
  | 'pnl-asc'
  | 'entry-desc'
  | 'entry-asc';

export type PositionFilterBy =
  | 'all'
  | 'atoms'
  | 'triples'
  | 'profitable'
  | 'losing';
```

## Implementation

### Portfolio Service (src/services/portfolio-service.ts)

```typescript
import { Events } from 'obsidian';
import { formatEther } from 'viem';
import { IntuitionService } from './intuition-service';
import { WalletService } from './wallet-service';
import { Portfolio, Position, PortfolioStats } from '../types/portfolio';
import IntuitionPlugin from '../main';

export class PortfolioService extends Events {
  private plugin: IntuitionPlugin;
  private intuitionService: IntuitionService;
  private walletService: WalletService;
  private portfolio: Portfolio | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    plugin: IntuitionPlugin,
    intuitionService: IntuitionService,
    walletService: WalletService
  ) {
    super();
    this.plugin = plugin;
    this.intuitionService = intuitionService;
    this.walletService = walletService;
  }

  async initialize(): Promise<void> {
    // Start auto-refresh if wallet is connected
    if (this.walletService.isUnlocked()) {
      await this.refresh();
      this.startAutoRefresh();
    }

    // Refresh when wallet unlocks
    this.walletService.on('unlocked', async () => {
      await this.refresh();
      this.startAutoRefresh();
    });

    this.walletService.on('locked', () => {
      this.stopAutoRefresh();
      this.portfolio = null;
      this.trigger('portfolio-updated', null);
    });
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    // Refresh every 2 minutes
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, 120000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refresh(): Promise<Portfolio | null> {
    if (!this.walletService.isUnlocked()) {
      return null;
    }

    const address = this.walletService.getAddress()!;

    try {
      // Fetch all positions from GraphQL
      const rawPositions = await this.fetchPositions(address);

      // Calculate portfolio values
      const positions: Position[] = [];
      let totalValue = 0n;
      let totalCost = 0n;

      for (const raw of rawPositions) {
        const position = await this.processPosition(raw);
        if (position) {
          positions.push(position);
          totalValue += position.currentValue;
          totalCost += position.costBasis;
        }
      }

      const unrealizedPnL = totalValue - totalCost;
      const pnlPercent = totalCost > 0n
        ? Number((unrealizedPnL * 10000n) / totalCost) / 100
        : 0;

      this.portfolio = {
        address,
        totalValue,
        totalCost,
        unrealizedPnL,
        pnlPercent,
        positions,
        lastUpdated: Date.now(),
      };

      this.trigger('portfolio-updated', this.portfolio);
      return this.portfolio;
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
      return null;
    }
  }

  private async fetchPositions(address: string): Promise<any[]> {
    const query = `
      query GetPositions($address: String!) {
        positions(
          where: { account_id: { _eq: $address }, shares: { _gt: "0" } }
          order_by: { shares: desc }
        ) {
          id
          account_id
          vault_id
          shares
          vault {
            id
            current_share_price
            position_count
            atom {
              id
              term_id
              label
              type
              image
            }
            triple {
              id
              subject { id term_id label }
              predicate { id term_id label }
              object { id term_id label }
              vault { position_count current_share_price }
              counter_vault { position_count current_share_price }
            }
          }
        }
      }
    `;

    const result = await this.intuitionService.graphql.query(query, {
      address: address.toLowerCase(),
    });

    return result.positions || [];
  }

  private async processPosition(raw: any): Promise<Position | null> {
    const vault = raw.vault;
    if (!vault) return null;

    const shares = BigInt(raw.shares);
    const sharePrice = BigInt(vault.current_share_price || 1e18);
    const currentValue = (shares * sharePrice) / BigInt(1e18);

    // Estimate cost basis (simplified - would need deposit history for accuracy)
    const costBasis = currentValue; // Assume break-even for now
    const unrealizedPnL = currentValue - costBasis;
    const pnlPercent = costBasis > 0n
      ? Number((unrealizedPnL * 10000n) / costBasis) / 100
      : 0;

    if (vault.triple) {
      // Triple position
      const triple = vault.triple;
      const isForVault = vault.id === triple.vault?.id;

      // Calculate consensus
      const forCount = triple.vault?.position_count || 0;
      const againstCount = triple.counter_vault?.position_count || 0;
      const totalCount = forCount + againstCount;
      const consensus = totalCount > 0 ? (forCount / totalCount) * 100 : 50;

      return {
        id: raw.id,
        type: 'triple',
        triple: {
          id: triple.id,
          tripleId: triple.id,
          subject: triple.subject,
          predicate: triple.predicate,
          object: triple.object,
        } as any,
        vaultId: vault.id,
        side: isForVault ? 'for' : 'against',
        shares,
        currentValue,
        costBasis,
        unrealizedPnL,
        pnlPercent,
        consensus,
        stakerCount: vault.position_count || 0,
        sharePrice,
        entryTimestamp: 0, // Would need from events
        lastActivityTimestamp: Date.now(),
      };
    } else if (vault.atom) {
      // Atom position
      return {
        id: raw.id,
        type: 'atom',
        atom: {
          id: vault.atom.id,
          termId: vault.atom.term_id,
          label: vault.atom.label,
          type: vault.atom.type,
          image: vault.atom.image,
        } as any,
        vaultId: vault.id,
        side: 'neutral',
        shares,
        currentValue,
        costBasis,
        unrealizedPnL,
        pnlPercent,
        consensus: 0,
        stakerCount: vault.position_count || 0,
        sharePrice,
        entryTimestamp: 0,
        lastActivityTimestamp: Date.now(),
      };
    }

    return null;
  }

  getPortfolio(): Portfolio | null {
    return this.portfolio;
  }

  getStats(): PortfolioStats | null {
    if (!this.portfolio) return null;

    const positions = this.portfolio.positions;
    const profitable = positions.filter(p => p.pnlPercent > 0);
    const losing = positions.filter(p => p.pnlPercent < 0);

    return {
      totalPositions: positions.length,
      profitablePositions: profitable.length,
      losingPositions: losing.length,
      bestPosition: profitable.length > 0
        ? profitable.reduce((a, b) => a.pnlPercent > b.pnlPercent ? a : b)
        : null,
      worstPosition: losing.length > 0
        ? losing.reduce((a, b) => a.pnlPercent < b.pnlPercent ? a : b)
        : null,
    };
  }

  cleanup(): void {
    this.stopAutoRefresh();
  }
}
```

### Portfolio View (src/ui/views/portfolio-view.ts)

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { formatEther } from 'viem';
import IntuitionPlugin from '../../main';
import { Portfolio, Position, PositionSortBy, PositionFilterBy } from '../../types/portfolio';
import { NETWORKS } from '../../types/networks';

export const PORTFOLIO_VIEW_TYPE = 'intuition-portfolio-view';

export class PortfolioView extends ItemView {
  plugin: IntuitionPlugin;
  private sortBy: PositionSortBy = 'value-desc';
  private filterBy: PositionFilterBy = 'all';

  constructor(leaf: WorkspaceLeaf, plugin: IntuitionPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return PORTFOLIO_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Intuition Portfolio';
  }

  getIcon(): string {
    return 'wallet';
  }

  async onOpen(): Promise<void> {
    // Listen for updates
    this.plugin.portfolioService.on('portfolio-updated', () => this.render());

    this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('intuition-portfolio-view');

    // Check wallet status
    if (!this.plugin.walletService.isUnlocked()) {
      this.renderNoWallet(container);
      return;
    }

    const portfolio = this.plugin.portfolioService.getPortfolio();
    if (!portfolio) {
      this.renderLoading(container);
      return;
    }

    // Render sections
    this.renderSummary(container, portfolio);
    this.renderControls(container);
    this.renderPositions(container, portfolio);
  }

  private renderNoWallet(container: Element): void {
    const message = container.createDiv({ cls: 'portfolio-message' });
    message.createEl('p', { text: 'Connect your wallet to view portfolio' });

    const btn = message.createEl('button', {
      text: 'Setup Wallet',
      cls: 'mod-cta',
    });
    btn.addEventListener('click', () => {
      // Open wallet setup modal
    });
  }

  private renderLoading(container: Element): void {
    const message = container.createDiv({ cls: 'portfolio-message' });
    message.createEl('p', { text: 'Loading portfolio...' });
  }

  private renderSummary(container: Element, portfolio: Portfolio): void {
    const summary = container.createDiv({ cls: 'portfolio-summary' });

    // Total value
    const totalValue = Number(portfolio.totalValue) / 1e18;
    summary.createEl('h3', {
      text: `${totalValue.toFixed(4)} TRUST`,
      cls: 'total-value',
    });

    // P&L
    const pnlClass = portfolio.pnlPercent >= 0 ? 'positive' : 'negative';
    const pnlSign = portfolio.pnlPercent >= 0 ? '+' : '';
    const pnlValue = Number(portfolio.unrealizedPnL) / 1e18;

    const pnlEl = summary.createDiv({ cls: `portfolio-pnl ${pnlClass}` });
    pnlEl.createSpan({ text: `${pnlSign}${pnlValue.toFixed(4)} TRUST` });
    pnlEl.createSpan({ text: ` (${pnlSign}${portfolio.pnlPercent.toFixed(2)}%)` });

    // Stats
    const stats = this.plugin.portfolioService.getStats();
    if (stats) {
      const statsEl = summary.createDiv({ cls: 'portfolio-stats' });
      statsEl.createSpan({ text: `${stats.totalPositions} positions` });
      statsEl.createSpan({ text: `${stats.profitablePositions} profitable` });
      statsEl.createSpan({ text: `${stats.losingPositions} losing` });
    }

    // Last updated
    const updated = summary.createDiv({ cls: 'last-updated' });
    updated.createSpan({
      text: `Updated ${this.formatTime(portfolio.lastUpdated)}`,
    });

    const refreshBtn = updated.createEl('button', { text: 'Refresh' });
    refreshBtn.addEventListener('click', () => {
      this.plugin.portfolioService.refresh();
    });
  }

  private renderControls(container: Element): void {
    const controls = container.createDiv({ cls: 'portfolio-controls' });

    // Sort dropdown
    const sortLabel = controls.createEl('label', { text: 'Sort: ' });
    const sortSelect = sortLabel.createEl('select');

    const sortOptions: Array<{ value: PositionSortBy; label: string }> = [
      { value: 'value-desc', label: 'Value (high to low)' },
      { value: 'value-asc', label: 'Value (low to high)' },
      { value: 'pnl-desc', label: 'P&L (best first)' },
      { value: 'pnl-asc', label: 'P&L (worst first)' },
    ];

    for (const opt of sortOptions) {
      const optEl = sortSelect.createEl('option', { text: opt.label });
      optEl.value = opt.value;
      if (opt.value === this.sortBy) optEl.selected = true;
    }

    sortSelect.addEventListener('change', () => {
      this.sortBy = sortSelect.value as PositionSortBy;
      this.render();
    });

    // Filter dropdown
    const filterLabel = controls.createEl('label', { text: 'Filter: ' });
    const filterSelect = filterLabel.createEl('select');

    const filterOptions: Array<{ value: PositionFilterBy; label: string }> = [
      { value: 'all', label: 'All' },
      { value: 'triples', label: 'Claims only' },
      { value: 'atoms', label: 'Atoms only' },
      { value: 'profitable', label: 'Profitable' },
      { value: 'losing', label: 'Losing' },
    ];

    for (const opt of filterOptions) {
      const optEl = filterSelect.createEl('option', { text: opt.label });
      optEl.value = opt.value;
      if (opt.value === this.filterBy) optEl.selected = true;
    }

    filterSelect.addEventListener('change', () => {
      this.filterBy = filterSelect.value as PositionFilterBy;
      this.render();
    });
  }

  private renderPositions(container: Element, portfolio: Portfolio): void {
    const positions = this.filterPositions(this.sortPositions(portfolio.positions));

    if (positions.length === 0) {
      container.createDiv({
        cls: 'portfolio-empty',
        text: 'No positions found',
      });
      return;
    }

    const list = container.createDiv({ cls: 'positions-list' });

    for (const position of positions) {
      this.renderPosition(list, position);
    }
  }

  private renderPosition(container: Element, position: Position): void {
    const card = container.createDiv({ cls: `position-card type-${position.type}` });

    // Header
    const header = card.createDiv({ cls: 'position-header' });

    if (position.type === 'triple' && position.triple) {
      const t = position.triple;
      header.createSpan({
        cls: 'position-title',
        text: `${t.subject.label} → ${t.predicate.label} → ${t.object.label}`,
      });
      header.createSpan({
        cls: `position-side side-${position.side}`,
        text: position.side.toUpperCase(),
      });
    } else if (position.type === 'atom' && position.atom) {
      header.createSpan({
        cls: 'position-title',
        text: position.atom.label,
      });
      header.createSpan({
        cls: 'position-type',
        text: position.atom.type,
      });
    }

    // Value
    const valueSection = card.createDiv({ cls: 'position-value' });
    const value = Number(position.currentValue) / 1e18;
    valueSection.createSpan({ text: `${value.toFixed(4)} TRUST` });

    // P&L
    const pnlClass = position.pnlPercent >= 0 ? 'positive' : 'negative';
    const pnlSign = position.pnlPercent >= 0 ? '+' : '';
    valueSection.createSpan({
      cls: `position-pnl ${pnlClass}`,
      text: `${pnlSign}${position.pnlPercent.toFixed(2)}%`,
    });

    // Details
    const details = card.createDiv({ cls: 'position-details' });
    details.createSpan({ text: `${formatEther(position.shares)} shares` });
    details.createSpan({ text: `${position.stakerCount} stakers` });

    if (position.type === 'triple') {
      details.createSpan({ text: `${position.consensus.toFixed(0)}% consensus` });
    }

    // Actions
    const actions = card.createDiv({ cls: 'position-actions' });

    const viewBtn = actions.createEl('button', { text: 'View' });
    viewBtn.addEventListener('click', () => {
      const network = NETWORKS[this.plugin.settings.network];
      const url = position.type === 'triple'
        ? `${network.explorerUrl}/claim/${position.triple?.tripleId}`
        : `${network.explorerUrl}/atom/${position.atom?.termId}`;
      window.open(url, '_blank');
    });

    const redeemBtn = actions.createEl('button', { text: 'Redeem' });
    redeemBtn.addEventListener('click', () => {
      this.plugin.noticeManager.info('Redeem functionality coming soon');
    });
  }

  private sortPositions(positions: Position[]): Position[] {
    const sorted = [...positions];

    switch (this.sortBy) {
      case 'value-desc':
        return sorted.sort((a, b) => Number(b.currentValue - a.currentValue));
      case 'value-asc':
        return sorted.sort((a, b) => Number(a.currentValue - b.currentValue));
      case 'pnl-desc':
        return sorted.sort((a, b) => b.pnlPercent - a.pnlPercent);
      case 'pnl-asc':
        return sorted.sort((a, b) => a.pnlPercent - b.pnlPercent);
      default:
        return sorted;
    }
  }

  private filterPositions(positions: Position[]): Position[] {
    switch (this.filterBy) {
      case 'atoms':
        return positions.filter(p => p.type === 'atom');
      case 'triples':
        return positions.filter(p => p.type === 'triple');
      case 'profitable':
        return positions.filter(p => p.pnlPercent > 0);
      case 'losing':
        return positions.filter(p => p.pnlPercent < 0);
      default:
        return positions;
    }
  }

  private formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  }

  async onClose(): Promise<void> {
    // Cleanup
  }
}
```

## CSS Styles (add to styles.css)

```css
/* Portfolio View */
.intuition-portfolio-view {
  padding: 16px;
}

.portfolio-message {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.portfolio-summary {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--background-secondary);
  border-radius: 8px;
}

.portfolio-summary .total-value {
  margin: 0 0 8px 0;
  font-size: 24px;
}

.portfolio-pnl {
  font-size: 14px;
  margin-bottom: 12px;
}

.portfolio-pnl.positive {
  color: var(--text-success);
}

.portfolio-pnl.negative {
  color: var(--text-error);
}

.portfolio-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.last-updated {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-muted);
}

.portfolio-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.portfolio-controls label {
  font-size: 12px;
}

.portfolio-controls select {
  margin-left: 4px;
}

.portfolio-empty {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
}

.positions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.position-card {
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 6px;
  border-left: 3px solid var(--background-modifier-border);
}

.position-card.type-triple {
  border-left-color: var(--interactive-accent);
}

.position-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.position-title {
  font-weight: 500;
  font-size: 13px;
}

.position-side {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.position-side.side-for {
  background: rgba(34, 197, 94, 0.2);
  color: var(--text-success);
}

.position-side.side-against {
  background: rgba(239, 68, 68, 0.2);
  color: var(--text-error);
}

.position-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.position-pnl {
  font-size: 12px;
  font-weight: 500;
}

.position-details {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.position-actions {
  display: flex;
  gap: 8px;
}

.position-actions button {
  font-size: 11px;
  padding: 4px 8px;
}
```

## Register View (update main.ts)

```typescript
import { PortfolioView, PORTFOLIO_VIEW_TYPE } from './ui/views/portfolio-view';

// In onload():
this.registerView(
  PORTFOLIO_VIEW_TYPE,
  (leaf) => new PortfolioView(leaf, this)
);

// Add ribbon icon to open portfolio
this.addRibbonIcon('wallet', 'Intuition Portfolio', () => {
  this.activateView(PORTFOLIO_VIEW_TYPE);
});

// Helper method
async activateView(viewType: string): Promise<void> {
  const { workspace } = this.app;

  let leaf = workspace.getLeavesOfType(viewType)[0];

  if (!leaf) {
    leaf = workspace.getRightLeaf(false);
    await leaf.setViewState({ type: viewType, active: true });
  }

  workspace.revealLeaf(leaf);
}
```

## Acceptance Criteria
- [ ] Portfolio view accessible from sidebar
- [ ] Shows total portfolio value in TRUST
- [ ] Shows P&L with positive/negative coloring
- [ ] Lists all positions with current values
- [ ] Positions sortable by value/P&L
- [ ] Positions filterable by type/status
- [ ] Position cards show all relevant info
- [ ] "View" opens explorer link
- [ ] Auto-refresh every 2 minutes
- [ ] Manual refresh button works
- [ ] Empty state when no positions
- [ ] Prompt to connect wallet when locked

## Testing Strategy

### Test Files to Create

```
src/
  types/
    portfolio.spec.ts            # Portfolio type tests
  services/
    portfolio-service.spec.ts    # Position tracking tests
  ui/
    views/
      portfolio-view.spec.ts     # Main view tests
    components/
      portfolio-summary.spec.ts  # Summary component tests
      position-card.spec.ts      # Position card tests
      position-filters.spec.ts   # Filter component tests

tests/
  integration/
    portfolio-dashboard.integration.spec.ts  # End-to-end portfolio tests
  fixtures/
    portfolio.ts                 # Portfolio test fixtures
    positions.ts                 # Position test data
```

### Unit Tests

#### src/services/portfolio-service.spec.ts (~45 tests, 95% coverage)

**Initialization (6 tests)**
- Should initialize with null portfolio if wallet locked
- Should refresh portfolio if wallet unlocked
- Should start auto-refresh if wallet unlocked
- Should listen for wallet unlock events
- Should listen for wallet lock events
- Should clear portfolio on wallet lock

**Auto-Refresh (6 tests)**
- Should start auto-refresh every 2 minutes
- Should stop auto-refresh on stopAutoRefresh call
- Should restart auto-refresh on wallet unlock
- Should stop auto-refresh on wallet lock
- Should handle multiple start calls gracefully
- Should clear interval on cleanup

**refresh() (10 tests)**
- Should return null if wallet not unlocked
- Should fetch positions from GraphQL
- Should process each raw position
- Should calculate total value correctly
- Should calculate total cost correctly
- Should calculate unrealized P&L correctly
- Should calculate P&L percentage correctly
- Should emit portfolio-updated event
- Should update lastUpdated timestamp
- Should handle API errors gracefully

**fetchPositions() (6 tests)**
- Should query positions for address
- Should filter positions with shares > 0
- Should order by shares descending
- Should include vault and atom/triple data
- Should lowercase address for query
- Should handle empty results

**processPosition() (10 tests)**
- Should return null for positions without vault
- Should calculate current value from shares and price
- Should process triple positions correctly
- Should process atom positions correctly
- Should determine position side (for/against)
- Should calculate consensus for triples
- Should set type correctly
- Should handle missing vault data
- Should use default share price if missing
- Should handle bigint calculations correctly

**getStats() (5 tests)**
- Should return null if no portfolio
- Should count total positions
- Should count profitable positions
- Should count losing positions
- Should find best and worst positions

**cleanup() (2 tests)**
- Should stop auto-refresh
- Should handle multiple cleanup calls

#### src/ui/views/portfolio-view.spec.ts (~40 tests, 90% coverage)

**View Setup (5 tests)**
- Should register correct view type
- Should set correct display text
- Should set correct icon
- Should subscribe to portfolio updates
- Should call render on open

**No Wallet State (4 tests)**
- Should show message if wallet not unlocked
- Should show "Setup Wallet" button
- Should open wallet setup on button click
- Should style message correctly

**Loading State (2 tests)**
- Should show loading message if portfolio null
- Should display loading indicator

**Summary Section (8 tests)**
- Should display total value in TRUST
- Should format value to 4 decimal places
- Should display P&L with sign
- Should apply positive class for gains
- Should apply negative class for losses
- Should show stats (total, profitable, losing)
- Should show last updated time
- Should render refresh button

**Controls Section (6 tests)**
- Should render sort dropdown
- Should render filter dropdown
- Should have correct sort options
- Should have correct filter options
- Should update sortBy on change
- Should update filterBy on change

**Position Rendering (8 tests)**
- Should render all positions after sort/filter
- Should show empty message if no positions
- Should render triple positions correctly
- Should render atom positions correctly
- Should display position side badge
- Should display current value
- Should display P&L percentage
- Should display position details

**Sorting (5 tests)**
- Should sort by value descending
- Should sort by value ascending
- Should sort by P&L descending
- Should sort by P&L ascending
- Should maintain stable sort

**Filtering (5 tests)**
- Should show all positions by default
- Should filter atoms only
- Should filter triples only
- Should filter profitable only
- Should filter losing only

**User Actions (4 tests)**
- Should open explorer on "View" click
- Should use correct network URL
- Should trigger redeem on button click
- Should handle refresh button click

#### src/types/portfolio.spec.ts (~12 tests, 100% coverage)

**Type Validations (6 tests)**
- Should validate Portfolio structure
- Should validate Position structure
- Should validate PortfolioStats structure
- Should handle optional fields
- Should handle bigint fields
- Should validate sort/filter enum values

**Position Type (6 tests)**
- Should accept 'atom' type
- Should accept 'triple' type
- Should accept valid side values
- Should require numeric pnlPercent
- Should require bigint shares
- Should require timestamp fields

#### src/ui/components/position-card.spec.ts (~15 tests, 90% coverage)

**Rendering (8 tests)**
- Should render card container
- Should apply type-specific class
- Should render header with title
- Should render side badge for triples
- Should render type badge for atoms
- Should render value section
- Should render details section
- Should render action buttons

**Triple Position Display (4 tests)**
- Should format triple as "Subject → Predicate → Object"
- Should show consensus percentage
- Should color side badge correctly
- Should handle long entity names

**Atom Position Display (3 tests)**
- Should display atom label
- Should show atom type badge
- Should handle missing image

#### src/ui/components/portfolio-summary.spec.ts (~10 tests, 90% coverage)

**Value Display (4 tests)**
- Should format total value correctly
- Should handle very large values
- Should handle zero value
- Should use TRUST suffix

**P&L Display (4 tests)**
- Should show positive P&L in green
- Should show negative P&L in red
- Should include + sign for positive
- Should format percentage to 2 decimals

**Stats Display (2 tests)**
- Should show position counts
- Should handle null stats

### Integration Tests

#### tests/integration/portfolio-dashboard.integration.spec.ts (~25 tests)

**Portfolio Loading (6 tests)**
- Should load portfolio on wallet unlock
- Should display positions in view
- Should calculate totals correctly
- Should show correct P&L colors
- Should handle empty portfolio
- Should show loading state initially

**Auto-Refresh (4 tests)**
- Should refresh after 2 minutes
- Should update displayed values
- Should maintain sort/filter state
- Should show updated timestamp

**Sorting & Filtering (6 tests)**
- Should apply sort to displayed positions
- Should apply filter to displayed positions
- Should combine sort and filter
- Should persist selection across refreshes
- Should handle empty results
- Should update UI immediately

**User Actions (5 tests)**
- Should open explorer with correct URL
- Should trigger redeem flow
- Should handle manual refresh
- Should handle wallet disconnect
- Should restore state on reconnect

**Error Handling (4 tests)**
- Should handle network errors gracefully
- Should show error message
- Should allow retry
- Should maintain previous data on error

### Test Fixtures

```typescript
// tests/fixtures/portfolio.ts
export const mockPortfolio: Portfolio = {
  address: '0x1234567890abcdef1234567890abcdef12345678',
  totalValue: BigInt(150e18),
  totalCost: BigInt(100e18),
  unrealizedPnL: BigInt(50e18),
  pnlPercent: 50.0,
  positions: [mockTriplePosition, mockAtomPosition],
  lastUpdated: Date.now(),
};

export const mockEmptyPortfolio: Portfolio = {
  address: '0x1234567890abcdef1234567890abcdef12345678',
  totalValue: BigInt(0),
  totalCost: BigInt(0),
  unrealizedPnL: BigInt(0),
  pnlPercent: 0,
  positions: [],
  lastUpdated: Date.now(),
};

export const mockPortfolioStats: PortfolioStats = {
  totalPositions: 5,
  profitablePositions: 3,
  losingPositions: 2,
  bestPosition: mockTriplePosition,
  worstPosition: mockLosingPosition,
};

// tests/fixtures/positions.ts
export const mockTriplePosition: Position = {
  id: 'pos-1',
  type: 'triple',
  triple: {
    id: 'triple-1',
    tripleId: '123',
    subject: { id: '1', termId: '1', label: 'Ethereum' },
    predicate: { id: '2', termId: '2', label: 'is' },
    object: { id: '3', termId: '3', label: 'decentralized' },
  },
  vaultId: 'vault-1',
  side: 'for',
  shares: BigInt(10e18),
  currentValue: BigInt(12e18),
  costBasis: BigInt(10e18),
  unrealizedPnL: BigInt(2e18),
  pnlPercent: 20.0,
  consensus: 75.5,
  stakerCount: 50,
  sharePrice: BigInt(1.2e18),
  entryTimestamp: Date.now() - 86400000,
  lastActivityTimestamp: Date.now(),
};

export const mockAtomPosition: Position = {
  id: 'pos-2',
  type: 'atom',
  atom: {
    id: '4',
    termId: 'atom-4',
    label: 'Bitcoin',
    type: 'entity',
    image: 'https://example.com/btc.png',
  },
  vaultId: 'vault-2',
  side: 'neutral',
  shares: BigInt(5e18),
  currentValue: BigInt(6e18),
  costBasis: BigInt(5e18),
  unrealizedPnL: BigInt(1e18),
  pnlPercent: 20.0,
  consensus: 0,
  stakerCount: 30,
  sharePrice: BigInt(1.2e18),
  entryTimestamp: Date.now() - 172800000,
  lastActivityTimestamp: Date.now(),
};

export const mockLosingPosition: Position = {
  ...mockTriplePosition,
  id: 'pos-3',
  currentValue: BigInt(8e18),
  unrealizedPnL: BigInt(-2e18),
  pnlPercent: -20.0,
};
```

### Mock Requirements

```typescript
// Portfolio service mock
export const createMockPortfolioService = () => ({
  initialize: vi.fn(),
  refresh: vi.fn().mockResolvedValue(mockPortfolio),
  getPortfolio: vi.fn().mockReturnValue(mockPortfolio),
  getStats: vi.fn().mockReturnValue(mockPortfolioStats),
  cleanup: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  trigger: vi.fn(),
});

// GraphQL response mock for positions
export const mockPositionsResponse = {
  positions: [
    {
      id: 'pos-1',
      account_id: '0x123...',
      vault_id: 'vault-1',
      shares: '10000000000000000000',
      vault: {
        id: 'vault-1',
        current_share_price: '1200000000000000000',
        position_count: 50,
        triple: {
          id: 'triple-1',
          subject: { id: '1', term_id: '1', label: 'Ethereum' },
          predicate: { id: '2', term_id: '2', label: 'is' },
          object: { id: '3', term_id: '3', label: 'decentralized' },
          vault: { position_count: 40, current_share_price: '1200000000000000000' },
          counter_vault: { position_count: 10, current_share_price: '1000000000000000000' },
        },
      },
    },
  ],
};
```

### Coverage Targets

| File | Target | Notes |
|------|--------|-------|
| portfolio-service.ts | 95% | Data aggregation, critical |
| portfolio-view.ts | 90% | Main view component |
| position-card.ts | 90% | Position display |
| portfolio-summary.ts | 90% | Summary component |
| position-filters.ts | 90% | Filter controls |
| types/portfolio.ts | 100% | Type definitions |

**Overall Plan 012 Target: 92%+ coverage, ~122 tests**

### Manual Testing Checklist
1. Open portfolio view without wallet - verify prompt
2. Connect wallet - verify positions load
3. Sort by value - verify ordering
4. Filter by triples only - verify filtering
5. Click "View" - verify explorer opens
6. Wait 2 minutes - verify auto-refresh
7. Click refresh - verify manual refresh

## Estimated Effort
Medium - Sidebar view with position aggregation
