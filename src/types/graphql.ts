/**
 * GraphQL-specific types for API responses and error handling
 */

/**
 * Standard GraphQL response wrapper
 */
export interface GraphQLResponse<T> {
	data: T | null;
	errors?: GraphQLError[];
}

/**
 * GraphQL error structure
 */
export interface GraphQLError {
	message: string;
	locations?: Array<{ line: number; column: number }>;
	path?: Array<string | number>;
	extensions?: Record<string, unknown>;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
	items: T[];
	totalCount: number;
	hasMore: boolean;
}

/**
 * Raw GraphQL atom response (snake_case from API)
 */
export interface GraphQLAtom {
	term_id: string;
	label: string;
	emoji: string | null;
	type: string;
	image: string | null;
	creator_id: string;
	created_at: string; // ISO 8601 timestamp
}

/**
 * Raw GraphQL triple response (snake_case from API)
 */
export interface GraphQLTriple {
	id: string;
	vault_id: string;
	subject_id: string;
	predicate_id: string;
	object_id: string;
	creator_id: string;
	block_timestamp: string;
	counter_vault_id: string | null;
	subject?: GraphQLAtom;
	predicate?: GraphQLAtom;
	object?: GraphQLAtom;
}

/**
 * Raw GraphQL vault response (snake_case from API)
 */
export interface GraphQLVault {
	id: string;
	atom_id: string | null;
	triple_id: string | null;
	total_shares: string; // BigInt as string
	current_share_price: string; // BigInt as string
	position_count: number;
}

/**
 * Raw GraphQL position response (snake_case from API)
 */
export interface GraphQLPosition {
	id: string;
	vault_id: string;
	account_id: string;
	shares: string; // BigInt as string
	vault?: GraphQLVault;
}

/**
 * Raw GraphQL semantic search result (snake_case from API)
 * Returned by search_term() function with enhanced fields
 */
export interface GraphQLSemanticSearchResult {
	atom: GraphQLAtom & {
		cached_image?: {
			url: string;
			safe: boolean;
		};
		value?: {
			json_object: {
				description?: string;
			};
		};
	};
}
