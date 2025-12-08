# Plan 008: Offline Queue & Sync Engine

## Objective
Implement offline-first architecture with IndexedDB storage, publish queue management, and automatic synchronization when connectivity is restored.

## Prerequisites
- Plan 004 (Intuition SDK Integration)
- Plan 007 (Claim Publishing)

## Deliverables
1. IndexedDB database schema and setup
2. Offline queue data store
3. Network connectivity detection
4. Automatic queue processing on reconnect
5. Queue management UI (sidebar panel)
6. Conflict resolution for pending items

## Files to Create

```
src/
  types/
    queue.ts                 # Queue item types
    database.ts              # Database schema types
  services/
    database-service.ts      # IndexedDB wrapper
    queue-service.ts         # Queue management
    connectivity-service.ts  # Network monitoring
  ui/
    views/
      queue-panel.ts         # Queue sidebar panel
    components/
      queue-item.ts          # Individual queue item
      sync-status.ts         # Sync status indicator
```

## Data Models

```typescript
// src/types/queue.ts
import type { Hex } from 'viem';
import { ClaimDraft } from './claims';
import { StakeConfig } from './staking';

export interface QueueItem {
  id: string;
  createdAt: number;
  updatedAt: number;

  type: 'publishClaim';
  status: QueueItemStatus;

  // Payload
  draft: ClaimDraft;
  stakeConfig: StakeConfig;

  // Execution state
  attempts: number;
  lastAttempt: number | null;
  error: string | null;

  // Result (after success)
  result?: {
    tripleId: Hex;
    transactionHashes: Hex[];
  };
}

export type QueueItemStatus =
  | 'pending'      // Waiting to be processed
  | 'processing'   // Currently being processed
  | 'retrying'     // Failed, will retry
  | 'failed'       // Failed permanently
  | 'completed';   // Successfully completed

export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  total: number;
}

// src/types/database.ts
export interface DatabaseSchema {
  queue: QueueItem;
  cache: CacheEntry;
}

export interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  ttl: number;
}
```

## Implementation

### Database Service (src/services/database-service.ts)

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { QueueItem } from '../types/queue';
import { CacheEntry } from '../types/database';

interface IntuitionDB extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: {
      'by-status': string;
      'by-createdAt': number;
    };
  };
  cache: {
    key: string;
    value: CacheEntry;
    indexes: {
      'by-timestamp': number;
    };
  };
}

export class DatabaseService {
  private db: IDBPDatabase<IntuitionDB> | null = null;
  private dbName = 'intuition-obsidian';
  private dbVersion = 1;

  async initialize(): Promise<void> {
    this.db = await openDB<IntuitionDB>(this.dbName, this.dbVersion, {
      upgrade(db) {
        // Queue store
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
          queueStore.createIndex('by-status', 'status');
          queueStore.createIndex('by-createdAt', 'createdAt');
        }

        // Cache store
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }

  // Queue operations
  async addToQueue(item: QueueItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('queue', item);
  }

  async getQueueItem(id: string): Promise<QueueItem | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('queue', id);
  }

  async getAllQueueItems(): Promise<QueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAll('queue');
  }

  async getQueueItemsByStatus(status: string): Promise<QueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAllFromIndex('queue', 'by-status', status);
  }

  async updateQueueItem(item: QueueItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    item.updatedAt = Date.now();
    await this.db.put('queue', item);
  }

  async deleteQueueItem(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('queue', id);
  }

  async clearQueue(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.clear('queue');
  }

  // Cache operations
  async setCache(key: string, data: unknown, ttl: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('cache', {
      key,
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  async getCache<T>(key: string): Promise<T | null> {
    if (!this.db) throw new Error('Database not initialized');
    const entry = await this.db.get('cache', key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      await this.db.delete('cache', key);
      return null;
    }

    return entry.data as T;
  }

  async clearExpiredCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    const all = await this.db.getAll('cache');

    for (const entry of all) {
      if (now - entry.timestamp > entry.ttl) {
        await this.db.delete('cache', entry.key);
      }
    }
  }

  async clearAllCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.clear('cache');
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
```

### Connectivity Service (src/services/connectivity-service.ts)

```typescript
import { Events } from 'obsidian';

export type ConnectivityStatus = 'online' | 'offline' | 'checking';

export class ConnectivityService extends Events {
  private status: ConnectivityStatus = 'checking';
  private checkInterval: number | null = null;
  private apiUrl: string;

  constructor(apiUrl: string) {
    super();
    this.apiUrl = apiUrl;
  }

  async initialize(): Promise<void> {
    // Initial check
    await this.checkConnectivity();

    // Listen for browser online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Periodic checks (every 30 seconds when online, every 10 when offline)
    this.startPeriodicCheck();
  }

  private handleOnline(): void {
    this.checkConnectivity();
  }

  private handleOffline(): void {
    this.setStatus('offline');
  }

  private async checkConnectivity(): Promise<void> {
    this.setStatus('checking');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.setStatus('online');
      } else {
        this.setStatus('offline');
      }
    } catch {
      this.setStatus('offline');
    }
  }

  private setStatus(status: ConnectivityStatus): void {
    const previousStatus = this.status;
    this.status = status;

    if (previousStatus !== status) {
      this.trigger('status-change', status, previousStatus);

      if (previousStatus === 'offline' && status === 'online') {
        this.trigger('reconnected');
      }
    }
  }

  private startPeriodicCheck(): void {
    const check = () => {
      const interval = this.status === 'online' ? 30000 : 10000;
      this.checkInterval = window.setTimeout(async () => {
        await this.checkConnectivity();
        check();
      }, interval);
    };
    check();
  }

  getStatus(): ConnectivityStatus {
    return this.status;
  }

  isOnline(): boolean {
    return this.status === 'online';
  }

  cleanup(): void {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
    }
    window.removeEventListener('online', () => this.handleOnline());
    window.removeEventListener('offline', () => this.handleOffline());
  }
}
```

### Queue Service (src/services/queue-service.ts)

```typescript
import { Events } from 'obsidian';
import { DatabaseService } from './database-service';
import { ConnectivityService } from './connectivity-service';
import { TransactionService } from './transaction-service';
import { QueueItem, QueueItemStatus, QueueStats } from '../types/queue';
import { ClaimDraft } from '../types/claims';
import { StakeConfig } from '../types/staking';
import IntuitionPlugin from '../main';

export class QueueService extends Events {
  private plugin: IntuitionPlugin;
  private database: DatabaseService;
  private connectivity: ConnectivityService;
  private transactionService: TransactionService;
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelayMs = 5000;

  constructor(
    plugin: IntuitionPlugin,
    database: DatabaseService,
    connectivity: ConnectivityService,
    transactionService: TransactionService
  ) {
    super();
    this.plugin = plugin;
    this.database = database;
    this.connectivity = connectivity;
    this.transactionService = transactionService;

    // Process queue when reconnected
    this.connectivity.on('reconnected', () => {
      this.processQueue();
    });
  }

  async add(draft: ClaimDraft, stakeConfig: StakeConfig): Promise<string> {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type: 'publishClaim',
      status: 'pending',
      draft,
      stakeConfig,
      attempts: 0,
      lastAttempt: null,
      error: null,
    };

    await this.database.addToQueue(item);
    this.trigger('item-added', item);

    // Try to process immediately if online
    if (this.connectivity.isOnline()) {
      this.processQueue();
    }

    return item.id;
  }

  async getAll(): Promise<QueueItem[]> {
    return this.database.getAllQueueItems();
  }

  async getPending(): Promise<QueueItem[]> {
    const pending = await this.database.getQueueItemsByStatus('pending');
    const retrying = await this.database.getQueueItemsByStatus('retrying');
    return [...pending, ...retrying].sort((a, b) => a.createdAt - b.createdAt);
  }

  async getStats(): Promise<QueueStats> {
    const all = await this.database.getAllQueueItems();

    return {
      pending: all.filter(i => i.status === 'pending').length,
      processing: all.filter(i => i.status === 'processing').length,
      failed: all.filter(i => i.status === 'failed').length,
      completed: all.filter(i => i.status === 'completed').length,
      total: all.length,
    };
  }

  async retry(id: string): Promise<void> {
    const item = await this.database.getQueueItem(id);
    if (!item) return;

    item.status = 'pending';
    item.attempts = 0;
    item.error = null;
    await this.database.updateQueueItem(item);
    this.trigger('item-updated', item);

    if (this.connectivity.isOnline()) {
      this.processQueue();
    }
  }

  async remove(id: string): Promise<void> {
    await this.database.deleteQueueItem(id);
    this.trigger('item-removed', id);
  }

  async clearCompleted(): Promise<void> {
    const completed = await this.database.getQueueItemsByStatus('completed');
    for (const item of completed) {
      await this.database.deleteQueueItem(item.id);
    }
    this.trigger('queue-updated');
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!this.connectivity.isOnline()) return;
    if (!this.plugin.walletService.isUnlocked()) return;

    this.isProcessing = true;
    this.trigger('processing-started');

    try {
      const pending = await this.getPending();

      for (const item of pending) {
        await this.processItem(item);
      }
    } finally {
      this.isProcessing = false;
      this.trigger('processing-finished');
    }
  }

  private async processItem(item: QueueItem): Promise<void> {
    // Update status
    item.status = 'processing';
    item.attempts++;
    item.lastAttempt = Date.now();
    await this.database.updateQueueItem(item);
    this.trigger('item-updated', item);

    try {
      // Build transaction plan
      const plan = await this.transactionService.buildTransactionPlan(
        item.draft,
        item.stakeConfig
      );

      // Execute
      const result = await this.transactionService.executeTransactionPlan(
        item.draft,
        item.stakeConfig,
        plan,
        () => {} // No UI updates for background processing
      );

      if (result.success) {
        item.status = 'completed';
        item.result = {
          tripleId: result.tripleId!,
          transactionHashes: result.transactionHashes,
        };
        item.error = null;

        this.plugin.noticeManager.success(
          `Queued claim published: ${item.draft.subject?.label} → ${item.draft.object?.label}`
        );
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (error) {
      item.error = error.message;

      if (item.attempts >= this.maxRetries) {
        item.status = 'failed';
        this.plugin.noticeManager.error(
          `Claim publishing failed after ${this.maxRetries} attempts`
        );
      } else {
        item.status = 'retrying';

        // Schedule retry
        setTimeout(() => {
          if (this.connectivity.isOnline()) {
            this.processQueue();
          }
        }, this.retryDelayMs * item.attempts);
      }
    }

    await this.database.updateQueueItem(item);
    this.trigger('item-updated', item);
  }
}
```

### Queue Panel (src/ui/views/queue-panel.ts)

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';
import IntuitionPlugin from '../../main';
import { QueueItem, QueueStats } from '../../types/queue';

export const QUEUE_VIEW_TYPE = 'intuition-queue-view';

export class QueuePanel extends ItemView {
  plugin: IntuitionPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: IntuitionPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return QUEUE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Intuition Queue';
  }

  getIcon(): string {
    return 'list-ordered';
  }

  async onOpen(): Promise<void> {
    this.render();

    // Listen for updates
    this.plugin.queueService.on('item-added', () => this.render());
    this.plugin.queueService.on('item-updated', () => this.render());
    this.plugin.queueService.on('item-removed', () => this.render());
    this.plugin.queueService.on('queue-updated', () => this.render());
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('intuition-queue-panel');

    // Header with stats
    const stats = await this.plugin.queueService.getStats();
    this.renderHeader(container, stats);

    // Queue items
    const items = await this.plugin.queueService.getAll();
    this.renderItems(container, items);
  }

  private renderHeader(container: Element, stats: QueueStats): void {
    const header = container.createDiv({ cls: 'queue-header' });

    header.createEl('h4', { text: 'Publish Queue' });

    const statsDiv = header.createDiv({ cls: 'queue-stats' });

    if (stats.pending > 0) {
      statsDiv.createSpan({ text: `${stats.pending} pending`, cls: 'stat pending' });
    }
    if (stats.processing > 0) {
      statsDiv.createSpan({ text: `${stats.processing} processing`, cls: 'stat processing' });
    }
    if (stats.failed > 0) {
      statsDiv.createSpan({ text: `${stats.failed} failed`, cls: 'stat failed' });
    }

    // Connection status
    const status = this.plugin.connectivityService.getStatus();
    const statusEl = header.createDiv({ cls: `connection-status ${status}` });
    statusEl.createSpan({
      text: status === 'online' ? '● Online' : status === 'offline' ? '○ Offline' : '◐ Checking',
    });

    // Actions
    if (stats.completed > 0) {
      const clearBtn = header.createEl('button', {
        text: 'Clear completed',
        cls: 'queue-action',
      });
      clearBtn.addEventListener('click', () => {
        this.plugin.queueService.clearCompleted();
      });
    }
  }

  private renderItems(container: Element, items: QueueItem[]): void {
    if (items.length === 0) {
      container.createDiv({
        cls: 'queue-empty',
        text: 'No items in queue',
      });
      return;
    }

    const list = container.createDiv({ cls: 'queue-list' });

    // Sort: processing first, then pending, then retrying, then failed, then completed
    const statusOrder = ['processing', 'pending', 'retrying', 'failed', 'completed'];
    items.sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

    for (const item of items) {
      this.renderItem(list, item);
    }
  }

  private renderItem(container: Element, item: QueueItem): void {
    const itemEl = container.createDiv({ cls: `queue-item status-${item.status}` });

    // Status icon
    const statusIcon = this.getStatusIcon(item.status);
    itemEl.createSpan({ cls: 'item-status', text: statusIcon });

    // Content
    const content = itemEl.createDiv({ cls: 'item-content' });

    const title = `${item.draft.subject?.label} → ${item.draft.predicate?.label} → ${item.draft.object?.label}`;
    content.createSpan({ cls: 'item-title', text: title });

    const meta = content.createDiv({ cls: 'item-meta' });
    meta.createSpan({ text: this.formatTime(item.createdAt) });

    if (item.error) {
      meta.createSpan({ cls: 'item-error', text: item.error });
    }

    // Actions
    const actions = itemEl.createDiv({ cls: 'item-actions' });

    if (item.status === 'failed' || item.status === 'retrying') {
      const retryBtn = actions.createEl('button', { text: 'Retry' });
      retryBtn.addEventListener('click', () => {
        this.plugin.queueService.retry(item.id);
      });
    }

    if (item.status !== 'processing') {
      const removeBtn = actions.createEl('button', { text: '×' });
      removeBtn.addEventListener('click', () => {
        this.plugin.queueService.remove(item.id);
      });
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '○';
      case 'processing': return '◐';
      case 'retrying': return '↻';
      case 'failed': return '✗';
      case 'completed': return '✓';
      default: return '?';
    }
  }

  private formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  async onClose(): Promise<void> {
    // Cleanup listeners
  }
}
```

## CSS Styles (add to styles.css)

```css
/* Queue Panel */
.intuition-queue-panel {
  padding: 12px;
}

.queue-header {
  margin-bottom: 16px;
}

.queue-header h4 {
  margin: 0 0 8px 0;
}

.queue-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.queue-stats .stat {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}

.queue-stats .stat.pending {
  background: var(--background-modifier-hover);
}

.queue-stats .stat.processing {
  background: rgba(100, 100, 255, 0.2);
}

.queue-stats .stat.failed {
  background: rgba(255, 100, 100, 0.2);
}

.connection-status {
  font-size: 12px;
  margin-bottom: 8px;
}

.connection-status.online {
  color: var(--text-success);
}

.connection-status.offline {
  color: var(--text-error);
}

.queue-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 20px;
}

.queue-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.queue-item .item-status {
  font-size: 16px;
}

.queue-item .item-content {
  flex: 1;
}

.queue-item .item-title {
  font-size: 13px;
  display: block;
}

.queue-item .item-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.queue-item .item-error {
  color: var(--text-error);
  margin-left: 8px;
}

.queue-item .item-actions {
  display: flex;
  gap: 4px;
}

.queue-item .item-actions button {
  font-size: 11px;
  padding: 2px 6px;
}

.queue-item.status-completed {
  opacity: 0.6;
}

.queue-item.status-failed {
  background: rgba(255, 100, 100, 0.05);
}
```

## Acceptance Criteria
- [ ] IndexedDB creates tables on first run
- [ ] Offline publishes queue locally
- [ ] Queue panel shows all items with status
- [ ] Reconnection triggers queue processing
- [ ] Failed items show retry option
- [ ] Items can be removed from queue
- [ ] Completed items can be cleared
- [ ] Status bar shows queue count
- [ ] Automatic retry works

## Testing
1. Add item to queue while online - verify processes
2. Go offline, add item - verify queued
3. Come back online - verify processes
4. Force failure - verify retry logic
5. Open queue panel - verify all items shown
6. Clear completed - verify removed

## Estimated Effort
Medium - IndexedDB setup with background processing
