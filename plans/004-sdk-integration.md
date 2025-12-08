# Plan 004: Intuition SDK Integration

## Objective
Integrate the Intuition SDK and GraphQL client for querying the knowledge graph, with proper caching and error handling.

## Prerequisites
- Plan 001 (Project Foundation)
- Plan 002 (Settings System)
- Plan 003 (Wallet Infrastructure)

## Deliverables
1. Intuition SDK configuration and initialization
2. GraphQL client with request caching
3. Core query functions (atoms, triples, vaults)
4. Network status monitoring
5. In-memory cache with TTL

## Files to Create

```
src/
  types/
    intuition.ts             # Intuition-specific types
    graphql.ts               # GraphQL query types
  services/
    intuition-service.ts     # SDK wrapper service
    graphql-client.ts        # GraphQL client
    cache-service.ts         # In-memory cache
  queries/
    atoms.graphql            # Atom queries
    triples.graphql          # Triple queries
    vaults.graphql           # Vault queries
```

## Data Models

```typescript
// src/types/intuition.ts
import type { Address, Hex } from 'viem';

export interface AtomData {
  id: string;
  termId: string;
  label: string;
  type: AtomType;
  creator: Address;
  vault: VaultData;
  image?: string;
  emoji?: string;
  createdAt: number;
}

export type AtomType = 'Unknown' | 'Thing' | 'Person' | 'Organization' | 'Account' | 'Book';

export interface TripleData {
  id: string;
  tripleId: string;
  subject: AtomData;
  predicate: AtomData;
  object: AtomData;
  creator: Address;
  forVault: VaultData;
  againstVault: VaultData;
  createdAt: number;
}

export interface VaultData {
  id: string;
  totalAssets: bigint;
  totalShares: bigint;
  currentSharePrice: bigint;
  positionCount: number;
}

export interface PositionData {
  id: string;
  accountId: string;
  vaultId: string;
  shares: bigint;
  assets: bigint; // calculated from shares * sharePrice
}

export interface ConsensusData {
  forPercentage: number;
  againstPercentage: number;
  forAssets: bigint;
  againstAssets: bigint;
  totalStaked: bigint;
}

// src/types/graphql.ts
export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  cursor?: string;
}

export interface SearchFilters {
  query: string;
  type?: AtomType;
  limit?: number;
  offset?: number;
}
```

## Implementation

### Cache Service (src/services/cache-service.ts)

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 50 * 1024 * 1024) {
    this.maxSize = maxSize;
  }

  set<T>(key: string, data: T, ttl: number): void {
    // Check size and evict if needed
    this.evictIfNeeded();

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private evictIfNeeded(): void {
    // Simple LRU eviction based on timestamp
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 10%
      const toRemove = Math.floor(entries.length * 0.1);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
}
```

### GraphQL Client (src/services/graphql-client.ts)

```typescript
import { NETWORKS, NetworkType } from '../types/networks';
import { GraphQLResponse, GraphQLError } from '../types/graphql';

export class GraphQLClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(network: NetworkType, customUrl?: string) {
    this.baseUrl = customUrl || NETWORKS[network].graphqlUrl;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  async query<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new GraphQLQueryError(result.errors);
    }

    if (!result.data) {
      throw new Error('No data returned from GraphQL');
    }

    return result.data;
  }

  updateNetwork(network: NetworkType, customUrl?: string): void {
    this.baseUrl = customUrl || NETWORKS[network].graphqlUrl;
  }
}

export class GraphQLQueryError extends Error {
  errors: GraphQLError[];

  constructor(errors: GraphQLError[]) {
    super(errors.map(e => e.message).join(', '));
    this.name = 'GraphQLQueryError';
    this.errors = errors;
  }
}
```

### Intuition Service (src/services/intuition-service.ts)

```typescript
import { Address } from 'viem';
import { GraphQLClient } from './graphql-client';
import { CacheService } from './cache-service';
import { WalletService } from './wallet-service';
import {
  AtomData,
  TripleData,
  VaultData,
  PositionData,
  ConsensusData,
} from '../types/intuition';
import { SearchFilters, PaginatedResponse } from '../types/graphql';
import IntuitionPlugin from '../main';

export class IntuitionService {
  private plugin: IntuitionPlugin;
  private graphql: GraphQLClient;
  private cache: CacheService;
  private walletService: WalletService;

  constructor(plugin: IntuitionPlugin, walletService: WalletService) {
    this.plugin = plugin;
    this.walletService = walletService;
    this.graphql = new GraphQLClient(plugin.settings.network);
    this.cache = new CacheService(plugin.settings.cache.maxCacheSize);
  }

  // ============ ATOMS ============

  async getAtom(termId: string): Promise<AtomData | null> {
    const cacheKey = `atom:${termId}`;
    const cached = this.cache.get<AtomData>(cacheKey);
    if (cached) return cached;

    const query = `
      query GetAtom($termId: String!) {
        atoms(where: { term_id: { _eq: $termId } }, limit: 1) {
          id
          term_id
          label
          type
          creator_id
          image
          emoji
          block_timestamp
          vault {
            id
            total_shares
            current_share_price
            position_count
          }
        }
      }
    `;

    const data = await this.graphql.query<{ atoms: any[] }>(query, { termId });

    if (!data.atoms || data.atoms.length === 0) {
      return null;
    }

    const atom = this.mapAtom(data.atoms[0]);
    this.cache.set(cacheKey, atom, this.plugin.settings.cache.atomTTL);
    return atom;
  }

  async searchAtoms(filters: SearchFilters): Promise<PaginatedResponse<AtomData>> {
    const cacheKey = `search:${JSON.stringify(filters)}`;
    const cached = this.cache.get<PaginatedResponse<AtomData>>(cacheKey);
    if (cached) return cached;

    const query = `
      query SearchAtoms($query: String!, $limit: Int, $offset: Int) {
        atoms(
          where: { label: { _ilike: $query } }
          limit: $limit
          offset: $offset
          order_by: { position_count: desc }
        ) {
          id
          term_id
          label
          type
          creator_id
          image
          emoji
          vault {
            id
            total_shares
            current_share_price
            position_count
          }
        }
        atoms_aggregate(where: { label: { _ilike: $query } }) {
          aggregate {
            count
          }
        }
      }
    `;

    const data = await this.graphql.query<{
      atoms: any[];
      atoms_aggregate: { aggregate: { count: number } };
    }>(query, {
      query: `%${filters.query}%`,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    });

    const result: PaginatedResponse<AtomData> = {
      items: data.atoms.map(a => this.mapAtom(a)),
      totalCount: data.atoms_aggregate.aggregate.count,
      hasMore: (filters.offset || 0) + data.atoms.length < data.atoms_aggregate.aggregate.count,
    };

    this.cache.set(cacheKey, result, this.plugin.settings.cache.searchTTL);
    return result;
  }

  // ============ TRIPLES ============

  async getTriple(tripleId: string): Promise<TripleData | null> {
    const cacheKey = `triple:${tripleId}`;
    const cached = this.cache.get<TripleData>(cacheKey);
    if (cached) return cached;

    const query = `
      query GetTriple($tripleId: String!) {
        triples(where: { id: { _eq: $tripleId } }, limit: 1) {
          id
          subject {
            id
            term_id
            label
            type
            image
          }
          predicate {
            id
            term_id
            label
          }
          object {
            id
            term_id
            label
            type
            image
          }
          creator_id
          block_timestamp
          vault {
            id
            total_shares
            current_share_price
            position_count
          }
          counter_vault {
            id
            total_shares
            current_share_price
            position_count
          }
        }
      }
    `;

    const data = await this.graphql.query<{ triples: any[] }>(query, { tripleId });

    if (!data.triples || data.triples.length === 0) {
      return null;
    }

    const triple = this.mapTriple(data.triples[0]);
    this.cache.set(cacheKey, triple, this.plugin.settings.cache.vaultTTL);
    return triple;
  }

  async findTriple(
    subjectId: string,
    predicateId: string,
    objectId: string
  ): Promise<TripleData | null> {
    const cacheKey = `triple:${subjectId}:${predicateId}:${objectId}`;
    const cached = this.cache.get<TripleData>(cacheKey);
    if (cached) return cached;

    const query = `
      query FindTriple($subjectId: String!, $predicateId: String!, $objectId: String!) {
        triples(
          where: {
            subject_id: { _eq: $subjectId }
            predicate_id: { _eq: $predicateId }
            object_id: { _eq: $objectId }
          }
          limit: 1
        ) {
          id
          subject { id term_id label type image }
          predicate { id term_id label }
          object { id term_id label type image }
          creator_id
          block_timestamp
          vault { id total_shares current_share_price position_count }
          counter_vault { id total_shares current_share_price position_count }
        }
      }
    `;

    const data = await this.graphql.query<{ triples: any[] }>(query, {
      subjectId,
      predicateId,
      objectId,
    });

    if (!data.triples || data.triples.length === 0) {
      return null;
    }

    const triple = this.mapTriple(data.triples[0]);
    this.cache.set(cacheKey, triple, this.plugin.settings.cache.vaultTTL);
    return triple;
  }

  // ============ VAULTS & POSITIONS ============

  async getVaultState(vaultId: string): Promise<VaultData | null> {
    const cacheKey = `vault:${vaultId}`;
    const cached = this.cache.get<VaultData>(cacheKey);
    if (cached) return cached;

    const query = `
      query GetVault($vaultId: String!) {
        vaults(where: { id: { _eq: $vaultId } }, limit: 1) {
          id
          total_shares
          current_share_price
          position_count
        }
      }
    `;

    const data = await this.graphql.query<{ vaults: any[] }>(query, { vaultId });

    if (!data.vaults || data.vaults.length === 0) {
      return null;
    }

    const vault = this.mapVault(data.vaults[0]);
    this.cache.set(cacheKey, vault, this.plugin.settings.cache.vaultTTL);
    return vault;
  }

  async getUserPositions(address: Address): Promise<PositionData[]> {
    const query = `
      query GetUserPositions($address: String!) {
        positions(where: { account_id: { _eq: $address } }) {
          id
          account_id
          vault_id
          shares
        }
      }
    `;

    const data = await this.graphql.query<{ positions: any[] }>(query, {
      address: address.toLowerCase(),
    });

    return data.positions.map(p => this.mapPosition(p));
  }

  // ============ CONSENSUS ============

  calculateConsensus(forVault: VaultData, againstVault: VaultData): ConsensusData {
    const forAssets = forVault.totalAssets;
    const againstAssets = againstVault.totalAssets;
    const totalStaked = forAssets + againstAssets;

    if (totalStaked === 0n) {
      return {
        forPercentage: 50,
        againstPercentage: 50,
        forAssets: 0n,
        againstAssets: 0n,
        totalStaked: 0n,
      };
    }

    const forPercentage = Number((forAssets * 10000n) / totalStaked) / 100;
    const againstPercentage = 100 - forPercentage;

    return {
      forPercentage,
      againstPercentage,
      forAssets,
      againstAssets,
      totalStaked,
    };
  }

  // ============ NETWORK STATUS ============

  async checkConnection(): Promise<boolean> {
    try {
      const query = `query { __typename }`;
      await this.graphql.query(query);
      return true;
    } catch {
      return false;
    }
  }

  // ============ HELPERS ============

  private mapAtom(raw: any): AtomData {
    return {
      id: raw.id,
      termId: raw.term_id,
      label: raw.label || 'Unknown',
      type: raw.type || 'Unknown',
      creator: raw.creator_id as Address,
      vault: raw.vault ? this.mapVault(raw.vault) : null,
      image: raw.image,
      emoji: raw.emoji,
      createdAt: new Date(raw.block_timestamp).getTime(),
    };
  }

  private mapTriple(raw: any): TripleData {
    return {
      id: raw.id,
      tripleId: raw.id,
      subject: this.mapAtom(raw.subject),
      predicate: this.mapAtom(raw.predicate),
      object: this.mapAtom(raw.object),
      creator: raw.creator_id as Address,
      forVault: raw.vault ? this.mapVault(raw.vault) : null,
      againstVault: raw.counter_vault ? this.mapVault(raw.counter_vault) : null,
      createdAt: new Date(raw.block_timestamp).getTime(),
    };
  }

  private mapVault(raw: any): VaultData {
    return {
      id: raw.id,
      totalAssets: BigInt(raw.total_shares || 0) * BigInt(raw.current_share_price || 0) / BigInt(1e18),
      totalShares: BigInt(raw.total_shares || 0),
      currentSharePrice: BigInt(raw.current_share_price || 1e18),
      positionCount: raw.position_count || 0,
    };
  }

  private mapPosition(raw: any): PositionData {
    return {
      id: raw.id,
      accountId: raw.account_id,
      vaultId: raw.vault_id,
      shares: BigInt(raw.shares || 0),
      assets: 0n, // Calculate when needed with share price
    };
  }

  // Update network when settings change
  updateNetwork(): void {
    this.graphql.updateNetwork(
      this.plugin.settings.network,
      this.plugin.settings.customRpcUrl || undefined
    );
    this.cache.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## Acceptance Criteria
- [ ] SDK initializes with correct network config
- [ ] Atom search returns results from GraphQL
- [ ] Triple queries return structured data
- [ ] findTriple correctly identifies existing claims
- [ ] Vault states include TVL and staker count
- [ ] Consensus calculation is accurate
- [ ] Results cache with configurable TTL
- [ ] Cache invalidates on network change
- [ ] Network errors surface to UI
- [ ] Connection check works

## Testing
1. Search for "Ethereum" - verify results
2. Get specific atom by ID - verify data structure
3. Find triple by subject/predicate/object
4. Check vault state for known triple
5. Test cache - same query should be faster
6. Switch network - verify cache clears
7. Test offline - verify error handling

## Estimated Effort
Medium - SDK integration with caching layer
