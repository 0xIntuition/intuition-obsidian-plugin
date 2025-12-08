/**
 * GraphQLClient - Handles GraphQL queries to Intuition API
 *
 * Features:
 * - Network-aware endpoint configuration
 * - Error handling with GraphQLQueryError
 * - Network switching support
 * - Type-safe query execution
 */

import { GraphQLResponse, GraphQLError } from '../types/graphql';
import { GraphQLQueryError } from '../types/errors';
import { NetworkType, NETWORKS } from '../types/networks';

export class GraphQLClient {
	private url: string;
	private network: NetworkType;

	constructor(network: NetworkType, customUrl?: string) {
		this.network = network;
		this.url = customUrl || NETWORKS[network].graphqlUrl;
	}

	/**
	 * Execute a GraphQL query
	 */
	async query<T>(
		query: string,
		variables?: Record<string, unknown>
	): Promise<T> {
		try {
			const response = await fetch(this.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					query,
					variables,
				}),
			});

			if (!response.ok) {
				throw new GraphQLQueryError(
					`GraphQL HTTP error: ${response.status} ${response.statusText}`,
					{ status: response.status, statusText: response.statusText }
				);
			}

			const result: GraphQLResponse<T> = await response.json();

			// Check for GraphQL errors
			if (result.errors && result.errors.length > 0) {
				throw new GraphQLQueryError(
					this.formatGraphQLErrors(result.errors),
					result.errors
				);
			}

			if (!result.data) {
				throw new GraphQLQueryError(
					'GraphQL query returned no data',
					result
				);
			}

			return result.data;
		} catch (error) {
			// Re-throw GraphQL errors as-is
			if (error instanceof GraphQLQueryError) {
				throw error;
			}

			// Network errors
			if (error instanceof TypeError && error.message.includes('fetch')) {
				throw new GraphQLQueryError(
					'Network error: Unable to reach GraphQL endpoint. Check your connection.',
					{ originalError: error }
				);
			}

			// Unknown errors
			throw new GraphQLQueryError(
				`GraphQL query failed: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				{ originalError: error }
			);
		}
	}

	/**
	 * Update network configuration
	 * @param network - New network type
	 * @param customUrl - Optional custom GraphQL URL
	 */
	updateNetwork(network: NetworkType, customUrl?: string): void {
		this.network = network;
		this.url = customUrl || NETWORKS[network].graphqlUrl;
	}

	/**
	 * Get current network
	 */
	getNetwork(): NetworkType {
		return this.network;
	}

	/**
	 * Get current GraphQL URL
	 */
	getUrl(): string {
		return this.url;
	}

	/**
	 * Format GraphQL errors into readable message
	 */
	private formatGraphQLErrors(errors: GraphQLError[]): string {
		const messages = errors.map((err) => err.message);
		return `GraphQL errors:\n${messages.join('\n')}`;
	}
}
