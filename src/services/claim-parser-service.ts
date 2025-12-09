/**
 * Claim Parser Service
 * Stateless service for parsing text into triples using regex heuristics or LLM
 */

import type IntuitionPlugin from '../main';
import { BaseService } from './base-service';
import { LLMService } from './llm-service';
import type { ExtractedClaimLLM } from '../types/llm';
import {
	TripleSuggestion,
	ExtractionPatternDef,
	ClaimValidation,
} from '../types';

export class ClaimParserService extends BaseService {
	private patterns: ExtractionPatternDef[] = [];
	private llmService: LLMService;

	constructor(plugin: IntuitionPlugin) {
		super(plugin);
		this.llmService = plugin.llmService;
	}

	/**
	 * Initialize the service and setup extraction patterns
	 */
	async initialize(): Promise<void> {
		this.patterns = this.initializePatterns();
	}

	/**
	 * Cleanup service resources (stateless service, no cleanup needed)
	 */
	cleanup(): void {
		// Stateless service, nothing to clean up
	}

	/**
	 * Extract triple from text using LLM (if available) or regex fallback
	 * @param text - The text to parse into a triple
	 * @returns A triple suggestion with confidence score, or null if no pattern matches
	 */
	async extractTriple(text: string): Promise<TripleSuggestion | null> {
		// Clean the text first
		const cleaned = text
			.replace(/[.!?]+$/, '')
			.replace(/\s+/g, ' ')
			.trim();

		// Try LLM first if available and enabled
		if (
			this.llmService?.isAvailable() &&
			this.plugin.settings.llm.features.claimExtraction
		) {
			try {
				const llmResults = await this.llmService.extractClaims(
					cleaned
				);
				if (llmResults.length > 0) {
					return this.convertLLMResult(llmResults[0]);
				}
			} catch (error) {
				// Silent fallback - LLM failures should not block regex
				console.debug(
					'LLM extraction failed, falling back to regex:',
					error
				);
			}
		}

		// Fall back to regex patterns
		return this.extractTripleRegex(cleaned);
	}

	/**
	 * Convert LLM result to TripleSuggestion format
	 */
	private convertLLMResult(
		llmClaim: ExtractedClaimLLM
	): TripleSuggestion {
		// Validate that LLM returned non-empty components
		if (
			!llmClaim.subject.text?.trim() ||
			!llmClaim.predicate.normalized?.trim() ||
			!llmClaim.object.text?.trim()
		) {
			throw new Error('LLM returned empty or invalid components');
		}

		return {
			subject: llmClaim.subject.text,
			predicate: llmClaim.predicate.normalized,
			object: llmClaim.object.text,
			confidence: llmClaim.confidence,
			pattern: 'llm',
			llmMetadata: {
				subjectType: llmClaim.subject.type,
				subjectDisambiguation: llmClaim.subject.disambiguation,
				subjectConfidence: llmClaim.subject.confidence,
				objectType: llmClaim.object.type,
				objectDisambiguation: llmClaim.object.disambiguation,
				objectConfidence: llmClaim.object.confidence,
				predicateAlternatives: llmClaim.predicate.alternatives,
				reasoning: llmClaim.reasoning,
				suggestedImprovement: llmClaim.suggestedImprovement,
				warnings: llmClaim.warnings,
			},
		};
	}

	/**
	 * Extract triple using regex patterns (fallback when LLM unavailable)
	 */
	private extractTripleRegex(cleaned: string): TripleSuggestion | null {
		// Try each pattern
		for (const pattern of this.patterns) {
			const match = cleaned.match(pattern.regex);
			if (match) {
				const suggestion = this.extractFromMatch(match, pattern);
				if (suggestion) {
					return suggestion;
				}
			}
		}

		return null;
	}

	/**
	 * Validate if text is suitable for a claim
	 * @param text - The text to validate
	 * @returns Validation result with errors and warnings
	 */
	validateClaim(text: string): ClaimValidation {
		const errors: string[] = [];
		const warnings: string[] = [];

		const trimmed = text.trim();

		// Check minimum length
		if (trimmed.length === 0) {
			errors.push('Text is empty');
			return { isValid: false, errors, warnings };
		}

		const wordCount = trimmed.split(/\s+/).length;
		if (wordCount < 3) {
			errors.push('Text is too short (minimum 3 words)');
		}

		// Check for questions
		if (trimmed.endsWith('?')) {
			errors.push('Questions cannot be claims');
		}

		// Check for first-person opinions
		if (/^I\s+(think|believe|feel|guess|suppose)/i.test(trimmed)) {
			errors.push('First-person opinions are subjective');
		}

		// Check for hedged statements
		if (/\b(might|could|maybe|possibly|perhaps|probably)\b/i.test(trimmed)) {
			warnings.push('Hedged statements lack certainty');
		}

		// Check for very long text
		if (trimmed.length > 200) {
			warnings.push('Text is very long, consider shortening');
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Initialize extraction patterns (ordered by specificity)
	 */
	private initializePatterns(): ExtractionPatternDef[] {
		return [
			// "X is a Y" / "X is an Y"
			{
				name: 'is-a',
				regex: /^(.+?)\s+is\s+(?:a|an)\s+(.+)$/i,
				confidence: 0.9,
				description: 'X is a Y',
			},
			// "X is Y"
			{
				name: 'is',
				regex: /^(.+?)\s+is\s+(.+)$/i,
				confidence: 0.85,
				description: 'X is Y',
			},
			// "X has Y"
			{
				name: 'has',
				regex: /^(.+?)\s+has\s+(.+)$/i,
				confidence: 0.85,
				description: 'X has Y',
			},
			// "X uses Y"
			{
				name: 'uses',
				regex: /^(.+?)\s+uses\s+(.+)$/i,
				confidence: 0.85,
				description: 'X uses Y',
			},
			// "X created by Y" / "X founded by Y" (passive voice)
			{
				name: 'passive',
				regex: /^(.+?)\s+(created|founded|built|made|developed|invented)\s+by\s+(.+)$/i,
				confidence: 0.8,
				description: 'X created by Y',
			},
			// "X [verb] Y" (generic verb)
			{
				name: 'verb',
				regex: /^(.+?)\s+(enables|provides|supports|requires|implements|extends|includes|contains)\s+(.+)$/i,
				confidence: 0.7,
				description: 'X verb Y',
			},
		];
	}

	/**
	 * Extract triple from regex match
	 */
	private extractFromMatch(
		match: RegExpMatchArray,
		pattern: ExtractionPatternDef
	): TripleSuggestion | null {
		try {
			let subject: string;
			let predicate: string;
			let object: string;

			// Handle different pattern types
			switch (pattern.name) {
				case 'is-a':
				case 'is':
					subject = this.cleanComponent(match[1]);
					predicate = 'is';
					object = this.cleanComponent(match[2]);
					break;

				case 'has':
					subject = this.cleanComponent(match[1]);
					predicate = 'has';
					object = this.cleanComponent(match[2]);
					break;

				case 'uses':
					subject = this.cleanComponent(match[1]);
					predicate = 'uses';
					object = this.cleanComponent(match[2]);
					break;

				case 'passive':
					// Passive voice: object is in position 1, verb in 2, subject in 3
					subject = this.cleanComponent(match[3]);
					predicate = match[2].toLowerCase();
					object = this.cleanComponent(match[1]);
					break;

				case 'verb':
					subject = this.cleanComponent(match[1]);
					predicate = match[2].toLowerCase();
					object = this.cleanComponent(match[3]);
					break;

				default:
					return null;
			}

			// Validate components
			if (!subject || !predicate || !object) {
				return null;
			}

			// Calculate confidence
			const confidence = this.calculateConfidence(
				subject,
				predicate,
				object,
				pattern.confidence
			);

			return {
				subject,
				predicate,
				object,
				confidence,
				pattern: pattern.name,
			};
		} catch (error) {
			// Unexpected error during extraction - log for debugging
			console.error('Error extracting triple from match:', error);
			return null;
		}
	}

	/**
	 * Clean and normalize a component
	 */
	private cleanComponent(text: string): string {
		return text
			.trim()
			.replace(/^(the|a|an)\s+/i, '') // Remove leading articles
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();
	}

	/**
	 * Calculate final confidence based on component characteristics
	 */
	private calculateConfidence(
		subject: string,
		predicate: string,
		object: string,
		baseConfidence: number
	): number {
		let confidence = baseConfidence;

		// Boost for proper nouns (capitalized)
		if (/^[A-Z]/.test(subject)) confidence += 0.05;
		if (/^[A-Z]/.test(object)) confidence += 0.05;

		// Boost for short, clear predicates
		if (predicate.length < 15) confidence += 0.05;

		// Penalty for very long components
		if (subject.length > 50) confidence -= 0.15;
		if (object.length > 50) confidence -= 0.15;

		// Penalty for single word subjects/objects (usually need more context)
		if (subject.split(/\s+/).length === 1) confidence -= 0.1;
		if (object.split(/\s+/).length === 1) confidence -= 0.1;

		return Math.max(0.1, Math.min(1, confidence));
	}
}
