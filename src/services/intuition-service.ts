/**
 * IntuitionService - Main service for Intuition SDK integration
 *
 * Responsibilities:
 * - Query atoms, triples, vaults, positions
 * - Cache management with TTL
 * - GraphQL field mapping (snake_case → camelCase)
 * - Network switching
 * - Connection health checks
 */

import type { Address } from 'viem';
import { BaseService } from './base-service';
import { GraphQLClient } from './graphql-client';
import { CacheService } from './cache-service';
import {
	AtomData,
	AtomType,
	TripleData,
	VaultData,
	PositionData,
	ConsensusData,
	AtomSearchFilters,
	GraphQLAtom,
	GraphQLTriple,
	GraphQLVault,
	GraphQLPosition,
} from '../types';
import type IntuitionPlugin from '../main';
import type { WalletService } from './wallet-service';

/**
 * GraphQL query strings (inline)
 */
const QUERIES = {
	GET_ATOM: `
		query GetAtom($termId: String!) {
			atoms(where: { term_id: { _eq: $termId } }, limit: 1) {
				term_id
				vault_id
				label
				emoji
				atom_type
				image
				creator_id
				block_timestamp
			}
		}
	`,

	SEARCH_ATOMS: `
		query SearchAtoms($label: String, $type: String, $creatorId: String, $limit: Int, $offset: Int) {
			atoms(
				where: {
					_and: [
						{ label: { _ilike: $label } }
						{ atom_type: { _eq: $type } }
						{ creator_id: { _eq: $creatorId } }
					]
				}
				limit: $limit
				offset: $offset
				order_by: { block_timestamp: desc }
			) {
				term_id
				vault_id
				label
				emoji
				atom_type
				image
				creator_id
				block_timestamp
			}
			atoms_aggregate(
				where: {
					_and: [
						{ label: { _ilike: $label } }
						{ atom_type: { _eq: $type } }
						{ creator_id: { _eq: $creatorId } }
					]
				}
			) {
				aggregate {
					count
				}
			}
		}
	`,

	GET_TRIPLE: `
		query GetTriple($tripleId: String!) {
			triples(where: { id: { _eq: $tripleId } }, limit: 1) {
				id
				vault_id
				subject_id
				predicate_id
				object_id
				creator_id
				block_timestamp
				counter_vault_id
				subject {
					label
				}
				predicate {
					label
				}
				object {
					label
				}
			}
		}
	`,

	FIND_TRIPLE: `
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
				vault_id
				subject_id
				predicate_id
				object_id
				creator_id
				block_timestamp
				counter_vault_id
				subject {
					label
				}
				predicate {
					label
				}
				object {
					label
				}
			}
		}
	`,

	GET_VAULT: `
		query GetVault($vaultId: String!) {
			vaults(where: { id: { _eq: $vaultId } }, limit: 1) {
				id
				atom_id
				triple_id
				total_shares
				current_share_price
				position_count
			}
		}
	`,

	GET_USER_POSITIONS: `
		query GetUserPositions($address: String!) {
			positions(
				where: { account_id: { _eq: $address } }
				order_by: { shares: desc }
			) {
				id
				vault_id
				account_id
				shares
				vault {
					id
					atom_id
					triple_id
					total_shares
					current_share_price
					position_count
				}
			}
		}
	`,
};

export class IntuitionService extends BaseService {
	private graphqlClient: GraphQLClient;
	private cacheService: CacheService;

	constructor(plugin: IntuitionPlugin, _walletService: WalletService) {
		super(plugin);
		this.cacheService = new CacheService();

		// Initialize GraphQL client with current network
		this.graphqlClient = new GraphQLClient(this.plugin.settings.network);
	}

	async initialize(): Promise<void> {
		// Test connection on initialization
		try {
			await this.checkConnection();
			console.log('IntuitionService: Connection test successful');
		} catch (error) {
			console.warn('IntuitionService: Connection test failed', error);
			// Don't throw - allow plugin to load even if network is down
		}
	}

	cleanup(): void {
		this.cacheService.clear();
	}

	/**
	 * Update network and clear cache
	 */
	updateNetwork(network: typeof this.plugin.settings.network): void {
		this.graphqlClient.updateNetwork(network);
		this.cacheService.clear();
		console.log(
			`IntuitionService: Switched to ${network}, cache cleared`
		);
	}

	/**
	 * Check GraphQL connection health
	 */
	async checkConnection(): Promise<boolean> {
		try {
			// Simple query to test connection
			await this.graphqlClient.query<{ atoms: GraphQLAtom[] }>(
				'query TestConnection { atoms(limit: 1) { term_id } }'
			);
			return true;
		} catch (error) {
			console.error('Connection check failed:', error);
			return false;
		}
	}

	// ============================================================================
	// ATOM QUERIES
	// ============================================================================

	/**
	 * Get atom by term ID
	 */
	async getAtom(termId: string): Promise<AtomData | null> {
		const cacheKey = `atom:${termId}`;

		// Check cache
		const cached = this.cacheService.get<AtomData>(cacheKey);
		if (cached) {
			return cached;
		}

		// Query GraphQL
		const response = await this.graphqlClient.query<{
			atoms: GraphQLAtom[];
		}>(QUERIES.GET_ATOM, { termId });

		if (!response.atoms || response.atoms.length === 0) {
			return null;
		}

		const atom = this.mapAtom(response.atoms[0]);

		// Cache result
		this.cacheService.set(
			cacheKey,
			atom,
			this.plugin.settings.cache.atomTTL
		);

		return atom;
	}

	/**
	 * Search atoms with filters
	 */
	async searchAtoms(filters: AtomSearchFilters = {}): Promise<AtomData[]> {
		const { label, type, creatorId, limit = 10, offset = 0 } = filters;

		// Create cache key from filters
		const cacheKey = `search:${JSON.stringify(filters)}`;

		// Check cache
		const cached = this.cacheService.get<AtomData[]>(cacheKey);
		if (cached) {
			return cached;
		}

		// Build variables
		const variables: Record<string, unknown> = {
			limit,
			offset,
		};

		if (label) {
			variables.label = `%${label}%`; // ILIKE pattern
		}
		if (type) {
			variables.type = type;
		}
		if (creatorId) {
			variables.creatorId = creatorId.toLowerCase();
		}

		// Query GraphQL
		const response = await this.graphqlClient.query<{
			atoms: GraphQLAtom[];
		}>(QUERIES.SEARCH_ATOMS, variables);

		const atoms = response.atoms.map((a) => this.mapAtom(a));

		// Cache results
		this.cacheService.set(
			cacheKey,
			atoms,
			this.plugin.settings.cache.searchTTL
		);

		return atoms;
	}

	// ============================================================================
	// TRIPLE QUERIES
	// ============================================================================

	/**
	 * Get triple by ID
	 */
	async getTriple(tripleId: string): Promise<TripleData | null> {
		const cacheKey = `triple:${tripleId}`;

		// Check cache
		const cached = this.cacheService.get<TripleData>(cacheKey);
		if (cached) {
			return cached;
		}

		// Query GraphQL
		const response = await this.graphqlClient.query<{
			triples: GraphQLTriple[];
		}>(QUERIES.GET_TRIPLE, { tripleId });

		if (!response.triples || response.triples.length === 0) {
			return null;
		}

		const triple = this.mapTriple(response.triples[0]);

		// Cache result
		this.cacheService.set(
			cacheKey,
			triple,
			this.plugin.settings.cache.atomTTL
		);

		return triple;
	}

	/**
	 * Find triple by subject-predicate-object
	 */
	async findTriple(
		subjectId: string,
		predicateId: string,
		objectId: string
	): Promise<TripleData | null> {
		const cacheKey = `triple:${subjectId}-${predicateId}-${objectId}`;

		// Check cache
		const cached = this.cacheService.get<TripleData>(cacheKey);
		if (cached) {
			return cached;
		}

		// Query GraphQL
		const response = await this.graphqlClient.query<{
			triples: GraphQLTriple[];
		}>(QUERIES.FIND_TRIPLE, { subjectId, predicateId, objectId });

		if (!response.triples || response.triples.length === 0) {
			return null;
		}

		const triple = this.mapTriple(response.triples[0]);

		// Cache result (also cache by ID)
		this.cacheService.set(
			cacheKey,
			triple,
			this.plugin.settings.cache.atomTTL
		);
		this.cacheService.set(
			`triple:${triple.id}`,
			triple,
			this.plugin.settings.cache.atomTTL
		);

		return triple;
	}

	// ============================================================================
	// VAULT QUERIES
	// ============================================================================

	/**
	 * Get vault state by ID
	 */
	async getVaultState(vaultId: string): Promise<VaultData | null> {
		const cacheKey = `vault:${vaultId}`;

		// Check cache
		const cached = this.cacheService.get<VaultData>(cacheKey);
		if (cached) {
			return cached;
		}

		// Query GraphQL
		const response = await this.graphqlClient.query<{
			vaults: GraphQLVault[];
		}>(QUERIES.GET_VAULT, { vaultId });

		if (!response.vaults || response.vaults.length === 0) {
			return null;
		}

		const vault = this.mapVault(response.vaults[0]);

		// Cache result (shorter TTL for vault state)
		this.cacheService.set(
			cacheKey,
			vault,
			this.plugin.settings.cache.vaultTTL
		);

		return vault;
	}

	// ============================================================================
	// POSITION QUERIES
	// ============================================================================

	/**
	 * Get user's positions
	 */
	async getUserPositions(address: Address): Promise<PositionData[]> {
		const normalizedAddress = address.toLowerCase();
		const cacheKey = `positions:${normalizedAddress}`;

		// Check cache
		const cached = this.cacheService.get<PositionData[]>(cacheKey);
		if (cached) {
			return cached;
		}

		// Query GraphQL
		const response = await this.graphqlClient.query<{
			positions: GraphQLPosition[];
		}>(QUERIES.GET_USER_POSITIONS, { address: normalizedAddress });

		const positions = response.positions.map((p) => this.mapPosition(p));

		// Cache results (shorter TTL for positions)
		this.cacheService.set(
			cacheKey,
			positions,
			this.plugin.settings.cache.vaultTTL
		);

		return positions;
	}

	// ============================================================================
	// CONSENSUS CALCULATION
	// ============================================================================

	/**
	 * Calculate consensus between for/against vaults
	 */
	async calculateConsensus(
		forVaultId: string,
		againstVaultId: string
	): Promise<ConsensusData> {
		// Fetch both vaults
		const [forVault, againstVault] = await Promise.all([
			this.getVaultState(forVaultId),
			this.getVaultState(againstVaultId),
		]);

		if (!forVault || !againstVault) {
			throw new Error('One or both vaults not found');
		}

		const forAssets = forVault.totalAssets;
		const againstAssets = againstVault.totalAssets;
		const totalAssets = forAssets + againstAssets;

		// Calculate consensus ratio (0-1)
		const consensusRatio =
			totalAssets > BigInt(0)
				? Number(forAssets) / Number(totalAssets)
				: 0.5; // Default to neutral if no assets

		return {
			forVaultId,
			againstVaultId,
			forShares: forVault.totalShares,
			againstShares: againstVault.totalShares,
			forAssets,
			againstAssets,
			consensusRatio,
		};
	}

	// ============================================================================
	// MAPPERS (GraphQL snake_case → TypeScript camelCase)
	// ============================================================================

	private mapAtom(atom: GraphQLAtom): AtomData {
		return {
			id: atom.term_id,
			vaultId: atom.vault_id,
			label: atom.label,
			emoji: atom.emoji,
			type: (atom.atom_type as AtomType) || AtomType.THING,
			image: atom.image,
			creatorId: atom.creator_id,
			blockTimestamp: parseInt(atom.block_timestamp),
		};
	}

	private mapTriple(triple: GraphQLTriple): TripleData {
		return {
			id: triple.id,
			vaultId: triple.vault_id,
			subjectId: triple.subject_id,
			predicateId: triple.predicate_id,
			objectId: triple.object_id,
			subjectLabel: triple.subject?.label || 'Unknown',
			predicateLabel: triple.predicate?.label || 'Unknown',
			objectLabel: triple.object?.label || 'Unknown',
			creatorId: triple.creator_id,
			blockTimestamp: parseInt(triple.block_timestamp),
			counterVaultId: triple.counter_vault_id,
		};
	}

	private mapVault(vault: GraphQLVault): VaultData {
		const totalShares = BigInt(vault.total_shares);
		const currentSharePrice = BigInt(vault.current_share_price);

		// Calculate total assets: shares * price / 1e18
		const totalAssets = (totalShares * currentSharePrice) / BigInt(1e18);

		return {
			id: vault.id,
			atomId: vault.atom_id,
			tripleId: vault.triple_id,
			totalShares,
			currentSharePrice,
			totalAssets,
			positionCount: vault.position_count,
		};
	}

	private mapPosition(position: GraphQLPosition): PositionData {
		const shares = BigInt(position.shares);

		// Calculate position value if vault data available
		let value = BigInt(0);
		if (position.vault) {
			const sharePrice = BigInt(position.vault.current_share_price);
			value = (shares * sharePrice) / BigInt(1e18);
		}

		return {
			id: position.id,
			vaultId: position.vault_id,
			accountId: position.account_id as Address,
			shares,
			value,
		};
	}

	// ============================================================================
	// CACHE MANAGEMENT
	// ============================================================================

	/**
	 * Invalidate cache for specific atom
	 */
	invalidateAtom(termId: string): void {
		this.cacheService.invalidate(`atom:${termId}`);
	}

	/**
	 * Invalidate cache for specific triple
	 */
	invalidateTriple(tripleId: string): void {
		this.cacheService.invalidate(`triple:${tripleId}`);
	}

	/**
	 * Invalidate all search caches
	 */
	invalidateSearchCache(): void {
		this.cacheService.invalidatePattern('search:');
	}

	/**
	 * Clear all caches
	 */
	clearCache(): void {
		this.cacheService.clear();
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { size: number; keys: string[] } {
		return this.cacheService.getStats();
	}
}
