import type { GraphQLAtom, GraphQLTriple, GraphQLVault, GraphQLPosition, GraphQLResponse, GraphQLError } from '../../src/types/graphql';
import type { AtomData, TripleData } from '../../src/types/intuition';

// Mock GraphQL Atoms
export const MOCK_GRAPHQL_ATOM_PERSON: GraphQLAtom = {
	term_id: '1',
	label: 'Alice',
	emoji: '👤',
	type: 'Person',
	image: null,
	creator_id: '0x1234567890123456789012345678901234567890',
	created_at: '2021-12-20T13:06:40Z',
};

export const MOCK_GRAPHQL_ATOM_THING: GraphQLAtom = {
	term_id: '2',
	label: 'Blockchain',
	emoji: '⛓️',
	type: 'Thing',
	image: null,
	creator_id: '0x1234567890123456789012345678901234567890',
	created_at: '2021-12-20T13:08:20Z',
};

export const MOCK_GRAPHQL_ATOM_BOOK: GraphQLAtom = {
	term_id: '3',
	label: 'The Great Gatsby',
	emoji: '📚',
	type: 'Book',
	image: 'https://example.com/gatsby.jpg',
	creator_id: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
	created_at: '2021-12-20T13:10:00Z',
};

export const MOCK_GRAPHQL_ATOM_PREDICATE: GraphQLAtom = {
	term_id: '4',
	label: 'likes',
	emoji: '❤️',
	type: 'Thing',
	image: null,
	creator_id: '0x1234567890123456789012345678901234567890',
	created_at: '2021-12-20T13:11:40Z',
};

// Mock GraphQL Triples
export const MOCK_GRAPHQL_TRIPLE: GraphQLTriple = {
	id: '1000',
	vault_id: '200',
	subject_id: '1',
	predicate_id: '4',
	object_id: '2',
	creator_id: '0x1234567890123456789012345678901234567890',
	block_timestamp: '1640000400',
	counter_vault_id: null,
	subject: MOCK_GRAPHQL_ATOM_PERSON,
	predicate: MOCK_GRAPHQL_ATOM_PREDICATE,
	object: MOCK_GRAPHQL_ATOM_THING,
};

export const MOCK_GRAPHQL_TRIPLE_WITH_COUNTER: GraphQLTriple = {
	id: '1001',
	vault_id: '201',
	subject_id: '1',
	predicate_id: '4',
	object_id: '3',
	creator_id: '0x1234567890123456789012345678901234567890',
	block_timestamp: '1640000500',
	counter_vault_id: '202',
	subject: MOCK_GRAPHQL_ATOM_PERSON,
	predicate: MOCK_GRAPHQL_ATOM_PREDICATE,
	object: MOCK_GRAPHQL_ATOM_BOOK,
};

// Mock GraphQL Vaults
export const MOCK_GRAPHQL_VAULT_ATOM: GraphQLVault = {
	id: '100',
	atom_id: '1',
	triple_id: null,
	total_shares: '1000000000000000000', // 1 share
	current_share_price: '100000000000000', // 0.0001 ETH
	position_count: 5,
};

export const MOCK_GRAPHQL_VAULT_TRIPLE: GraphQLVault = {
	id: '200',
	atom_id: null,
	triple_id: '1000',
	total_shares: '5000000000000000000', // 5 shares
	current_share_price: '200000000000000', // 0.0002 ETH
	position_count: 10,
};

// Mock GraphQL Positions
export const MOCK_GRAPHQL_POSITION: GraphQLPosition = {
	id: 'pos-1',
	vault_id: '100',
	account_id: '0x1234567890123456789012345678901234567890',
	shares: '100000000000000000', // 0.1 share
	vault: MOCK_GRAPHQL_VAULT_ATOM,
};

// Mock successful GraphQL responses
export const MOCK_ATOM_RESPONSE: GraphQLResponse<{ atom: GraphQLAtom }> = {
	data: {
		atom: MOCK_GRAPHQL_ATOM_PERSON,
	},
};

export const MOCK_ATOMS_RESPONSE: GraphQLResponse<{ atoms: GraphQLAtom[] }> = {
	data: {
		atoms: [
			MOCK_GRAPHQL_ATOM_PERSON,
			MOCK_GRAPHQL_ATOM_THING,
			MOCK_GRAPHQL_ATOM_BOOK,
		],
	},
};

export const MOCK_TRIPLE_RESPONSE: GraphQLResponse<{ triple: GraphQLTriple }> = {
	data: {
		triple: MOCK_GRAPHQL_TRIPLE,
	},
};

export const MOCK_TRIPLES_RESPONSE: GraphQLResponse<{ triples: GraphQLTriple[] }> = {
	data: {
		triples: [
			MOCK_GRAPHQL_TRIPLE,
			MOCK_GRAPHQL_TRIPLE_WITH_COUNTER,
		],
	},
};

// Mock error responses
export const MOCK_GRAPHQL_ERROR: GraphQLError = {
	message: 'Failed to fetch data',
	locations: [{ line: 1, column: 1 }],
	path: ['atom'],
	extensions: {
		code: 'INTERNAL_SERVER_ERROR',
	},
};

export const MOCK_ERROR_RESPONSE: GraphQLResponse<null> = {
	data: null,
	errors: [MOCK_GRAPHQL_ERROR],
};

export const MOCK_NOT_FOUND_RESPONSE: GraphQLResponse<{ atom: null }> = {
	data: {
		atom: null,
	},
};

// Mock search response with pagination
export const MOCK_SEARCH_RESPONSE: GraphQLResponse<{
	atoms: GraphQLAtom[];
	totalCount: number;
}> = {
	data: {
		atoms: [
			MOCK_GRAPHQL_ATOM_PERSON,
			MOCK_GRAPHQL_ATOM_THING,
		],
		totalCount: 2,
	},
};

export const MOCK_EMPTY_SEARCH_RESPONSE: GraphQLResponse<{
	atoms: GraphQLAtom[];
	totalCount: number;
}> = {
	data: {
		atoms: [],
		totalCount: 0,
	},
};

// Transformed mock data (camelCase, for use with services)
export const MOCK_ATOM_DATA: AtomData = {
	id: '1',
	label: 'Alice',
	emoji: '👤',
	type: 'Person' as any,
	image: null,
	creatorId: '0x1234567890123456789012345678901234567890',
	createdAt: new Date('2021-12-20T13:06:40Z').getTime(),
};

export const MOCK_TRIPLE_DATA: TripleData = {
	id: '1000',
	vaultId: '200',
	subjectId: '1',
	predicateId: '4',
	objectId: '2',
	subjectLabel: 'Alice',
	predicateLabel: 'likes',
	objectLabel: 'Blockchain',
	creatorId: '0x1234567890123456789012345678901234567890',
	blockTimestamp: 1640000400,
	counterVaultId: null,
};

// Helper functions to create mock data
export function createMockAtom(overrides: Partial<GraphQLAtom> = {}): GraphQLAtom {
	return {
		...MOCK_GRAPHQL_ATOM_PERSON,
		...overrides,
	};
}

export function createMockTriple(overrides: Partial<GraphQLTriple> = {}): GraphQLTriple {
	return {
		...MOCK_GRAPHQL_TRIPLE,
		...overrides,
	};
}

export function createMockVault(overrides: Partial<GraphQLVault> = {}): GraphQLVault {
	return {
		...MOCK_GRAPHQL_VAULT_ATOM,
		...overrides,
	};
}

export function createMockPosition(overrides: Partial<GraphQLPosition> = {}): GraphQLPosition {
	return {
		...MOCK_GRAPHQL_POSITION,
		...overrides,
	};
}

// Helper to create error response
export function createErrorResponse(message: string, code = 'INTERNAL_SERVER_ERROR'): GraphQLResponse<null> {
	return {
		data: null,
		errors: [
			{
				message,
				extensions: { code },
			},
		],
	};
}

// Helper to create successful response
export function createSuccessResponse<T>(data: T): GraphQLResponse<T> {
	return {
		data,
	};
}
