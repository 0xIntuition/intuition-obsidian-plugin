/**
 * Unit tests for Obsidian Fetch Adapter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createObsidianFetch } from './obsidian-fetch';
import type IntuitionPlugin from '../main';
import type { RequestUrlResponse } from 'obsidian';

describe('createObsidianFetch', () => {
	let mockPlugin: IntuitionPlugin;
	let mockRequestUrl: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockRequestUrl = vi.fn();
		mockPlugin = {
			app: {
				vault: {
					adapter: {
						requestUrl: mockRequestUrl,
					},
				},
			},
		} as unknown as IntuitionPlugin;
	});

	describe('Request Parsing', () => {
		it('should parse URL string and RequestInit', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: { 'content-type': 'application/json' },
				text: '{"result": "ok"}',
				json: { result: 'ok' },
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			await fetch('https://api.example.com/test', {
				method: 'POST',
				headers: { Authorization: 'Bearer token' },
				body: JSON.stringify({ test: true }),
			});

			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: 'https://api.example.com/test',
				method: 'POST',
				headers: { Authorization: 'Bearer token' },
				body: '{"test":true}',
			});
		});

		it('should parse URL object', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			await fetch(new URL('https://api.example.com/test'));

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://api.example.com/test',
					method: 'GET',
				})
			);
		});

		it('should parse Request object', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const request = new Request('https://api.example.com/test', {
				method: 'POST',
				headers: { 'X-Custom': 'value' },
				body: 'test body',
			});

			await fetch(request);

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://api.example.com/test',
					method: 'POST',
					headers: expect.objectContaining({
						'X-Custom': 'value',
					}),
				})
			);
		});

		it('should default to GET method', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			await fetch('https://api.example.com/test');

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'GET',
				})
			);
		});

		it('should throw TypeError on invalid URL', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			await expect(fetch('not-a-valid-url')).rejects.toThrow(TypeError);
			await expect(fetch('not-a-valid-url')).rejects.toThrow(
				/Invalid URL/
			);
		});
	});

	describe('Header Mapping', () => {
		it('should map Headers object to plain object', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const headers = new Headers();
			headers.set('Content-Type', 'application/json');
			headers.set('Authorization', 'Bearer token');

			await fetch('https://api.example.com/test', {
				method: 'POST',
				headers,
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer token',
					},
				})
			);
		});

		it('should map array of tuples to plain object', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			await fetch('https://api.example.com/test', {
				headers: [
					['Content-Type', 'application/json'],
					['X-Custom', 'value'],
				],
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: {
						'Content-Type': 'application/json',
						'X-Custom': 'value',
					},
				})
			);
		});

		it('should handle plain object headers', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			await fetch('https://api.example.com/test', {
				headers: { 'Content-Type': 'text/plain' },
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { 'Content-Type': 'text/plain' },
				})
			);
		});
	});

	describe('Body Conversion', () => {
		it('should handle string body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			await fetch('https://api.example.com/test', {
				method: 'POST',
				body: 'test data',
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({ body: 'test data' })
			);
		});

		it('should handle ArrayBuffer body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const buffer = new ArrayBuffer(8);
			await fetch('https://api.example.com/test', {
				method: 'POST',
				body: buffer,
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({ body: buffer })
			);
		});

		it('should handle Uint8Array body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const uint8 = new Uint8Array([1, 2, 3, 4]);
			await fetch('https://api.example.com/test', {
				method: 'POST',
				body: uint8,
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.any(ArrayBuffer),
				})
			);
		});

		it('should handle Blob body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const blob = new Blob(['test data'], { type: 'text/plain' });
			await fetch('https://api.example.com/test', {
				method: 'POST',
				body: blob,
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.any(ArrayBuffer),
				})
			);
		});

		it('should handle URLSearchParams body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const params = new URLSearchParams();
			params.append('key1', 'value1');
			params.append('key2', 'value2');

			await fetch('https://api.example.com/test', {
				method: 'POST',
				body: params,
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: 'key1=value1&key2=value2',
				})
			);
		});

		it('should handle ReadableStream body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			// Create a simple ReadableStream
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(new Uint8Array([1, 2, 3]));
					controller.enqueue(new Uint8Array([4, 5, 6]));
					controller.close();
				},
			});

			await fetch('https://api.example.com/test', {
				method: 'POST',
				body: stream as unknown as BodyInit,
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.any(ArrayBuffer),
				})
			);

			// Verify the buffered content
			const call = mockRequestUrl.mock.calls[0][0];
			const bodyBuffer = call.body as ArrayBuffer;
			const bodyArray = new Uint8Array(bodyBuffer);
			expect(bodyArray).toEqual(
				new Uint8Array([1, 2, 3, 4, 5, 6])
			);
		});

		it('should throw on FormData body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const formData = new FormData();
			formData.append('key', 'value');

			await expect(
				fetch('https://api.example.com/test', {
					method: 'POST',
					body: formData,
				})
			).rejects.toThrow('FormData is not supported');
		});

		it('should handle empty/undefined body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			await fetch('https://api.example.com/test', {
				method: 'GET',
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: undefined,
				})
			);
		});
	});

	describe('Response Mapping', () => {
		it('should return Response with correct properties', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: { 'content-type': 'application/json' },
				text: '{"data": "test"}',
				json: { data: 'test' },
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');

			expect(response.status).toBe(200);
			expect(response.statusText).toBe('OK');
			expect(response.ok).toBe(true);
			expect(response.headers.get('content-type')).toBe(
				'application/json'
			);
			expect(response.type).toBe('basic');
			expect(response.redirected).toBe(false);
			expect(response.body).toBe(null);
		});

		it('should handle success status codes', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			for (const status of [200, 201, 202, 204]) {
				mockRequestUrl.mockResolvedValue({
					status,
					headers: {},
					text: '',
					json: null,
					arrayBuffer: new ArrayBuffer(0),
				} as RequestUrlResponse);

				const response = await fetch('https://api.example.com/test');
				expect(response.status).toBe(status);
				expect(response.ok).toBe(true);
			}
		});

		it('should handle error status codes correctly', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const errorStatuses = [
				{ status: 400, text: 'Bad Request' },
				{ status: 401, text: 'Unauthorized' },
				{ status: 403, text: 'Forbidden' },
				{ status: 404, text: 'Not Found' },
				{ status: 429, text: 'Too Many Requests' },
				{ status: 500, text: 'Internal Server Error' },
				{ status: 502, text: 'Bad Gateway' },
				{ status: 503, text: 'Service Unavailable' },
			];

			for (const { status, text } of errorStatuses) {
				mockRequestUrl.mockResolvedValue({
					status,
					headers: {},
					text: '',
					json: null,
					arrayBuffer: new ArrayBuffer(0),
				} as RequestUrlResponse);

				const response = await fetch('https://api.example.com/test');
				expect(response.status).toBe(status);
				expect(response.statusText).toBe(text);
				expect(response.ok).toBe(false);
			}
		});

		it('should read JSON body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const testData = { message: 'Hello', count: 42 };
			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: JSON.stringify(testData),
				json: testData,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			const json = await response.json();

			expect(json).toEqual(testData);
		});

		it('should read text body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: 'Plain text response',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			const text = await response.text();

			expect(text).toBe('Plain text response');
		});

		it('should read arrayBuffer body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const buffer = new ArrayBuffer(8);
			const view = new Uint8Array(buffer);
			view.set([1, 2, 3, 4, 5, 6, 7, 8]);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: buffer,
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			const result = await response.arrayBuffer();

			expect(result).toBe(buffer);
			expect(new Uint8Array(result)).toEqual(view);
		});

		it('should read blob body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const buffer = new ArrayBuffer(4);
			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: buffer,
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			const blob = await response.blob();

			expect(blob).toBeInstanceOf(Blob);
			expect(blob.size).toBe(4);
		});

		it('should read bytes body', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const buffer = new ArrayBuffer(8);
			const view = new Uint8Array(buffer);
			view.set([1, 2, 3, 4, 5, 6, 7, 8]);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: buffer,
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			const bytes = await response.bytes();

			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(bytes).toEqual(view);
		});

		it('should throw on formData()', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: '',
				json: null,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');

			await expect(response.formData()).rejects.toThrow(
				'FormData parsing not supported'
			);
		});

		it('should throw when body is consumed twice', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: 'test',
				json: { test: true },
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			await response.json();

			await expect(response.json()).rejects.toThrow(
				'Response body already consumed'
			);
			await expect(response.text()).rejects.toThrow(
				'Response body already consumed'
			);
			await expect(response.arrayBuffer()).rejects.toThrow(
				'Response body already consumed'
			);
			await expect(response.blob()).rejects.toThrow(
				'Response body already consumed'
			);
		});
	});

	describe('Response Cloning', () => {
		it('should clone response before consumption', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const testData = { value: 'test' };
			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: { 'content-type': 'application/json' },
				text: JSON.stringify(testData),
				json: testData,
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			const clone = response.clone();

			expect(clone.status).toBe(response.status);
			expect(clone.statusText).toBe(response.statusText);
			expect(clone.ok).toBe(response.ok);

			// Both should be readable
			const json1 = await response.json();
			const json2 = await clone.json();

			expect(json1).toEqual(testData);
			expect(json2).toEqual(testData);
		});

		it('should throw when cloning consumed response', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				text: 'test',
				json: { test: true },
				arrayBuffer: new ArrayBuffer(0),
			} as RequestUrlResponse);

			const response = await fetch('https://api.example.com/test');
			await response.json();

			expect(() => response.clone()).toThrow(
				'Response body already consumed'
			);
		});
	});

	describe('Error Handling', () => {
		it('should throw TypeError on network errors', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockRejectedValue(
				new Error('Network connection failed')
			);

			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(TypeError);
			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(/Network request failed/);
		});

		it('should throw TypeError on timeout errors', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockRejectedValue(new Error('ETIMEDOUT'));

			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(TypeError);
			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(/Network request failed/);
		});

		it('should throw TypeError on connection refused', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockRejectedValue(new Error('ECONNREFUSED'));

			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(TypeError);
			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(/Network request failed/);
		});

		it('should throw TypeError on DNS errors', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockRejectedValue(new Error('ENOTFOUND'));

			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(TypeError);
			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(/Network request failed/);
		});

		it('should throw TypeError on unknown errors', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			mockRequestUrl.mockRejectedValue(new Error('Unknown error'));

			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(TypeError);
			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(/Request failed/);
		});

		it('should preserve TypeError if already TypeError', async () => {
			const fetch = createObsidianFetch(mockPlugin);

			const customError = new TypeError('Custom error');
			mockRequestUrl.mockRejectedValue(customError);

			await expect(
				fetch('https://api.example.com/test')
			).rejects.toThrow(customError);
		});
	});
});
