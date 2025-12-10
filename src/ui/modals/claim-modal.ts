/**
 * Claim Modal
 * Main modal for structuring claims as triples
 */

import { App, Modal } from 'obsidian';
import type IntuitionPlugin from '../../main';
import { AtomSearchInput } from '../components/atom-search-input';
import { StakeModal } from './stake-modal';
import {
	ClaimDraft,
	ClaimStatus,
	AtomReference,
	TripleData,
	TripleSuggestion,
} from '../../types';

export class ClaimModal extends Modal {
	private static readonly MIN_AUTO_SUGGESTION_CONFIDENCE = 0.5;
	private static readonly EXTRACTION_TIMEOUT_MS = 10000;

	private plugin: IntuitionPlugin;
	private selectedText: string;

	private draft: ClaimDraft;

	// UI Elements
	private originalTextEl: HTMLElement;
	private tripleInputsEl: HTMLElement;
	private subjectSearch: AtomSearchInput;
	private predicateSearch: AtomSearchInput;
	private objectSearch: AtomSearchInput;
	private statusEl: HTMLElement;
	private consensusEl: HTMLElement;
	private validationEl: HTMLElement;
	private actionsEl: HTMLElement;
	private submitButton: HTMLButtonElement;
	private cancelButton: HTMLButtonElement;

	// LLM-related
	private llmMetadataEl: HTMLElement | null = null;

	// Loading state
	private isExtracting = false;
	private extractionTimeout: NodeJS.Timeout | null = null;
	private loadingIndicatorEl: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: IntuitionPlugin,
		selectedText: string,
		_filePath: string
	) {
		super(app);
		this.plugin = plugin;
		this.selectedText = selectedText;

		// Initialize draft
		this.draft = {
			originalText: selectedText,
			subject: null,
			predicate: null,
			object: null,
			status: ClaimStatus.DRAFT,
			errors: [],
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('intuition-claim-modal');

		// Header
		contentEl.createEl('h2', { text: 'Structure Claim for Intuition' });

		// Original text section
		this.originalTextEl = contentEl.createDiv({
			cls: 'claim-original-text',
		});
		this.renderOriginalText();

		// Triple inputs section
		this.tripleInputsEl = contentEl.createDiv({
			cls: 'claim-triple-inputs',
		});
		this.renderTripleInputs();

		// Status section
		this.statusEl = contentEl.createDiv({ cls: 'claim-status-section' });
		this.renderStatus();

		// Consensus section
		this.consensusEl = contentEl.createDiv({
			cls: 'claim-consensus-section',
		});

		// Validation section
		this.validationEl = contentEl.createDiv({
			cls: 'claim-validation-errors',
		});

		// Actions section
		this.actionsEl = contentEl.createDiv({ cls: 'claim-actions' });
		this.renderActions();

		// Auto-extract triple from text (fire and forget - don't block modal)
		this.autoExtract().catch(error => {
			console.debug('Auto-extraction failed:', error);
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// Clear loading indicator
		this.hideLoadingIndicator();

		// Cleanup search components
		if (this.subjectSearch) {
			this.subjectSearch.destroy();
		}
		if (this.predicateSearch) {
			this.predicateSearch.destroy();
		}
		if (this.objectSearch) {
			this.objectSearch.destroy();
		}
	}

	/**
	 * Render the original text display
	 */
	private renderOriginalText(): void {
		this.originalTextEl.empty();

		const label = this.originalTextEl.createEl('label', {
			text: 'Selected Text',
		});
		label.style.display = 'block';
		label.style.marginBottom = '8px';
		label.style.fontWeight = '500';

		const textBox = this.originalTextEl.createDiv();
		textBox.createEl('p', { text: `"${this.selectedText}"` });

		// Show validation warnings
		const validation =
			this.plugin.claimParserService.validateClaim(this.selectedText);
		if (validation.warnings.length > 0) {
			const warning = this.originalTextEl.createDiv({
				cls: 'claim-warning',
			});
			warning.createSpan({
				text: '⚠️ ' + validation.warnings.join(', '),
			});
		}
	}

	/**
	 * Render the triple input fields
	 */
	private renderTripleInputs(): void {
		this.tripleInputsEl.empty();

		const header = this.tripleInputsEl.createEl('h3', {
			text: 'Structure as Triple',
		});
		header.style.marginBottom = '16px';

		// Subject field
		const subjectField = this.tripleInputsEl.createDiv({
			cls: 'claim-field',
		});
		subjectField.createEl('label', { text: 'Subject' });
		const subjectContainer = subjectField.createDiv();
		this.subjectSearch = new AtomSearchInput(
			subjectContainer,
			this.plugin.intuitionService,
			(ref) => this.handleAtomSelection('subject', ref),
			{ placeholder: 'Search or create subject...', allowCreate: true }
		);

		// Predicate field
		const predicateField = this.tripleInputsEl.createDiv({
			cls: 'claim-field',
		});
		predicateField.createEl('label', { text: 'Predicate' });
		const predicateContainer = predicateField.createDiv();
		this.predicateSearch = new AtomSearchInput(
			predicateContainer,
			this.plugin.intuitionService,
			(ref) => this.handleAtomSelection('predicate', ref),
			{
				placeholder: 'Search or create predicate...',
				allowCreate: true,
			}
		);

		// Object field
		const objectField = this.tripleInputsEl.createDiv({
			cls: 'claim-field',
		});
		objectField.createEl('label', { text: 'Object' });
		const objectContainer = objectField.createDiv();
		this.objectSearch = new AtomSearchInput(
			objectContainer,
			this.plugin.intuitionService,
			(ref) => this.handleAtomSelection('object', ref),
			{ placeholder: 'Search or create object...', allowCreate: true }
		);
	}

	/**
	 * Render the claim status
	 */
	private renderStatus(): void {
		this.statusEl.empty();

		const statusBox = this.statusEl.createDiv({ cls: 'claim-status' });

		switch (this.draft.status) {
			case ClaimStatus.DRAFT:
				statusBox.addClass('draft');
				statusBox.createSpan({ text: '✏️ Fill in all fields' });
				break;

			case ClaimStatus.VALIDATING:
				statusBox.addClass('validating');
				statusBox.createSpan({
					text: '🔍 Checking knowledge graph...',
				});
				break;

			case ClaimStatus.EXISTS:
				statusBox.addClass('exists');
				statusBox.createSpan({
					text: '✓ This claim exists in the knowledge graph',
				});
				break;

			case ClaimStatus.NEW: {
				statusBox.addClass('new');
				statusBox.createSpan({
					text: '○ This claim does not exist yet',
				});

				// Show which atoms will be created
				const newAtoms: string[] = [];
				if (this.draft.subject?.type === 'new') newAtoms.push('subject');
				if (this.draft.predicate?.type === 'new')
					newAtoms.push('predicate');
				if (this.draft.object?.type === 'new') newAtoms.push('object');

				if (newAtoms.length > 0) {
					const info = statusBox.createEl('div');
					info.style.marginTop = '4px';
					info.style.fontSize = '12px';
					info.createSpan({
						text: `New atoms will be created: ${newAtoms.join(', ')}`,
					});
				}
				break;
			}

			case ClaimStatus.INVALID:
				statusBox.addClass('invalid');
				statusBox.createSpan({ text: '✗ Invalid claim structure' });
				break;
		}
	}

	/**
	 * Render consensus display
	 */
	private renderConsensus(): void {
		this.consensusEl.empty();

		// Only show if claim exists
		if (this.draft.status !== ClaimStatus.EXISTS) {
			return;
		}

		// If no counter-claim yet
		if (
			this.draft.existingTriple &&
			!this.draft.existingTriple.counterVaultId
		) {
			const notice = this.consensusEl.createDiv({
				cls: 'consensus-notice',
			});
			notice.style.padding = '12px';
			notice.style.marginTop = '12px';
			notice.style.background = 'var(--background-secondary)';
			notice.style.borderRadius = '4px';
			notice.createSpan({
				text: '📊 No counter-claims yet (100% FOR)',
			});
			return;
		}

		// Show consensus if available
		if (!this.draft.consensus) {
			return;
		}

		const { consensusRatio, forAssets, againstAssets } =
			this.draft.consensus;

		const header = this.consensusEl.createDiv({
			cls: 'consensus-header',
		});
		header.style.marginTop = '16px';
		header.createEl('h4', { text: 'Current Consensus' });

		// Consensus bar
		const forPercentage = Math.round(consensusRatio * 100);
		const againstPercentage = 100 - forPercentage;

		const barContainer = this.consensusEl.createDiv({
			cls: 'consensus-bar-container',
		});

		if (forPercentage > 0) {
			const forBar = barContainer.createDiv({
				cls: 'consensus-bar for',
			});
			forBar.style.width = `${forPercentage}%`;
			forBar.createSpan({ text: `${forPercentage}% FOR` });
		}

		if (againstPercentage > 0) {
			const againstBar = barContainer.createDiv({
				cls: 'consensus-bar against',
			});
			againstBar.style.width = `${againstPercentage}%`;
			againstBar.createSpan({ text: `${againstPercentage}% AGAINST` });
		}

		// Stats
		const stats = this.consensusEl.createDiv({ cls: 'consensus-stats' });
		// Handle BigInt addition properly
		const totalAssets =
			typeof forAssets === 'bigint' && typeof againstAssets === 'bigint'
				? forAssets + againstAssets
				: BigInt(forAssets) + BigInt(againstAssets);
		const totalStaked = (Number(totalAssets) / 1e18).toFixed(4);
		stats.createSpan({ text: `Total staked: ${totalStaked} TRUST` });
	}

	/**
	 * Render validation errors
	 */
	private renderValidation(): void {
		this.validationEl.empty();

		if (this.draft.errors.length === 0) {
			return;
		}

		this.draft.errors.forEach((error) => {
			const errorEl = this.validationEl.createDiv({
				cls: 'claim-validation-error',
			});
			errorEl.createSpan({ text: `• ${error}` });
		});
	}

	/**
	 * Render action buttons
	 */
	private renderActions(): void {
		this.actionsEl.empty();

		// Cancel button
		this.cancelButton = this.actionsEl.createEl('button', {
			text: 'Cancel',
		});
		this.cancelButton.addEventListener('click', () => this.close());

		// Submit button
		this.submitButton = this.actionsEl.createEl('button', {
			text: this.getSubmitButtonText(),
			cls: 'mod-cta',
		});
		this.submitButton.disabled = !this.canSubmit();
		this.submitButton.addEventListener('click', () =>
			this.handleSubmit()
		);
	}

	/**
	 * Get the submit button text based on claim status
	 */
	private getSubmitButtonText(): string {
		if (this.draft.status === ClaimStatus.EXISTS) {
			return 'Add Stake';
		}
		return 'Create & Stake';
	}

	/**
	 * Check if claim can be submitted
	 */
	private canSubmit(): boolean {
		return (
			(this.draft.status === ClaimStatus.NEW ||
				this.draft.status === ClaimStatus.EXISTS) &&
			this.draft.errors.length === 0
		);
	}

	/**
	 * Handle atom selection
	 */
	private handleAtomSelection(
		field: 'subject' | 'predicate' | 'object',
		ref: AtomReference | null
	): void {
		this.draft[field] = ref;
		this.validateDraft();
		this.checkIfClaimExists();
	}

	/**
	 * Validate the draft
	 */
	private validateDraft(): void {
		const errors: string[] = [];

		// Check all fields are filled
		if (!this.draft.subject) {
			errors.push('Subject is required');
		}
		if (!this.draft.predicate) {
			errors.push('Predicate is required');
		}
		if (!this.draft.object) {
			errors.push('Object is required');
		}

		this.draft.errors = errors;

		// Update status
		if (errors.length > 0) {
			if (
				this.draft.status !== ClaimStatus.VALIDATING &&
				(this.draft.subject || this.draft.predicate || this.draft.object)
			) {
				this.draft.status = ClaimStatus.DRAFT;
			}
		}

		this.renderValidation();
		this.renderActions();
	}

	/**
	 * Check if claim exists in knowledge graph
	 */
	private async checkIfClaimExists(): Promise<void> {
		const { subject, predicate, object } = this.draft;

		// Only check if all are filled and all are existing atoms
		if (
			!subject ||
			!predicate ||
			!object ||
			subject.type !== 'existing' ||
			predicate.type !== 'existing' ||
			object.type !== 'existing'
		) {
			// If all are filled but at least one is new, it's a new claim
			if (subject && predicate && object) {
				this.draft.status = ClaimStatus.NEW;
				this.draft.existingTriple = undefined;
				this.draft.consensus = undefined;
			} else {
				this.draft.status = ClaimStatus.DRAFT;
			}
			this.renderStatus();
			this.renderConsensus();
			return;
		}

		// Set validating status
		this.draft.status = ClaimStatus.VALIDATING;
		this.renderStatus();

		// At this point, all terms are 'existing' type and have termId
		const subjectId = subject.termId;
		const predicateId = predicate.termId;
		const objectId = object.termId;

		if (!subjectId || !predicateId || !objectId) {
			// This should not happen due to checks above, but handle defensively
			this.draft.status = ClaimStatus.DRAFT;
			this.renderStatus();
			return;
		}

		try {
			const triple = await this.plugin.intuitionService.findTriple(
				subjectId,
				predicateId,
				objectId
			);

			if (triple) {
				this.draft.existingTriple = triple;
				this.draft.status = ClaimStatus.EXISTS;
				await this.loadConsensus(triple);
			} else {
				this.draft.existingTriple = undefined;
				this.draft.consensus = undefined;
				this.draft.status = ClaimStatus.NEW;
			}
		} catch (error) {
			this.plugin.noticeManager.error(
				'Failed to check claim existence'
			);
			// Keep status as DRAFT to allow retry, don't mark as INVALID
			this.draft.status = ClaimStatus.DRAFT;
		}

		this.renderStatus();
		this.renderConsensus();
		this.renderActions();
	}

	/**
	 * Load consensus data for existing triple
	 */
	private async loadConsensus(triple: TripleData): Promise<void> {
		// If no counter-claim exists yet, no consensus to load
		if (!triple.counterVaultId) {
			this.draft.consensus = undefined;
			return;
		}

		try {
			const consensus =
				await this.plugin.intuitionService.calculateConsensus(
					triple.vaultId,
					triple.counterVaultId
				);
			this.draft.consensus = consensus;
		} catch (error) {
			this.plugin.noticeManager.error('Failed to load consensus data');
			this.draft.consensus = undefined;
		}
	}

	/**
	 * Render loading indicator for extraction
	 */
	private renderLoadingIndicator(type: 'llm' | 'regex' = 'llm'): void {
		// Clear existing indicator
		if (this.loadingIndicatorEl) {
			this.loadingIndicatorEl.remove();
		}

		// Insert loading indicator after original text
		const loadingDiv = document.createElement('div');
		loadingDiv.className = 'claim-extraction-loading';

		this.loadingIndicatorEl = this.originalTextEl.insertAdjacentElement(
			'afterend',
			loadingDiv
		) as HTMLElement;

		// Now add content to the positioned element
		this.loadingIndicatorEl.createSpan({
			cls: 'loading-spinner',
			attr: {
				role: 'status',
				'aria-label': 'Loading',
			},
		});

		const text =
			type === 'llm'
				? '✨ AI analyzing your claim...'
				: '🔍 Analyzing text patterns...';

		this.loadingIndicatorEl.createSpan({
			text: text,
			cls: 'loading-text',
			attr: {
				'aria-live': 'polite',
			},
		});
	}

	/**
	 * Hide loading indicator
	 */
	private hideLoadingIndicator(): void {
		if (this.loadingIndicatorEl) {
			this.loadingIndicatorEl.remove();
			this.loadingIndicatorEl = null;
		}

		if (this.extractionTimeout) {
			clearTimeout(this.extractionTimeout);
			this.extractionTimeout = null;
		}

		this.isExtracting = false;
	}

	/**
	 * Auto-extract triple from text
	 */
	private async autoExtract(): Promise<void> {
		// Prevent duplicate extractions
		if (this.isExtracting) {
			return;
		}

		this.isExtracting = true;

		// Determine if LLM will be used
		const willUseLLM =
			this.plugin.settings.llm.enabled &&
			this.plugin.llmService.isAvailable();

		// Show loading indicator
		this.renderLoadingIndicator(willUseLLM ? 'llm' : 'regex');

		// Set timeout to hide indicator if extraction takes too long
		this.extractionTimeout = setTimeout(() => {
			this.hideLoadingIndicator();
			this.plugin.noticeManager.warning(
				'Extraction is taking longer than expected'
			);
		}, ClaimModal.EXTRACTION_TIMEOUT_MS);

		try {
			const suggestion =
				await this.plugin.claimParserService.extractTriple(
					this.selectedText
				);

			// Hide loading BEFORE showing results
			this.hideLoadingIndicator();

			if (
				!suggestion ||
				suggestion.confidence <
					ClaimModal.MIN_AUTO_SUGGESTION_CONFIDENCE
			) {
				return;
			}

			// Show notice with suggested structure
			const confidencePercent = Math.round(
				suggestion.confidence * 100
			);
			const source = suggestion.pattern === 'llm' ? 'AI' : 'Pattern';

			this.plugin.noticeManager.info(
				`${source} Suggestion (${confidencePercent}% confidence): ${suggestion.subject} → ${suggestion.predicate} → ${suggestion.object}`
			);

			// If LLM-powered, show enhanced UI
			if (suggestion.pattern === 'llm' && suggestion.llmMetadata) {
				this.renderLLMMetadata(suggestion);
			}
		} catch (error) {
			console.debug('Auto-extraction failed:', error);
			this.hideLoadingIndicator();
		}
	}

	/**
	 * Parse suggestion string into triple components using regex patterns
	 */
	private parseSuggestionRegex(
		suggestion: string,
		originalPredicate: string
	): { subject: string; predicate: string; object: string } | null {
		// Common predicates to try
		const predicates = [
			'created', 'developed', 'founded', 'built', 'invented',
			'is a', 'is an', 'is',
			'has', 'uses', 'contains',
			'launched', 'released', 'published'
		];

		// Try original predicate first
		predicates.unshift(originalPredicate);

		for (const pred of predicates) {
			// Escape special regex characters in predicate
			const escapedPred = pred.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const pattern = new RegExp(`^(.+?)\\s+${escapedPred}\\s+(.+)$`, 'i');
			const match = suggestion.match(pattern);

			if (match && match[1].trim() && match[2].trim()) {
				// Validate that we have reasonable subject and object
				const subject = match[1].trim();
				const object = match[2].trim();

				// Ensure subject and object are not empty and don't contain the entire suggestion
				if (subject.length > 0 && object.length > 0 &&
					subject !== suggestion && object !== suggestion) {
					return {
						subject,
						predicate: pred,
						object
					};
				}
			}
		}

		return null;
	}

	/**
	 * Parse suggestion string into triple components (hybrid approach)
	 */
	private async parseSuggestion(
		suggestion: string,
		originalPredicate: string
	): Promise<{ subject: string; predicate: string; object: string } | null> {
		// Try regex parsing first (fast)
		const regexResult = this.parseSuggestionRegex(suggestion, originalPredicate);
		if (regexResult) {
			return regexResult;
		}

		// Fallback: Re-extract with LLM if available
		if (this.plugin.settings.llm.enabled && this.plugin.llmService.isAvailable()) {
			try {
				const extracted = await this.plugin.llmService.extractClaims(suggestion);
				if (extracted.length > 0) {
					const claim = extracted[0];
					return {
						subject: claim.subject.text,
						predicate: claim.predicate.text,
						object: claim.object.text
					};
				}
				// LLM returned no claims
				console.debug('LLM re-extraction returned no claims');
			} catch (error) {
				console.debug('LLM re-extraction failed:', error);
			}
		}

		// Could not parse via regex or LLM
		return null;
	}

	/**
	 * Apply LLM's suggested improvement to all fields
	 */
	private async applySuggestion(suggestion: TripleSuggestion): Promise<void> {
		if (!suggestion.llmMetadata?.suggestedImprovement) {
			return;
		}

		// Show loading state on button
		const applyButton = this.llmMetadataEl?.querySelector('.apply-suggestion-btn') as HTMLButtonElement;
		if (applyButton) {
			applyButton.disabled = true;
			applyButton.setText('Applying...');
		}

		try {
			// Parse suggestion into components
			const components = await this.parseSuggestion(
				suggestion.llmMetadata.suggestedImprovement,
				suggestion.predicate
			);

			if (!components) {
				throw new Error('Could not parse suggestion into subject-predicate-object format. Please edit the fields manually.');
			}

			// Apply to all three fields
			await this.subjectSearch.setValue(components.subject);
			await this.predicateSearch.setValue(components.predicate);
			await this.objectSearch.setValue(components.object);

			// Hide suggestion UI (it's been applied)
			if (this.llmMetadataEl) {
				const improvementEl = this.llmMetadataEl.querySelector('.llm-improvement');
				improvementEl?.remove();
			}

			// Trigger validation and existence check
			this.validateDraft();
			await this.checkIfClaimExists();

			this.plugin.noticeManager.success('Suggestion applied successfully');

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to apply suggestion';
			this.plugin.noticeManager.error(errorMessage);
			console.error('Apply suggestion error:', error);

			// Reset button
			if (applyButton) {
				applyButton.disabled = false;
				applyButton.setText('Apply Suggestion');
			}
		}
	}

	/**
	 * Render LLM confidence and metadata UI
	 */
	private renderLLMMetadata(suggestion: TripleSuggestion): void {
		if (!suggestion.llmMetadata) return;

		const metadata = suggestion.llmMetadata;

		// Clear existing metadata display
		if (this.llmMetadataEl) {
			this.llmMetadataEl.remove();
		}

		// Create metadata section after triple inputs
		this.llmMetadataEl = this.tripleInputsEl.createDiv({
			cls: 'claim-llm-metadata',
		});

		// Confidence badge
		const badgeEl = this.llmMetadataEl.createDiv({
			cls: 'claim-llm-badge',
		});
		const avgConfidence =
			(metadata.subjectConfidence + metadata.objectConfidence) / 2;
		const confidenceClass =
			avgConfidence >= 0.8
				? 'high-confidence'
				: avgConfidence >= 0.5
				? 'medium-confidence'
				: 'low-confidence';
		badgeEl.addClass(confidenceClass);
		badgeEl.setText(
			`AI Extracted (${Math.round(suggestion.confidence * 100)}% confidence)`
		);

		// Reasoning
		if (metadata.reasoning) {
			const reasoningEl = this.llmMetadataEl.createDiv({
				cls: 'llm-reasoning',
			});
			reasoningEl.createEl('strong', {
				text: 'Why this extraction:',
			});
			reasoningEl.createEl('p', { text: metadata.reasoning });
		}

		// Suggested improvement with Apply button
		if (metadata.suggestedImprovement) {
			const improvementEl = this.llmMetadataEl.createDiv({
				cls: 'llm-improvement',
			});
			improvementEl.createEl('strong', {
				text: 'Suggested improvement:',
			});

			const suggestionText = improvementEl.createEl('p', {
				text: metadata.suggestedImprovement,
			});
			suggestionText.style.marginBottom = '8px';

			// Apply button
			const applyButton = improvementEl.createEl('button', {
				text: 'Apply Suggestion',
				cls: 'apply-suggestion-btn mod-cta',
			});

			applyButton.addEventListener('click', () => {
				this.applySuggestion(suggestion);
			});
		}

		// Warnings
		if (metadata.warnings && metadata.warnings.length > 0) {
			const warningEl = this.llmMetadataEl.createDiv({
				cls: 'claim-llm-warnings',
			});
			warningEl.createEl('strong', { text: 'Warnings:' });
			const warningList = warningEl.createEl('ul');
			for (const warning of metadata.warnings) {
				warningList.createEl('li', { text: warning });
			}
		}

		// Entity types (subtle display)
		const typesEl = this.llmMetadataEl.createDiv({
			cls: 'llm-entity-types',
		});
		typesEl.setText(
			`Types: ${metadata.subjectType} → ${metadata.objectType}`
		);
	}

	/**
	 * Handle submit
	 */
	private handleSubmit(): void {
		if (!this.canSubmit()) {
			return;
		}

		// Open stake modal
		new StakeModal(this.app, this.plugin, this.draft).open();
		this.close();
	}
}
