/**
 * Claim Modal
 * Main modal for structuring claims as triples
 */

import { App, Modal } from 'obsidian';
import type IntuitionPlugin from '../../main';
import { AtomSearchInput } from '../components/atom-search-input';
import {
	ClaimDraft,
	ClaimStatus,
	AtomReference,
	TripleData,
} from '../../types';

export class ClaimModal extends Modal {
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

		// Auto-extract triple from text
		this.autoExtract();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

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

			case ClaimStatus.NEW:
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
		const totalAssets = forAssets + againstAssets;
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

		try {
			const triple = await this.plugin.intuitionService.findTriple(
				subject.termId!,
				predicate.termId!,
				object.termId!
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
			this.draft.status = ClaimStatus.INVALID;
			this.draft.errors.push('Network error checking claim');
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
	 * Auto-extract triple from text
	 */
	private autoExtract(): void {
		const suggestion =
			this.plugin.claimParserService.parseText(this.selectedText);

		if (!suggestion || suggestion.confidence < 0.5) {
			return;
		}

		// Show notice with suggested structure
		const confidencePercent = Math.round(suggestion.confidence * 100);
		this.plugin.noticeManager.info(
			`Suggestion (${confidencePercent}% confidence): ${suggestion.subject} → ${suggestion.predicate} → ${suggestion.object}`
		);
	}

	/**
	 * Handle submit
	 */
	private handleSubmit(): void {
		if (!this.canSubmit()) {
			return;
		}

		// Placeholder for Plan 007 (Stake flow)
		this.plugin.noticeManager.info(
			'Stake flow coming in Plan 007'
		);

		// Log draft for debugging
		console.log('Claim draft:', this.draft);

		// Close modal
		// this.close();
	}
}
