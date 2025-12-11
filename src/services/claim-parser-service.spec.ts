/**
 * Tests for Claim Parser Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimParserService } from './claim-parser-service';
import type IntuitionPlugin from '../main';
import type { LLMService } from './llm-service';
import type { ExtractedClaimLLM } from '../types/llm';

describe('ClaimParserService', () => {
	let service: ClaimParserService;
	let mockPlugin: IntuitionPlugin;

	beforeEach(async () => {
		// Create a minimal mock plugin
		mockPlugin = {
			app: {},
		} as unknown as IntuitionPlugin;

		service = new ClaimParserService(mockPlugin);
		await service.initialize();
	});

	describe('parseText', () => {
		describe('is-a pattern', () => {
			it('should extract "X is a Y" pattern', async () => {
				const result = await service.extractTriple('Bitcoin is a cryptocurrency');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Bitcoin');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('cryptocurrency');
				expect(result?.pattern).toBe('is-a');
			});

			it('should extract "X is an Y" pattern', async () => {
				const result = await service.extractTriple('Ethereum is an altcoin');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Ethereum');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('altcoin');
				expect(result?.pattern).toBe('is-a');
			});

			it('should have high confidence for is-a pattern', async () => {
				const result = await service.extractTriple('Bitcoin is a cryptocurrency');
				// Confidence after penalties is around 0.8
				expect(result?.confidence).toBeGreaterThanOrEqual(0.75);
			});
		});

		describe('is pattern', () => {
			it('should extract "X is Y" pattern', async () => {
				const result = await service.extractTriple('Bitcoin is cryptocurrency');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Bitcoin');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('cryptocurrency');
				expect(result?.pattern).toBe('is');
			});

			it('should work with multi-word subjects and objects', async () => {
				const result = await service.extractTriple('The Matrix is science fiction');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Matrix');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('science fiction');
			});
		});

		describe('has pattern', () => {
			it('should extract "X has Y" pattern', async () => {
				const result = await service.extractTriple('Ethereum has smart contracts');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Ethereum');
				expect(result?.predicate).toBe('has');
				expect(result?.object).toBe('smart contracts');
				expect(result?.pattern).toBe('has');
			});

			it('should handle article removal in has pattern', async () => {
				const result = await service.extractTriple('The dog has a tail');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('dog');
				expect(result?.object).toBe('tail');
			});
		});

		describe('uses pattern', () => {
			it('should extract "X uses Y" pattern', async () => {
				const result = await service.extractTriple('Bitcoin uses proof of work');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Bitcoin');
				expect(result?.predicate).toBe('uses');
				expect(result?.object).toBe('proof of work');
				expect(result?.pattern).toBe('uses');
			});
		});

		describe('passive pattern', () => {
			it('should extract "X created by Y" pattern', async () => {
				const result = await service.extractTriple('Bitcoin created by Satoshi');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Satoshi');
				expect(result?.predicate).toBe('created');
				expect(result?.object).toBe('Bitcoin');
				expect(result?.pattern).toBe('passive');
			});

			it('should extract "X founded by Y" pattern', async () => {
				const result = await service.extractTriple('Apple founded by Steve Jobs');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Steve Jobs');
				expect(result?.predicate).toBe('founded');
				expect(result?.object).toBe('Apple');
			});

			it('should support other passive verbs', async () => {
				const verbs = [
					'built',
					'made',
					'developed',
					'invented',
				];

				for (const verb of verbs) {
					const result = await service.extractTriple(
						`Product ${verb} by Company`
					);
					expect(result).not.toBeNull();
					expect(result?.predicate).toBe(verb);
				}
			});
		});

		describe('verb pattern', () => {
			it('should extract generic verb patterns', async () => {
				const verbs = [
					'enables',
					'provides',
					'supports',
					'requires',
					'implements',
					'extends',
					'includes',
					'contains',
				];

				for (const verb of verbs) {
					const result = await service.extractTriple(
						`Subject ${verb} Object`
					);
					expect(result).not.toBeNull();
					expect(result?.predicate).toBe(verb);
					expect(result?.pattern).toBe('verb');
				}
			});
		});

		describe('text normalization', () => {
			it('should remove trailing punctuation', async () => {
				const result = await service.extractTriple('Bitcoin is cryptocurrency.');
				expect(result).not.toBeNull();
				expect(result?.object).not.toContain('.');
			});

			it('should normalize whitespace', async () => {
				const result = await service.extractTriple(
					'Bitcoin    is    cryptocurrency'
				);
				expect(result).not.toBeNull();
			});

			it('should remove leading articles', async () => {
				const result = await service.extractTriple('The dog is an animal');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('dog');
				expect(result?.object).toBe('animal');
			});

			it('should handle multiple exclamation marks', async () => {
				const result = await service.extractTriple('Bitcoin is great!!!');
				expect(result).not.toBeNull();
				expect(result?.object).not.toContain('!');
			});
		});

		describe('edge cases', () => {
			it('should return null for empty string', async () => {
				const result = await service.extractTriple('');
				expect(result).toBeNull();
			});

			it('should return null for whitespace only', async () => {
				const result = await service.extractTriple('   ');
				expect(result).toBeNull();
			});

			it('should return null for text that matches no pattern', async () => {
				const result = await service.extractTriple('just random words here');
				expect(result).toBeNull();
			});

			it('should handle special characters', async () => {
				const result = await service.extractTriple('Web3.0 is blockchain-based');
				expect(result).not.toBeNull();
				expect(result?.subject).toContain('3.0');
			});

			it('should handle very long text', async () => {
				const longSubject = 'A'.repeat(100);
				const result = await service.extractTriple(
					`${longSubject} is something`
				);
				expect(result).not.toBeNull();
				// Long components should reduce confidence
				expect(result?.confidence).toBeLessThan(0.8);
			});

			it('should handle unicode characters', async () => {
				const result = await service.extractTriple('Café is a beverage');
				expect(result).not.toBeNull();
				expect(result?.subject).toContain('Café');
			});

			it('should handle numbers in text', async () => {
				const result = await service.extractTriple('Bitcoin 2.0 is cryptocurrency');
				expect(result).not.toBeNull();
			});
		});

		describe('confidence calculation', () => {
			it('should boost confidence for proper nouns (capitalized)', async () => {
				const result1 = await service.extractTriple('Bitcoin is cryptocurrency');
				const result2 = await service.extractTriple('bitcoin is cryptocurrency');

				expect(result1?.confidence).toBeGreaterThan(
					result2?.confidence ?? 0
				);
			});

			it('should boost confidence for short predicates', async () => {
				const result = await service.extractTriple('X is Y');
				// Short predicate gets boost, but single words get penalty
				expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
			});

			it('should penalize very long components', async () => {
				const longSubject = 'A'.repeat(60);
				const result = await service.extractTriple(
					`${longSubject} is something`
				);
				expect(result).not.toBeNull();
				expect(result?.confidence).toBeLessThan(0.7);
			});

			it('should penalize single-word subjects', async () => {
				const result1 = await service.extractTriple('Bitcoin is cryptocurrency');
				const result2 = await service.extractTriple(
					'Digital currency Bitcoin is cryptocurrency'
				);

				// Single word gets penalty
				expect(result1?.confidence).toBeLessThan(
					result2?.confidence ?? 0
				);
			});

			it('should never exceed 1.0 confidence', async () => {
				const result = await service.extractTriple('Bitcoin is cryptocurrency');
				expect(result?.confidence).toBeLessThanOrEqual(1.0);
			});

			it('should never go below 0.1 confidence', async () => {
				const longText = 'A'.repeat(100);
				const result = await service.extractTriple(`${longText} is ${longText}`);
				expect(result?.confidence).toBeGreaterThanOrEqual(0.1);
			});
		});
	});

	describe('validateClaim', () => {
		describe('valid claims', () => {
			it('should pass for valid claim text', async () => {
				const validation = service.validateClaim(
					'Bitcoin is a cryptocurrency'
				);
				expect(validation.isValid).toBe(true);
				expect(validation.errors).toHaveLength(0);
			});

			it('should pass for claims with 3+ words', async () => {
				const validation = service.validateClaim('Bitcoin is great');
				expect(validation.isValid).toBe(true);
			});
		});

		describe('invalid claims - errors', () => {
			it('should fail for empty text', async () => {
				const validation = service.validateClaim('');
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain('Text is empty');
			});

			it('should fail for whitespace only', async () => {
				const validation = service.validateClaim('   ');
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain('Text is empty');
			});

			it('should fail for text with less than 3 words', async () => {
				const validation = service.validateClaim('Bitcoin rocks');
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'Text is too short (minimum 3 words)'
				);
			});

			it('should fail for questions', async () => {
				const validation = service.validateClaim(
					'Is Bitcoin a cryptocurrency?'
				);
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'Questions cannot be claims'
				);
			});

			it('should fail for first-person opinions with "I think"', async () => {
				const validation = service.validateClaim(
					'I think Bitcoin is great'
				);
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'First-person opinions are subjective'
				);
			});

			it('should fail for first-person opinions with "I believe"', async () => {
				const validation = service.validateClaim(
					'I believe in Bitcoin'
				);
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'First-person opinions are subjective'
				);
			});

			it('should fail for other first-person opinion words', async () => {
				const words = ['feel', 'guess', 'suppose'];

				words.forEach((word) => {
					const validation = service.validateClaim(
						`I ${word} Bitcoin is good`
					);
					expect(validation.isValid).toBe(false);
					expect(validation.errors).toContain(
						'First-person opinions are subjective'
					);
				});
			});
		});

		describe('warnings (not invalid)', () => {
			it('should warn for hedged statements with "might"', async () => {
				const validation = service.validateClaim(
					'Bitcoin might be good'
				);
				expect(validation.isValid).toBe(true);
				expect(validation.warnings).toContain(
					'Hedged statements lack certainty'
				);
			});

			it('should warn for hedged statements with various hedging words', async () => {
				const words = [
					'could',
					'maybe',
					'possibly',
					'perhaps',
					'probably',
				];

				words.forEach((word) => {
					const validation = service.validateClaim(
						`Bitcoin ${word} be good cryptocurrency`
					);
					expect(validation.isValid).toBe(true);
					expect(validation.warnings).toContain(
						'Hedged statements lack certainty'
					);
				});
			});

			it('should warn for very long text', async () => {
				const longText = 'A'.repeat(201) + ' is test text here';
				const validation = service.validateClaim(longText);
				expect(validation.isValid).toBe(true);
				expect(validation.warnings).toContain(
					'Text is very long, consider shortening'
				);
			});

			it('should not warn for text under 200 characters', async () => {
				const validation = service.validateClaim(
					'Bitcoin is a cryptocurrency'
				);
				expect(validation.warnings).toHaveLength(0);
			});
		});

		describe('edge cases', () => {
			it('should handle multiple errors', async () => {
				const validation = service.validateClaim('Is it?');
				expect(validation.isValid).toBe(false);
				expect(validation.errors.length).toBeGreaterThan(1);
			});

			it('should handle both errors and warnings', async () => {
				const validation = service.validateClaim('Test?');
				expect(validation.isValid).toBe(false);
				expect(validation.errors.length).toBeGreaterThan(0);
			});

			it('should trim whitespace before validation', async () => {
				const validation = service.validateClaim(
					'   Bitcoin is cryptocurrency   '
				);
				expect(validation.isValid).toBe(true);
			});

			it('should be case-insensitive for first-person checks', async () => {
				const validation = service.validateClaim(
					'I THINK this is true'
				);
				expect(validation.isValid).toBe(false);
			});

			it('should be case-insensitive for hedging checks', async () => {
				const validation = service.validateClaim(
					'This MIGHT be true test'
				);
				expect(validation.warnings).toContain(
					'Hedged statements lack certainty'
				);
			});
		});
	});

	describe('initialize and cleanup', () => {
		it('should initialize patterns', async () => {
			const newService = new ClaimParserService(mockPlugin);
			await newService.initialize();

			// Should be able to parse after initialization
			const result = await newService.extractTriple('Bitcoin is cryptocurrency');
			expect(result).not.toBeNull();
		});

		it('should not throw on cleanup', async () => {
			expect(() => service.cleanup()).not.toThrow();
		});

		it('should work after cleanup (stateless)', async () => {
			service.cleanup();
			const result = await service.extractTriple('Bitcoin is cryptocurrency');
			expect(result).not.toBeNull();
		});
	});

	describe('pattern priority', () => {
		it('should match more specific patterns first', async () => {
			// "is-a" is more specific than "is"
			const result = await service.extractTriple('Bitcoin is a cryptocurrency');
			expect(result?.pattern).toBe('is-a');
		});

		it('should fallback to less specific patterns', async () => {
			const result = await service.extractTriple('Bitcoin is cryptocurrency');
			expect(result?.pattern).toBe('is');
		});
	});

	describe('real-world examples', () => {
		it('should parse blockchain-related claims', async () => {
			const examples = [
				'Ethereum is a smart contract platform',
				'Bitcoin uses proof of work consensus',
				'Cardano implements Ouroboros protocol',
				'Solana founded by Anatoly Yakovenko',
				'Web3 enables decentralization',
			];

			for (const example of examples) {
				const result = await service.extractTriple(example);
				expect(result).not.toBeNull();
				expect(result?.subject).toBeTruthy();
				expect(result?.predicate).toBeTruthy();
				expect(result?.object).toBeTruthy();
			}
		});

		it('should handle technical terminology', async () => {
			const result = await service.extractTriple(
				'Zero-knowledge proof is a cryptographic method'
			);
			expect(result).not.toBeNull();
			expect(result?.subject).toContain('Zero-knowledge');
		});
	});

	describe('LLM Integration', () => {
		let mockLLMService: Partial<LLMService>;
		let mockLLMClaim: ExtractedClaimLLM;

		beforeEach(() => {
			// Create mock LLM claim
			mockLLMClaim = {
				subject: {
					text: 'Einstein',
					type: 'person',
					disambiguation: 'Albert Einstein (physicist)',
					confidence: 0.95,
				},
				predicate: {
					text: 'created',
					normalized: 'created',
					alternatives: ['developed', 'formulated', 'invented'],
				},
				object: {
					text: 'relativity theory',
					type: 'concept',
					disambiguation: 'Theory of Relativity (physics)',
					confidence: 0.9,
				},
				originalSentence: 'Einstein created relativity theory',
				confidence: 0.92,
				reasoning: 'Clear factual claim about a person creating a concept',
				suggestedImprovement: 'Einstein developed the theory of relativity',
				warnings: ['Consider specifying which theory (special or general)'],
			};

			// Create mock LLM service
			mockLLMService = {
				isAvailable: vi.fn(),
				extractClaims: vi.fn(),
			};
		});

		it('should use LLM when available', async () => {
			(mockLLMService.isAvailable as any).mockReturnValue(true);
			(mockLLMService.extractClaims as any).mockResolvedValue([
				mockLLMClaim,
			]);

			const mockPluginWithLLM = {
				app: {},
				llmService: mockLLMService,
				settings: {
					llm: {
						features: {
							claimExtraction: true,
						},
					},
				},
			} as unknown as IntuitionPlugin;

			const parser = new ClaimParserService(mockPluginWithLLM);
			await parser.initialize();

			const result = await parser.extractTriple(
				'Einstein created relativity theory'
			);

			expect(result).not.toBeNull();
			expect(result?.pattern).toBe('llm');
			expect(result?.subject).toBe('Einstein');
			expect(result?.predicate).toBe('created');
			expect(result?.object).toBe('relativity theory');
			expect(result?.confidence).toBe(0.92);
			expect(result?.llmMetadata).toBeDefined();
			expect(result?.llmMetadata?.subjectType).toBe('person');
			expect(result?.llmMetadata?.subjectDisambiguation).toBe(
				'Albert Einstein (physicist)'
			);
			expect(mockLLMService.extractClaims).toHaveBeenCalledWith(
				'Einstein created relativity theory'
			);
		});

		it('should fall back to regex when LLM unavailable', async () => {
			(mockLLMService.isAvailable as any).mockReturnValue(false);

			const mockPluginWithLLM = {
				app: {},
				llmService: mockLLMService,
				settings: {
					llm: {
						features: {
							claimExtraction: true,
						},
					},
				},
			} as unknown as IntuitionPlugin;

			const parser = new ClaimParserService(mockPluginWithLLM);
			await parser.initialize();

			const result = await parser.extractTriple('Einstein is a physicist');

			expect(result).not.toBeNull();
			expect(result?.pattern).toBe('is-a');
			expect(result?.subject).toBe('Einstein');
			expect(result?.predicate).toBe('is');
			expect(result?.object).toBe('physicist');
			expect(mockLLMService.extractClaims).not.toHaveBeenCalled();
		});

		it('should fall back to regex when LLM fails', async () => {
			// Suppress expected console.debug output
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			(mockLLMService.isAvailable as any).mockReturnValue(true);
			(mockLLMService.extractClaims as any).mockRejectedValue(
				new Error('API error')
			);

			const mockPluginWithLLM = {
				app: {},
				llmService: mockLLMService,
				settings: {
					llm: {
						features: {
							claimExtraction: true,
						},
					},
				},
			} as unknown as IntuitionPlugin;

			const parser = new ClaimParserService(mockPluginWithLLM);
			await parser.initialize();

			const result = await parser.extractTriple('Einstein is a physicist');

			expect(result).not.toBeNull();
			expect(result?.pattern).toBe('is-a');
			expect(result?.subject).toBe('Einstein');
			expect(mockLLMService.extractClaims).toHaveBeenCalled();
			consoleDebugSpy.mockRestore();
		});

		it('should fall back to regex when LLM returns empty results', async () => {
			(mockLLMService.isAvailable as any).mockReturnValue(true);
			(mockLLMService.extractClaims as any).mockResolvedValue([]);

			const mockPluginWithLLM = {
				app: {},
				llmService: mockLLMService,
				settings: {
					llm: {
						features: {
							claimExtraction: true,
						},
					},
				},
			} as unknown as IntuitionPlugin;

			const parser = new ClaimParserService(mockPluginWithLLM);
			await parser.initialize();

			const result = await parser.extractTriple('Einstein is a physicist');

			expect(result).not.toBeNull();
			expect(result?.pattern).toBe('is-a');
			expect(mockLLMService.extractClaims).toHaveBeenCalled();
		});

		it('should not use LLM when feature disabled', async () => {
			(mockLLMService.isAvailable as any).mockReturnValue(true);

			const mockPluginWithLLM = {
				app: {},
				llmService: mockLLMService,
				settings: {
					llm: {
						features: {
							claimExtraction: false, // Feature disabled
						},
					},
				},
			} as unknown as IntuitionPlugin;

			const parser = new ClaimParserService(mockPluginWithLLM);
			await parser.initialize();

			const result = await parser.extractTriple('Einstein is a physicist');

			expect(result).not.toBeNull();
			expect(result?.pattern).toBe('is-a');
			expect(mockLLMService.extractClaims).not.toHaveBeenCalled();
		});

		it('should convert LLM results correctly', async () => {
			(mockLLMService.isAvailable as any).mockReturnValue(true);
			(mockLLMService.extractClaims as any).mockResolvedValue([
				mockLLMClaim,
			]);

			const mockPluginWithLLM = {
				app: {},
				llmService: mockLLMService,
				settings: {
					llm: {
						features: {
							claimExtraction: true,
						},
					},
				},
			} as unknown as IntuitionPlugin;

			const parser = new ClaimParserService(mockPluginWithLLM);
			await parser.initialize();

			const result = await parser.extractTriple(
				'Einstein created relativity theory'
			);

			expect(result?.llmMetadata).toEqual({
				subjectType: 'person',
				subjectDisambiguation: 'Albert Einstein (physicist)',
				subjectConfidence: 0.95,
				objectType: 'concept',
				objectDisambiguation: 'Theory of Relativity (physics)',
				objectConfidence: 0.9,
				predicateAlternatives: ['developed', 'formulated', 'invented'],
				reasoning: 'Clear factual claim about a person creating a concept',
				suggestedImprovement:
					'Einstein developed the theory of relativity',
				warnings: ['Consider specifying which theory (special or general)'],
			});
		});

		it('should preserve existing regex patterns when LLM enabled', async () => {
			(mockLLMService.isAvailable as any).mockReturnValue(true);
			(mockLLMService.extractClaims as any).mockResolvedValue([]);

			const mockPluginWithLLM = {
				app: {},
				llmService: mockLLMService,
				settings: {
					llm: {
						features: {
							claimExtraction: true,
						},
					},
				},
			} as unknown as IntuitionPlugin;

			const parser = new ClaimParserService(mockPluginWithLLM);
			await parser.initialize();

			const testCases = [
				{ text: 'Bitcoin is a cryptocurrency', expectedPattern: 'is-a' },
				{ text: 'Ethereum has smart contracts', expectedPattern: 'has' },
				{ text: 'Bitcoin uses proof of work', expectedPattern: 'uses' },
				{
					text: 'Bitcoin created by Satoshi',
					expectedPattern: 'passive',
				},
				{ text: 'Ethereum enables DeFi', expectedPattern: 'verb' },
			];

			for (const testCase of testCases) {
				const result = await parser.extractTriple(testCase.text);
				expect(result).not.toBeNull();
				expect(result?.pattern).toBe(testCase.expectedPattern);
			}
		});
	});
});
