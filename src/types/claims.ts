/**
 * Claim-related types for triple structuring and validation
 */

import { AtomReference } from './search';
import { TripleData, ConsensusData } from './intuition';

/**
 * Status of a claim in the structuring process
 */
export enum ClaimStatus {
	DRAFT = 'draft', // Being edited
	VALIDATING = 'validating', // Checking if exists
	EXISTS = 'exists', // Found existing triple
	NEW = 'new', // Ready to create
	INVALID = 'invalid', // Invalid structure
}

/**
 * Draft claim being structured
 */
export interface ClaimDraft {
	originalText: string; // Selected text from editor
	subject: AtomReference | null;
	predicate: AtomReference | null;
	object: AtomReference | null;
	status: ClaimStatus;
	existingTriple?: TripleData; // If claim exists
	consensus?: ConsensusData; // If claim exists
	errors: string[]; // Validation errors
}

/**
 * Suggested triple structure from text parsing
 */
export interface TripleSuggestion {
	subject: string;
	predicate: string;
	object: string;
	confidence: number; // 0-1, how confident the parser is
	pattern: string; // Which pattern was matched
}

/**
 * Regex pattern for extracting triples
 */
export interface ExtractionPattern {
	name: string;
	regex: RegExp;
	confidence: number; // Base confidence for this pattern
	description: string; // What this pattern matches
}

/**
 * Validation result for claim structure
 */
export interface ClaimValidation {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}
