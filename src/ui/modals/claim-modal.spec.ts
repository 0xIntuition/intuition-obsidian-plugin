import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaimModal } from './claim-modal';
import { createTestPlugin } from '../../../tests/fixtures/plugin';
import { createTimeController } from '../../../tests/helpers/test-plugin';
import { flushPromises } from '../../../tests/helpers/async-utils';
import type IntuitionPlugin from '../../main';

describe('ClaimModal - Loading States', () => {
	let modal: ClaimModal;
	let plugin: IntuitionPlugin;
	let timeController: ReturnType<typeof createTimeController>;

	beforeEach(() => {
		const { plugin: testPlugin, app } = createTestPlugin({
			llm: {
				enabled: true,
				provider: 'anthropic',
				encryptedApiKey: 'test-key',
			},
		});
		plugin = testPlugin as unknown as IntuitionPlugin;

		// Initialize settings properly
		plugin.settings = {
			llm: {
				enabled: true,
				provider: 'anthropic',
				encryptedApiKey: 'test-key',
			},
		} as any;

		// Mock the LLM service
		plugin.llmService = {
			isAvailable: vi.fn(() => true),
		} as any;

		// Mock the claim parser service with slight delay to allow loading indicator to appear
		plugin.claimParserService = {
			extractTriple: vi.fn(async () => {
				// Add small delay to allow loading indicator to render
				await new Promise(resolve => setTimeout(resolve, 50));
				return {
					subject: 'Test Subject',
					predicate: 'test-predicate',
					object: 'Test Object',
					confidence: 0.85,
					pattern: 'llm',
				};
			}),
			validateClaim: vi.fn(() => ({ warnings: [] })),
		} as any;

		// Mock the notice manager
		plugin.noticeManager = {
			info: vi.fn(),
			warning: vi.fn(),
			error: vi.fn(),
		} as any;

		// Mock the intuition service
		plugin.intuitionService = {
			searchAtoms: vi.fn(async () => []),
		} as any;

		modal = new ClaimModal(
			app,
			plugin,
			'Bitcoin is a cryptocurrency',
			'/test/file.md'
		);

		timeController = createTimeController();
	});

	afterEach(() => {
		modal.close();
		timeController.useRealTimers();
	});

	describe('Loading Indicator Display', () => {
		it('should show loading indicator when LLM is enabled', async () => {
			modal.onOpen();
			await flushPromises();

			// Wait for loading indicator to appear
			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeTruthy();
					expect(loadingEl?.textContent).toContain('AI analyzing');
				},
				{ timeout: 1000 }
			);
		});

		it('should show regex loading when LLM is disabled', async () => {
			plugin.settings.llm.enabled = false;

			modal.onOpen();
			await flushPromises();

			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeTruthy();
					expect(loadingEl?.textContent).toContain('Analyzing text patterns');
				},
				{ timeout: 1000 }
			);
		});

		it('should show regex loading when LLM is locked', async () => {
			plugin.llmService.isAvailable = vi.fn(() => false);

			modal.onOpen();
			await flushPromises();

			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeTruthy();
					expect(loadingEl?.textContent).toContain('Analyzing text patterns');
				},
				{ timeout: 1000 }
			);
		});

		it('should display spinner element', async () => {
			modal.onOpen();
			await flushPromises();

			await vi.waitFor(
				() => {
					const spinner = modal.contentEl.querySelector('.loading-spinner');
					expect(spinner).toBeTruthy();
				},
				{ timeout: 1000 }
			);
		});

		it('should display loading text element', async () => {
			modal.onOpen();
			await flushPromises();

			await vi.waitFor(
				() => {
					const loadingText = modal.contentEl.querySelector('.loading-text');
					expect(loadingText).toBeTruthy();
				},
				{ timeout: 1000 }
			);
		});

		it('should insert loading indicator after original text', async () => {
			modal.onOpen();
			await flushPromises();

			// Wait for loading indicator to appear and verify position
			await vi.waitFor(
				() => {
					const originalText = modal.contentEl.querySelector(
						'.claim-original-text'
					);
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);

					expect(originalText).toBeTruthy();
					expect(loadingEl).toBeTruthy();

					// Loading should come after original text in DOM order
					expect(originalText?.nextElementSibling).toBe(loadingEl);
				},
				{ timeout: 1000 }
			);
		});
	});

	describe('Loading Indicator Removal', () => {
		it('should hide loading indicator after extraction completes', async () => {
			modal.onOpen();
			await flushPromises();

			// Wait for extraction to complete by waiting for the promise
			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeNull();
				},
				{ timeout: 2000, interval: 50 }
			);
		});

		it('should timeout and hide indicator after 10 seconds', async () => {
			// Make extraction hang indefinitely
			plugin.claimParserService.extractTriple = vi.fn(
				() => new Promise(() => {})
			);

			timeController.useFakeTimers();

			modal.onOpen();

			// Verify loading is shown
			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeTruthy();
				},
				{ timeout: 1000 }
			);

			// Advance time by 10 seconds
			timeController.advanceTime(10000);

			// Verify loading is hidden
			const loadingElAfter = modal.contentEl.querySelector(
				'.claim-extraction-loading'
			);
			expect(loadingElAfter).toBeNull();

			// Verify warning notice was shown
			expect(plugin.noticeManager.warning).toHaveBeenCalledWith(
				'Extraction is taking longer than expected'
			);

			timeController.useRealTimers();
		});

		it('should hide loading indicator on extraction error', async () => {
			// Suppress expected console.debug output
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			// Make extraction throw error
			plugin.claimParserService.extractTriple = vi.fn(async () => {
				throw new Error('Extraction failed');
			});

			modal.onOpen();
			await flushPromises();

			// Wait for error handling
			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeNull();
				},
				{ timeout: 2000, interval: 50 }
			);

			consoleDebugSpy.mockRestore();
		});

		it('should hide loading when low confidence suggestion is returned', async () => {
			// Return low confidence suggestion
			plugin.claimParserService.extractTriple = vi.fn(async () => ({
				subject: 'Test',
				predicate: 'is',
				object: 'Test',
				confidence: 0.3, // Below MIN_AUTO_SUGGESTION_CONFIDENCE (0.5)
				pattern: 'llm',
			}));

			modal.onOpen();
			await flushPromises();

			// Wait for extraction
			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeNull();
				},
				{ timeout: 2000, interval: 50 }
			);

			// Verify no notice was shown (confidence too low)
			expect(plugin.noticeManager.info).not.toHaveBeenCalled();
		});
	});

	describe('Modal Cleanup', () => {
		it('should clear loading indicator on modal close', async () => {
			modal.onOpen();

			// Close modal while extraction is in progress
			modal.close();

			// Verify loading indicator is cleaned up
			const loadingEl = modal.contentEl.querySelector(
				'.claim-extraction-loading'
			);
			expect(loadingEl).toBeNull();
		});

		it('should clear timeout on modal close', async () => {
			// Make extraction hang
			plugin.claimParserService.extractTriple = vi.fn(
				() => new Promise(() => {})
			);

			timeController.useFakeTimers();

			modal.onOpen();

			// Close modal
			modal.close();

			// Advance time past timeout
			timeController.advanceTime(11000);

			// Verify warning was NOT shown (timeout was cleared)
			expect(plugin.noticeManager.warning).not.toHaveBeenCalled();

			timeController.useRealTimers();
		});
	});

	describe('User Interaction During Loading', () => {
		it('should allow fields to remain editable during loading', async () => {
			modal.onOpen();
			await flushPromises();

			// Wait for loading indicator and verify fields
			await vi.waitFor(
				() => {
					// Check that loading indicator exists
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeTruthy();

					// Verify input fields are present and not disabled
					const inputs = modal.contentEl.querySelectorAll(
						'.intuition-atom-search-input'
					);
					expect(inputs.length).toBeGreaterThan(0);

					inputs.forEach((input) => {
						expect((input as HTMLInputElement).disabled).toBe(false);
					});
				},
				{ timeout: 1000 }
			);
		});
	});

	describe('Extraction Completion Flow', () => {
		it('should show notice after successful extraction', async () => {
			modal.onOpen();
			await flushPromises();

			// Wait for extraction to complete
			await vi.waitFor(
				() => {
					expect(plugin.noticeManager.info).toHaveBeenCalled();
				},
				{ timeout: 2000, interval: 50 }
			);

			// Verify notice was shown with correct message
			expect(plugin.noticeManager.info).toHaveBeenCalledWith(
				expect.stringContaining('AI Suggestion')
			);
			expect(plugin.noticeManager.info).toHaveBeenCalledWith(
				expect.stringContaining('85% confidence')
			);
		});

		it('should hide loading before showing notice', async () => {
			let loadingWasVisibleBeforeNotice = false;

			const originalInfo = plugin.noticeManager.info;
			plugin.noticeManager.info = vi.fn((...args) => {
				// Check if loading is still visible when notice is shown
				const loadingEl = modal.contentEl.querySelector(
					'.claim-extraction-loading'
				);
				loadingWasVisibleBeforeNotice = loadingEl !== null;
				return (originalInfo as any)(...args);
			});

			modal.onOpen();
			await flushPromises();

			await vi.waitFor(() => {
				return plugin.noticeManager.info.mock.calls.length > 0;
			});

			// Loading should be hidden before notice is shown
			expect(loadingWasVisibleBeforeNotice).toBe(false);
		});

		it('should show regex pattern notice when LLM is disabled', async () => {
			plugin.settings.llm.enabled = false;
			plugin.claimParserService.extractTriple = vi.fn(async () => ({
				subject: 'Bitcoin',
				predicate: 'is',
				object: 'cryptocurrency',
				confidence: 0.7,
				pattern: 'regex',
			}));

			modal.onOpen();
			await flushPromises();

			await vi.waitFor(
				() => {
					expect(plugin.noticeManager.info).toHaveBeenCalled();
				},
				{ timeout: 2000, interval: 50 }
			);

			expect(plugin.noticeManager.info).toHaveBeenCalledWith(
				expect.stringContaining('Pattern Suggestion')
			);
		});
	});

	describe('Edge Cases', () => {
		it('should handle null suggestion gracefully', async () => {
			plugin.claimParserService.extractTriple = vi.fn(
				async () => null
			);

			modal.onOpen();
			await flushPromises();

			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeNull();
				},
				{ timeout: 2000, interval: 50 }
			);

			// Verify no notice shown
			expect(plugin.noticeManager.info).not.toHaveBeenCalled();
		});

		it('should handle undefined suggestion gracefully', async () => {
			plugin.claimParserService.extractTriple = vi.fn(
				async () => undefined
			);

			modal.onOpen();
			await flushPromises();

			await vi.waitFor(
				() => {
					const loadingEl = modal.contentEl.querySelector(
						'.claim-extraction-loading'
					);
					expect(loadingEl).toBeNull();
				},
				{ timeout: 2000, interval: 50 }
			);
		});

		it('should not show duplicate loading indicators on re-render', async () => {
			modal.onOpen();
			await flushPromises();

			// Wait for loading indicator and verify only one exists
			await vi.waitFor(
				() => {
					const loadingEls = modal.contentEl.querySelectorAll(
						'.claim-extraction-loading'
					);
					expect(loadingEls.length).toBe(1);
				},
				{ timeout: 1000 }
			);
		});
	});
});

describe('ClaimModal - Apply Suggestion', () => {
	let modal: ClaimModal;
	let plugin: IntuitionPlugin;

	beforeEach(() => {
		const { plugin: testPlugin, app } = createTestPlugin({
			llm: {
				enabled: true,
				provider: 'anthropic',
				encryptedApiKey: 'test-key',
			},
		});
		plugin = testPlugin as unknown as IntuitionPlugin;

		// Initialize settings properly
		plugin.settings = {
			llm: {
				enabled: true,
				provider: 'anthropic',
				encryptedApiKey: 'test-key',
			},
		} as any;

		// Mock the LLM service
		plugin.llmService = {
			isAvailable: vi.fn(() => true),
			extractClaims: vi.fn(async (text: string) => [{
				subject: { text: 'Albert Einstein', type: 'Person' },
				predicate: { text: 'created', type: 'Relationship' },
				object: { text: 'general relativity', type: 'Concept' },
				confidence: 0.9,
			}]),
		} as any;

		// Mock the claim parser service
		plugin.claimParserService = {
			extractTriple: vi.fn(async () => null),
			validateClaim: vi.fn(() => ({ warnings: [] })),
		} as any;

		// Mock the notice manager
		plugin.noticeManager = {
			info: vi.fn(),
			warning: vi.fn(),
			error: vi.fn(),
			success: vi.fn(),
		} as any;

		// Mock the intuition service
		plugin.intuitionService = {
			searchAtoms: vi.fn(async () => []),
			semanticSearchAtoms: vi.fn(async () => []),
		} as any;

		modal = new ClaimModal(
			app,
			plugin,
			'Einstein made relativity',
			'/test/file.md'
		);
	});

	afterEach(() => {
		modal.close();
	});

	describe('Regex Parsing', () => {
		it('should parse simple suggestions with "created" predicate', () => {
			const result = (modal as any).parseSuggestionRegex(
				'Albert Einstein created the theory of relativity',
				'created'
			);

			expect(result).toEqual({
				subject: 'Albert Einstein',
				predicate: 'created',
				object: 'the theory of relativity'
			});
		});

		it('should parse "is a" predicates when passed as original predicate', () => {
			const result = (modal as any).parseSuggestionRegex(
				'Bitcoin is a cryptocurrency',
				'is a'
			);

			expect(result).toEqual({
				subject: 'Bitcoin',
				predicate: 'is a',
				object: 'cryptocurrency'
			});
		});

		it('should parse "is" predicates', () => {
			const result = (modal as any).parseSuggestionRegex(
				'Gold is valuable',
				'is'
			);

			expect(result).toEqual({
				subject: 'Gold',
				predicate: 'is',
				object: 'valuable'
			});
		});

		it('should parse "has" predicates', () => {
			const result = (modal as any).parseSuggestionRegex(
				'Bitcoin has blockchain technology',
				'has'
			);

			expect(result).toEqual({
				subject: 'Bitcoin',
				predicate: 'has',
				object: 'blockchain technology'
			});
		});

		it('should return null for truly unparseable suggestions', () => {
			const result = (modal as any).parseSuggestionRegex(
				'Random text without structure',
				'nonexistent'
			);

			expect(result).toBeNull();
		});

		it('should handle case-insensitive matching', () => {
			const result = (modal as any).parseSuggestionRegex(
				'SpaceX LAUNCHED Starship',
				'launched'
			);

			expect(result).toEqual({
				subject: 'SpaceX',
				predicate: 'launched',
				object: 'Starship'
			});
		});

		it('should try original predicate first', () => {
			const result = (modal as any).parseSuggestionRegex(
				'Company developed product',
				'developed'
			);

			expect(result).toEqual({
				subject: 'Company',
				predicate: 'developed',
				object: 'product'
			});
		});
	});

	describe('Hybrid Parsing', () => {
		it('should use regex parsing when it succeeds', async () => {
			const result = await (modal as any).parseSuggestion(
				'Albert Einstein created general relativity',
				'created'
			);

			expect(result).toEqual({
				subject: 'Albert Einstein',
				predicate: 'created',
				object: 'general relativity'
			});

			// LLM should not be called
			expect(plugin.llmService.extractClaims).not.toHaveBeenCalled();
		});

		it('should fallback to LLM when regex fails', async () => {
			const result = await (modal as any).parseSuggestion(
				'Complex relationship between A and B',
				'unknown'
			);

			expect(result).toEqual({
				subject: 'Albert Einstein',
				predicate: 'created',
				object: 'general relativity'
			});

			// LLM should be called
			expect(plugin.llmService.extractClaims).toHaveBeenCalledWith(
				'Complex relationship between A and B'
			);
		});

		it('should return null when both regex and LLM fail', async () => {
			// Suppress expected console.debug output
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			plugin.llmService.extractClaims = vi.fn(async () => []);

			const result = await (modal as any).parseSuggestion(
				'Unparseable text',
				'unknown'
			);

			expect(result).toBeNull();
			consoleDebugSpy.mockRestore();
		});

		it('should return null when LLM is disabled and regex fails', async () => {
			plugin.settings.llm.enabled = false;

			const result = await (modal as any).parseSuggestion(
				'Unparseable text',
				'unknown'
			);

			expect(result).toBeNull();
			expect(plugin.llmService.extractClaims).not.toHaveBeenCalled();
		});

		it('should return null when LLM is not available and regex fails', async () => {
			plugin.llmService.isAvailable = vi.fn(() => false);

			const result = await (modal as any).parseSuggestion(
				'Unparseable text',
				'unknown'
			);

			expect(result).toBeNull();
			expect(plugin.llmService.extractClaims).not.toHaveBeenCalled();
		});

		it('should handle LLM extraction errors gracefully', async () => {
			// Suppress expected console.debug output
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			plugin.llmService.extractClaims = vi.fn(async () => {
				throw new Error('LLM API error');
			});

			const result = await (modal as any).parseSuggestion(
				'Unparseable text',
				'unknown'
			);

			expect(result).toBeNull();
			consoleDebugSpy.mockRestore();
		});
	});
});

describe('ClaimModal - Predicate Alternatives', () => {
	let modal: ClaimModal;
	let plugin: IntuitionPlugin;

	beforeEach(() => {
		const { plugin: testPlugin, app } = createTestPlugin({
			llm: {
				enabled: true,
				provider: 'anthropic',
				encryptedApiKey: 'test-key',
			},
		});
		plugin = testPlugin as unknown as IntuitionPlugin;

		// Initialize settings
		plugin.settings = {
			llm: {
				enabled: true,
				provider: 'anthropic',
				encryptedApiKey: 'test-key',
			},
		} as any;

		// Mock services
		plugin.llmService = {
			isAvailable: vi.fn(() => true),
		} as any;

		plugin.claimParserService = {
			validateClaim: vi.fn(() => ({ warnings: [] })),
			extractTriple: vi.fn(async () => null),
		} as any;

		plugin.noticeManager = {
			info: vi.fn(),
			success: vi.fn(),
			error: vi.fn(),
		} as any;

		plugin.intuitionService = {
			searchAtoms: vi.fn(async () => []),
		} as any;

		modal = new ClaimModal(
			app,
			plugin,
			'Bitcoin is a cryptocurrency',
			'/test/file.md'
		);
	});

	afterEach(() => {
		modal.close();
	});

	it('should render alternatives as pills when LLM metadata exists', () => {
		modal.onOpen();

		(modal as any).renderPredicateAlternatives(['represents', 'functions as', 'serves as']);

		const pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills.length).toBe(3);
		expect(pills[0].textContent).toBe('represents');
		expect(pills[1].textContent).toBe('functions as');
		expect(pills[2].textContent).toBe('serves as');
	});

	it('should not render alternatives if none exist', () => {
		modal.onOpen();

		(modal as any).renderPredicateAlternatives([]);

		const pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills.length).toBe(0);
	});

	it('should not render alternatives if null', () => {
		modal.onOpen();

		(modal as any).renderPredicateAlternatives(null);

		const pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills.length).toBe(0);
	});

	it('should limit to 5 alternatives', () => {
		modal.onOpen();

		(modal as any).renderPredicateAlternatives(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);

		const pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills.length).toBe(5);

		const moreText = modal.contentEl.querySelector('.alternatives-more');
		expect(moreText?.textContent).toContain('+5 more');
	});

	it('should not show "more" indicator if 5 or fewer alternatives', () => {
		modal.onOpen();

		(modal as any).renderPredicateAlternatives(['a', 'b', 'c']);

		const moreText = modal.contentEl.querySelector('.alternatives-more');
		expect(moreText).toBeNull();
	});

	it('should highlight current predicate as selected', () => {
		modal.onOpen();

		// Set current predicate
		(modal as any).draft.predicate = { label: 'created', type: 'new' };

		(modal as any).renderPredicateAlternatives(['developed', 'created', 'built']);

		const pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills[0].classList.contains('is-selected')).toBe(false);
		expect(pills[1].classList.contains('is-selected')).toBe(true);
		expect(pills[2].classList.contains('is-selected')).toBe(false);
	});

	it('should update predicate field when pill is clicked', async () => {
		modal.onOpen();

		// Mock the predicate search setValue
		const setValueSpy = vi.fn();
		(modal as any).predicateSearch = {
			setValue: setValueSpy,
			destroy: vi.fn(),
		};

		(modal as any).renderPredicateAlternatives(['developed', 'created', 'built']);

		const pills = modal.contentEl.querySelectorAll('.predicate-pill');
		(pills[1] as HTMLButtonElement).click();

		await flushPromises();

		expect(setValueSpy).toHaveBeenCalledWith('created');
	});

	it('should trigger existence check after selecting alternative', async () => {
		modal.onOpen();

		// Mock necessary methods
		(modal as any).predicateSearch = {
			setValue: vi.fn(),
			destroy: vi.fn(),
		};

		const checkSpy = vi.fn();
		(modal as any).checkIfClaimExists = checkSpy;
		(modal as any).validateDraft = vi.fn();

		(modal as any).renderPredicateAlternatives(['developed']);

		const pill = modal.contentEl.querySelector('.predicate-pill') as HTMLButtonElement;
		pill.click();

		await flushPromises();

		expect(checkSpy).toHaveBeenCalled();
	});

	it('should show success notice when predicate is updated', async () => {
		modal.onOpen();

		(modal as any).predicateSearch = {
			setValue: vi.fn(),
			destroy: vi.fn(),
		};
		(modal as any).validateDraft = vi.fn();
		(modal as any).checkIfClaimExists = vi.fn();

		(modal as any).renderPredicateAlternatives(['developed']);

		const pill = modal.contentEl.querySelector('.predicate-pill') as HTMLButtonElement;
		pill.click();

		await flushPromises();

		expect(plugin.noticeManager.success).toHaveBeenCalledWith('Predicate updated to "developed"');
	});

	it('should show error notice on failure', async () => {
		// Suppress expected console.error output
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		modal.onOpen();

		(modal as any).predicateSearch = {
			setValue: vi.fn(() => {
				throw new Error('Update failed');
			}),
			destroy: vi.fn(),
		};

		(modal as any).renderPredicateAlternatives(['developed']);

		const pill = modal.contentEl.querySelector('.predicate-pill') as HTMLButtonElement;
		pill.click();

		await flushPromises();

		expect(plugin.noticeManager.error).toHaveBeenCalledWith('Failed to update predicate');
		consoleErrorSpy.mockRestore();
	});

	it('should clear existing alternatives before rendering new ones', () => {
		modal.onOpen();

		// Render first set
		(modal as any).renderPredicateAlternatives(['a', 'b']);
		let pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills.length).toBe(2);

		// Render second set
		(modal as any).renderPredicateAlternatives(['x', 'y', 'z']);
		pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills.length).toBe(3);
		expect(pills[0].textContent).toBe('x');
	});

	it('should not render alternatives when LLM metadata has empty array', () => {
		modal.onOpen();

		// Directly test the renderPredicateAlternatives logic
		// When called with empty array, it should return early and not render pills
		(modal as any).renderPredicateAlternatives([]);

		const pills = modal.contentEl.querySelectorAll('.predicate-pill');
		expect(pills.length).toBe(0);
	});
});
