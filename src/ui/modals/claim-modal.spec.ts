import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaimModal } from './claim-modal';
import { createTestPlugin } from '../../../tests/fixtures/plugin';
import { createTimeController } from '../../../tests/helpers/test-plugin';
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

		// Mock the claim parser service
		plugin.claimParserService = {
			extractTriple: vi.fn(async () => ({
				subject: 'Test Subject',
				predicate: 'test-predicate',
				object: 'Test Object',
				confidence: 0.85,
				pattern: 'llm',
			})),
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
			// Make extraction throw error
			plugin.claimParserService.extractTriple = vi.fn(async () => {
				throw new Error('Extraction failed');
			});

			modal.onOpen();

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
