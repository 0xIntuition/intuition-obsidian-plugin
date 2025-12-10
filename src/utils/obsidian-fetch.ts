/**
 * Obsidian Fetch Adapter - Bridges Obsidian's requestUrl API with standard Fetch API
 *
 * Purpose: Fix CORS issues when making LLM API calls from Obsidian plugins
 * by using Obsidian's CORS-free requestUrl() instead of standard fetch().
 *
 * Limitations:
 * - No streaming support (Obsidian buffers entire response)
 * - No FormData support
 * - ReadableStream bodies are buffered before sending
 *
 * @module obsidian-fetch
 */

import type IntuitionPlugin from '../main';
import type { RequestUrlParam, RequestUrlResponse } from 'obsidian';

/**
 * Create a fetch-compatible function that uses Obsidian's requestUrl
 *
 * @param plugin - The Intuition plugin instance
 * @returns A fetch-compatible function
 *
 * @example
 * ```typescript
 * const customFetch = createObsidianFetch(plugin);
 * const client = createAnthropic({ apiKey, fetch: customFetch });
 * ```
 */
export function createObsidianFetch(plugin: IntuitionPlugin): typeof fetch {
	return async (
		input: RequestInfo | URL,
		init?: RequestInit
	): Promise<Response> => {
		try {
			const { url, params } = await parseRequest(input, init);

			// Call Obsidian's requestUrl
			// requestUrl exists on Obsidian's DataAdapter but not in base types
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const obsidianResponse = await (
				plugin.app.vault.adapter as any
			).requestUrl(params);

			// Wrap in fetch-compatible Response
			return new ObsidianResponse(url, obsidianResponse);
		} catch (error) {
			// Map Obsidian errors to fetch errors
			if (error instanceof TypeError) {
				throw error; // Already a TypeError
			}

			// Network/connection errors
			if (error && typeof error === 'object' && 'message' in error) {
				const message = (error as Error).message;

				// Common network error patterns
				if (
					message.includes('network') ||
					message.includes('connection') ||
					message.includes('timeout') ||
					message.includes('ECONNREFUSED') ||
					message.includes('ETIMEDOUT') ||
					message.includes('ENOTFOUND')
				) {
					throw new TypeError(`Network request failed: ${message}`);
				}
			}

			// Unknown errors
			throw new TypeError(
				`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	};
}

/**
 * Fetch-compatible Response implementation wrapping Obsidian's response
 */
class ObsidianResponse implements Response {
	readonly type: ResponseType = 'basic';
	readonly redirected = false;
	readonly url: string;
	readonly status: number;
	readonly statusText: string;
	readonly ok: boolean;
	readonly headers: Headers;
	readonly body: null = null; // No streaming support
	readonly bodyUsed = false;

	private _arrayBuffer: ArrayBuffer;
	private _text: string;
	private _json: unknown;
	private _consumed = false;

	constructor(url: string, response: RequestUrlResponse) {
		this.url = url;
		this.status = response.status;
		this.statusText = this.getStatusText(response.status);
		this.ok = response.status >= 200 && response.status < 300;
		this.headers = new Headers(response.headers);
		this._arrayBuffer = response.arrayBuffer;
		this._text = response.text;
		this._json = response.json;
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		this.checkConsumed();
		this._consumed = true;
		return this._arrayBuffer;
	}

	async text(): Promise<string> {
		this.checkConsumed();
		this._consumed = true;
		return this._text;
	}

	async json(): Promise<unknown> {
		this.checkConsumed();
		this._consumed = true;
		return this._json;
	}

	async blob(): Promise<Blob> {
		this.checkConsumed();
		this._consumed = true;
		return new Blob([this._arrayBuffer]);
	}

	async formData(): Promise<FormData> {
		throw new Error('FormData parsing not supported');
	}

	async bytes(): Promise<Uint8Array<ArrayBuffer>> {
		this.checkConsumed();
		this._consumed = true;
		return new Uint8Array(this._arrayBuffer) as Uint8Array<ArrayBuffer>;
	}

	clone(): Response {
		if (this._consumed) {
			throw new TypeError('Response body already consumed');
		}
		// Create a new ObsidianResponse with the same data
		const headersObj: Record<string, string> = {};
		this.headers.forEach((value, key) => {
			headersObj[key] = value;
		});
		const clonedResponse = {
			status: this.status,
			headers: headersObj,
			arrayBuffer: this._arrayBuffer,
			text: this._text,
			json: this._json,
		} as RequestUrlResponse;
		return new ObsidianResponse(this.url, clonedResponse);
	}

	private checkConsumed() {
		if (this._consumed) {
			throw new TypeError('Response body already consumed');
		}
	}

	private getStatusText(status: number): string {
		const statusTexts: Record<number, string> = {
			200: 'OK',
			201: 'Created',
			202: 'Accepted',
			204: 'No Content',
			400: 'Bad Request',
			401: 'Unauthorized',
			403: 'Forbidden',
			404: 'Not Found',
			429: 'Too Many Requests',
			500: 'Internal Server Error',
			502: 'Bad Gateway',
			503: 'Service Unavailable',
		};
		return statusTexts[status] || 'Unknown';
	}
}

/**
 * Parse fetch-style input into URL and Obsidian RequestUrlParam
 */
async function parseRequest(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<{ url: string; params: RequestUrlParam }> {
	// Handle Request object
	if (input instanceof Request) {
		const url = input.url;
		const method = input.method;
		const headers = mapHeadersToObsidian(input.headers);

		// Get body from Request
		let body: string | ArrayBuffer | undefined;
		if (input.body) {
			// Read the body from the ReadableStream
			const bodyBuffer = await input.arrayBuffer();
			body = bodyBuffer.byteLength > 0 ? bodyBuffer : undefined;
		}

		return {
			url,
			params: {
				url,
				method,
				headers,
				body,
			},
		};
	}

	// Handle URL or string
	const url = input instanceof URL ? input.href : input.toString();

	// Validate URL format
	try {
		new URL(url);
	} catch {
		throw new TypeError(`Invalid URL: ${url}`);
	}

	return {
		url,
		params: {
			url,
			method: init?.method || 'GET',
			headers: mapHeadersToObsidian(init?.headers),
			body: await convertBodyToObsidianFormat(init?.body),
		},
	};
}

/**
 * Convert various body types to Obsidian format (string or ArrayBuffer)
 */
async function convertBodyToObsidianFormat(
	body: BodyInit | null | undefined
): Promise<string | ArrayBuffer | undefined> {
	if (!body) return undefined;

	// String body (JSON, text)
	if (typeof body === 'string') {
		return body;
	}

	// ArrayBuffer or ArrayBufferView
	if (body instanceof ArrayBuffer) {
		return body;
	}

	if (ArrayBuffer.isView(body)) {
		return body.buffer.slice(
			body.byteOffset,
			body.byteOffset + body.byteLength
		);
	}

	// Blob
	if (body instanceof Blob) {
		return await body.arrayBuffer();
	}

	// ReadableStream - buffer it
	if (isReadableStream(body)) {
		return await bufferStream(body);
	}

	// FormData - not supported by Obsidian
	if (body instanceof FormData) {
		throw new TypeError(
			'FormData is not supported by Obsidian requestUrl'
		);
	}

	// URLSearchParams - convert to string
	if (body instanceof URLSearchParams) {
		return body.toString();
	}

	throw new TypeError(`Unsupported body type: ${typeof body}`);
}

/**
 * Map fetch headers to Obsidian's header format (Record<string, string>)
 */
function mapHeadersToObsidian(
	headers: HeadersInit | undefined
): Record<string, string> {
	if (!headers) return {};

	// Headers object
	if (headers instanceof Headers) {
		const result: Record<string, string> = {};
		headers.forEach((value, key) => {
			result[key] = value;
		});
		return result;
	}

	// Array of [key, value] tuples
	if (Array.isArray(headers)) {
		const result: Record<string, string> = {};
		for (const [key, value] of headers) {
			result[key] = value;
		}
		return result;
	}

	// Plain object
	return headers as Record<string, string>;
}

/**
 * Check if value is a ReadableStream
 */
function isReadableStream(value: unknown): value is ReadableStream {
	return (
		value !== null &&
		typeof value === 'object' &&
		'getReader' in value &&
		typeof (value as ReadableStream).getReader === 'function'
	);
}

/**
 * Buffer a ReadableStream into an ArrayBuffer
 */
async function bufferStream(
	stream: ReadableStream<Uint8Array>
): Promise<ArrayBuffer> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let totalLength = 0;

	try {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			totalLength += value.length;
		}
	} finally {
		reader.releaseLock();
	}

	// Combine chunks into single ArrayBuffer
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}
