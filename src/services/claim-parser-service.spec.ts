/**
 * Tests for Claim Parser Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaimParserService } from './claim-parser-service';
import type IntuitionPlugin from '../main';

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
			it('should extract "X is a Y" pattern', () => {
				const result = service.parseText('Bitcoin is a cryptocurrency');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Bitcoin');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('cryptocurrency');
				expect(result?.pattern).toBe('is-a');
			});

			it('should extract "X is an Y" pattern', () => {
				const result = service.parseText('Ethereum is an altcoin');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Ethereum');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('altcoin');
				expect(result?.pattern).toBe('is-a');
			});

			it('should have high confidence for is-a pattern', () => {
				const result = service.parseText('Bitcoin is a cryptocurrency');
				// Confidence after penalties is around 0.8
				expect(result?.confidence).toBeGreaterThanOrEqual(0.75);
			});
		});

		describe('is pattern', () => {
			it('should extract "X is Y" pattern', () => {
				const result = service.parseText('Bitcoin is cryptocurrency');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Bitcoin');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('cryptocurrency');
				expect(result?.pattern).toBe('is');
			});

			it('should work with multi-word subjects and objects', () => {
				const result = service.parseText('The Matrix is science fiction');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Matrix');
				expect(result?.predicate).toBe('is');
				expect(result?.object).toBe('science fiction');
			});
		});

		describe('has pattern', () => {
			it('should extract "X has Y" pattern', () => {
				const result = service.parseText('Ethereum has smart contracts');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Ethereum');
				expect(result?.predicate).toBe('has');
				expect(result?.object).toBe('smart contracts');
				expect(result?.pattern).toBe('has');
			});

			it('should handle article removal in has pattern', () => {
				const result = service.parseText('The dog has a tail');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('dog');
				expect(result?.object).toBe('tail');
			});
		});

		describe('uses pattern', () => {
			it('should extract "X uses Y" pattern', () => {
				const result = service.parseText('Bitcoin uses proof of work');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Bitcoin');
				expect(result?.predicate).toBe('uses');
				expect(result?.object).toBe('proof of work');
				expect(result?.pattern).toBe('uses');
			});
		});

		describe('passive pattern', () => {
			it('should extract "X created by Y" pattern', () => {
				const result = service.parseText('Bitcoin created by Satoshi');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Satoshi');
				expect(result?.predicate).toBe('created');
				expect(result?.object).toBe('Bitcoin');
				expect(result?.pattern).toBe('passive');
			});

			it('should extract "X founded by Y" pattern', () => {
				const result = service.parseText('Apple founded by Steve Jobs');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('Steve Jobs');
				expect(result?.predicate).toBe('founded');
				expect(result?.object).toBe('Apple');
			});

			it('should support other passive verbs', () => {
				const verbs = [
					'built',
					'made',
					'developed',
					'invented',
				];

				verbs.forEach((verb) => {
					const result = service.parseText(
						`Product ${verb} by Company`
					);
					expect(result).not.toBeNull();
					expect(result?.predicate).toBe(verb);
				});
			});
		});

		describe('verb pattern', () => {
			it('should extract generic verb patterns', () => {
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

				verbs.forEach((verb) => {
					const result = service.parseText(
						`Subject ${verb} Object`
					);
					expect(result).not.toBeNull();
					expect(result?.predicate).toBe(verb);
					expect(result?.pattern).toBe('verb');
				});
			});
		});

		describe('text normalization', () => {
			it('should remove trailing punctuation', () => {
				const result = service.parseText('Bitcoin is cryptocurrency.');
				expect(result).not.toBeNull();
				expect(result?.object).not.toContain('.');
			});

			it('should normalize whitespace', () => {
				const result = service.parseText(
					'Bitcoin    is    cryptocurrency'
				);
				expect(result).not.toBeNull();
			});

			it('should remove leading articles', () => {
				const result = service.parseText('The dog is an animal');
				expect(result).not.toBeNull();
				expect(result?.subject).toBe('dog');
				expect(result?.object).toBe('animal');
			});

			it('should handle multiple exclamation marks', () => {
				const result = service.parseText('Bitcoin is great!!!');
				expect(result).not.toBeNull();
				expect(result?.object).not.toContain('!');
			});
		});

		describe('edge cases', () => {
			it('should return null for empty string', () => {
				const result = service.parseText('');
				expect(result).toBeNull();
			});

			it('should return null for whitespace only', () => {
				const result = service.parseText('   ');
				expect(result).toBeNull();
			});

			it('should return null for text that matches no pattern', () => {
				const result = service.parseText('just random words here');
				expect(result).toBeNull();
			});

			it('should handle special characters', () => {
				const result = service.parseText('Web3.0 is blockchain-based');
				expect(result).not.toBeNull();
				expect(result?.subject).toContain('3.0');
			});

			it('should handle very long text', () => {
				const longSubject = 'A'.repeat(100);
				const result = service.parseText(
					`${longSubject} is something`
				);
				expect(result).not.toBeNull();
				// Long components should reduce confidence
				expect(result?.confidence).toBeLessThan(0.8);
			});

			it('should handle unicode characters', () => {
				const result = service.parseText('Café is a beverage');
				expect(result).not.toBeNull();
				expect(result?.subject).toContain('Café');
			});

			it('should handle numbers in text', () => {
				const result = service.parseText('Bitcoin 2.0 is cryptocurrency');
				expect(result).not.toBeNull();
			});
		});

		describe('confidence calculation', () => {
			it('should boost confidence for proper nouns (capitalized)', () => {
				const result1 = service.parseText('Bitcoin is cryptocurrency');
				const result2 = service.parseText('bitcoin is cryptocurrency');

				expect(result1?.confidence).toBeGreaterThan(
					result2?.confidence ?? 0
				);
			});

			it('should boost confidence for short predicates', () => {
				const result = service.parseText('X is Y');
				// Short predicate gets boost, but single words get penalty
				expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
			});

			it('should penalize very long components', () => {
				const longSubject = 'A'.repeat(60);
				const result = service.parseText(
					`${longSubject} is something`
				);
				expect(result).not.toBeNull();
				expect(result?.confidence).toBeLessThan(0.7);
			});

			it('should penalize single-word subjects', () => {
				const result1 = service.parseText('Bitcoin is cryptocurrency');
				const result2 = service.parseText(
					'Digital currency Bitcoin is cryptocurrency'
				);

				// Single word gets penalty
				expect(result1?.confidence).toBeLessThan(
					result2?.confidence ?? 0
				);
			});

			it('should never exceed 1.0 confidence', () => {
				const result = service.parseText('Bitcoin is cryptocurrency');
				expect(result?.confidence).toBeLessThanOrEqual(1.0);
			});

			it('should never go below 0.1 confidence', () => {
				const longText = 'A'.repeat(100);
				const result = service.parseText(`${longText} is ${longText}`);
				expect(result?.confidence).toBeGreaterThanOrEqual(0.1);
			});
		});
	});

	describe('validateClaim', () => {
		describe('valid claims', () => {
			it('should pass for valid claim text', () => {
				const validation = service.validateClaim(
					'Bitcoin is a cryptocurrency'
				);
				expect(validation.isValid).toBe(true);
				expect(validation.errors).toHaveLength(0);
			});

			it('should pass for claims with 3+ words', () => {
				const validation = service.validateClaim('Bitcoin is great');
				expect(validation.isValid).toBe(true);
			});
		});

		describe('invalid claims - errors', () => {
			it('should fail for empty text', () => {
				const validation = service.validateClaim('');
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain('Text is empty');
			});

			it('should fail for whitespace only', () => {
				const validation = service.validateClaim('   ');
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain('Text is empty');
			});

			it('should fail for text with less than 3 words', () => {
				const validation = service.validateClaim('Bitcoin rocks');
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'Text is too short (minimum 3 words)'
				);
			});

			it('should fail for questions', () => {
				const validation = service.validateClaim(
					'Is Bitcoin a cryptocurrency?'
				);
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'Questions cannot be claims'
				);
			});

			it('should fail for first-person opinions with "I think"', () => {
				const validation = service.validateClaim(
					'I think Bitcoin is great'
				);
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'First-person opinions are subjective'
				);
			});

			it('should fail for first-person opinions with "I believe"', () => {
				const validation = service.validateClaim(
					'I believe in Bitcoin'
				);
				expect(validation.isValid).toBe(false);
				expect(validation.errors).toContain(
					'First-person opinions are subjective'
				);
			});

			it('should fail for other first-person opinion words', () => {
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
			it('should warn for hedged statements with "might"', () => {
				const validation = service.validateClaim(
					'Bitcoin might be good'
				);
				expect(validation.isValid).toBe(true);
				expect(validation.warnings).toContain(
					'Hedged statements lack certainty'
				);
			});

			it('should warn for hedged statements with various hedging words', () => {
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

			it('should warn for very long text', () => {
				const longText = 'A'.repeat(201) + ' is test text here';
				const validation = service.validateClaim(longText);
				expect(validation.isValid).toBe(true);
				expect(validation.warnings).toContain(
					'Text is very long, consider shortening'
				);
			});

			it('should not warn for text under 200 characters', () => {
				const validation = service.validateClaim(
					'Bitcoin is a cryptocurrency'
				);
				expect(validation.warnings).toHaveLength(0);
			});
		});

		describe('edge cases', () => {
			it('should handle multiple errors', () => {
				const validation = service.validateClaim('Is it?');
				expect(validation.isValid).toBe(false);
				expect(validation.errors.length).toBeGreaterThan(1);
			});

			it('should handle both errors and warnings', () => {
				const validation = service.validateClaim('Test?');
				expect(validation.isValid).toBe(false);
				expect(validation.errors.length).toBeGreaterThan(0);
			});

			it('should trim whitespace before validation', () => {
				const validation = service.validateClaim(
					'   Bitcoin is cryptocurrency   '
				);
				expect(validation.isValid).toBe(true);
			});

			it('should be case-insensitive for first-person checks', () => {
				const validation = service.validateClaim(
					'I THINK this is true'
				);
				expect(validation.isValid).toBe(false);
			});

			it('should be case-insensitive for hedging checks', () => {
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
			const result = newService.parseText('Bitcoin is cryptocurrency');
			expect(result).not.toBeNull();
		});

		it('should not throw on cleanup', () => {
			expect(() => service.cleanup()).not.toThrow();
		});

		it('should work after cleanup (stateless)', () => {
			service.cleanup();
			const result = service.parseText('Bitcoin is cryptocurrency');
			expect(result).not.toBeNull();
		});
	});

	describe('pattern priority', () => {
		it('should match more specific patterns first', () => {
			// "is-a" is more specific than "is"
			const result = service.parseText('Bitcoin is a cryptocurrency');
			expect(result?.pattern).toBe('is-a');
		});

		it('should fallback to less specific patterns', () => {
			const result = service.parseText('Bitcoin is cryptocurrency');
			expect(result?.pattern).toBe('is');
		});
	});

	describe('real-world examples', () => {
		it('should parse blockchain-related claims', () => {
			const examples = [
				'Ethereum is a smart contract platform',
				'Bitcoin uses proof of work consensus',
				'Cardano implements Ouroboros protocol',
				'Solana founded by Anatoly Yakovenko',
				'Web3 enables decentralization',
			];

			examples.forEach((example) => {
				const result = service.parseText(example);
				expect(result).not.toBeNull();
				expect(result?.subject).toBeTruthy();
				expect(result?.predicate).toBeTruthy();
				expect(result?.object).toBeTruthy();
			});
		});

		it('should handle technical terminology', () => {
			const result = service.parseText(
				'Zero-knowledge proof is a cryptographic method'
			);
			expect(result).not.toBeNull();
			expect(result?.subject).toContain('Zero-knowledge');
		});
	});
});
