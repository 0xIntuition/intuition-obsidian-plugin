/**
 * Atom Search Input Component
 * Reusable search component with autocomplete, fuzzy matching, and dual search strategy
 */

import {
	AtomReference,
	SearchState,
	AtomSearchConfig,
	DEFAULT_SEARCH_CONFIG,
	AtomData,
	SEARCH_UI_TIMING,
} from '../../types';
import { IntuitionService } from '../../services/intuition-service';
import { debounce, DebouncedFunction } from '../../utils/debounce';
import { mergeSearchResults } from '../../utils/search-helpers';
import { setImageSrc, validateSearchQuery } from '../../utils/helpers';

export class AtomSearchInput {
	private container: HTMLElement;
	private inputEl: HTMLInputElement;
	private dropdownEl: HTMLElement;
	private previewEl: HTMLElement;
	private intuitionService: IntuitionService;
	private config: AtomSearchConfig;
	private state: SearchState;
	private onSelect: (atom: AtomReference | null) => void;
	private debouncedSearch: DebouncedFunction<(query: string) => void>;
	private abortController: AbortController;
	private blurTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private searchAbortController: AbortController | null = null;
	private currentSearchId = 0;

	constructor(
		parent: HTMLElement,
		intuitionService: IntuitionService,
		onSelect: (atom: AtomReference | null) => void,
		config: Partial<AtomSearchConfig> = {}
	) {
		this.intuitionService = intuitionService;
		this.onSelect = onSelect;
		this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
		this.state = {
			query: '',
			isSearching: false,
			results: [],
			selectedIndex: 0,
			error: null,
		};

		this.debouncedSearch = debounce(
			(query: string) => this.performSearch(query),
			this.config.debounceMs
		);

		this.abortController = new AbortController();

		this.container = parent.createDiv({ cls: 'intuition-atom-search' });
		this.render();
	}

	private render(): void {
		// Input field with ARIA attributes for accessibility
		this.inputEl = this.container.createEl('input', {
			cls: 'intuition-atom-search-input',
		});
		this.inputEl.type = 'text';
		this.inputEl.placeholder = this.config.placeholder;
		this.inputEl.setAttribute('role', 'combobox');
		this.inputEl.setAttribute('aria-autocomplete', 'list');
		this.inputEl.setAttribute('aria-expanded', 'false');
		this.inputEl.setAttribute('aria-controls', 'atom-search-dropdown');
		this.inputEl.setAttribute('aria-haspopup', 'listbox');

		// Dropdown for suggestions with ARIA attributes
		this.dropdownEl = this.container.createDiv({
			cls: 'intuition-atom-search-dropdown',
		});
		this.dropdownEl.id = 'atom-search-dropdown';
		this.dropdownEl.setAttribute('role', 'listbox');
		this.dropdownEl.style.display = 'none';

		// Preview for selected atom with ARIA live region
		this.previewEl = this.container.createDiv({
			cls: 'intuition-atom-search-preview',
		});
		this.previewEl.setAttribute('role', 'status');
		this.previewEl.setAttribute('aria-live', 'polite');
		this.previewEl.style.display = 'none';

		// Event listeners
		this.inputEl.addEventListener('input', () => this.handleInput(), {
			signal: this.abortController.signal,
		});
		this.inputEl.addEventListener('keydown', (e) => this.handleKeydown(e), {
			signal: this.abortController.signal,
		});
		this.inputEl.addEventListener('focus', () => this.showDropdown(), {
			signal: this.abortController.signal,
		});
		this.inputEl.addEventListener('blur', () => {
			// Delay to allow click on dropdown
			this.blurTimeoutId = setTimeout(() => {
				this.hideDropdown();
				this.blurTimeoutId = null;
			}, SEARCH_UI_TIMING.BLUR_DELAY_MS);
		}, {
			signal: this.abortController.signal,
		});
	}

	private handleInput(): void {
		const rawQuery = this.inputEl.value;
		const query = validateSearchQuery(
			rawQuery,
			SEARCH_UI_TIMING.MAX_QUERY_LENGTH
		);

		if (!query || query.length < this.config.minQueryLength) {
			this.hideDropdown();
			this.state.query = '';
			return;
		}

		this.state.query = query;
		this.state.isSearching = true;
		this.renderDropdown();
		this.debouncedSearch(query);
	}

	private async performSearch(query: string): Promise<void> {
		// Cancel previous search
		if (this.searchAbortController) {
			this.searchAbortController.abort();
		}

		// Create new abort controller for this search
		this.searchAbortController = new AbortController();
		const searchId = ++this.currentSearchId;

		try {
			// Run both searches in parallel
			const [semanticResults, labelResults] = await Promise.allSettled([
				this.intuitionService.semanticSearchAtoms(
					query,
					this.config.maxResults
				),
				this.intuitionService.searchAtoms({
					label: query,
					limit: this.config.maxResults,
				}),
			]);

			// Check if this search is still current
			if (searchId !== this.currentSearchId) {
				return; // Newer search has started, discard these results
			}

			// Extract successful results
			const semantic =
				semanticResults.status === 'fulfilled'
					? semanticResults.value
					: [];
			const label =
				labelResults.status === 'fulfilled' ? labelResults.value : [];

			// Merge and rank
			const merged = mergeSearchResults(semantic, label, query);

			this.state.results = merged
				.slice(0, this.config.maxResults)
				.map((r) => r.item);
			this.state.selectedIndex = 0;
			this.state.isSearching = false;
			this.state.error = null;
		} catch (error) {
			// Only update state if this is still the current search
			if (searchId === this.currentSearchId) {
				const errorMessage =
					error instanceof Error
						? error.message
						: 'An unexpected error occurred during search';
				this.state.error = errorMessage;
				this.state.isSearching = false;
				this.state.results = [];
			}
		}

		this.renderDropdown();
	}

	private handleKeydown(e: KeyboardEvent): void {
		const totalItems =
			this.state.results.length + (this.config.allowCreate ? 1 : 0);

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				this.state.selectedIndex =
					(this.state.selectedIndex + 1) % totalItems;
				this.renderDropdown();
				break;

			case 'ArrowUp':
				e.preventDefault();
				this.state.selectedIndex =
					(this.state.selectedIndex - 1 + totalItems) % totalItems;
				this.renderDropdown();
				break;

			case 'Enter':
				e.preventDefault();
				this.selectCurrent();
				break;

			case 'Escape':
				this.hideDropdown();
				break;
		}
	}

	private selectCurrent(): void {
		const isCreateNew =
			this.state.selectedIndex === this.state.results.length;

		if (isCreateNew && this.config.allowCreate) {
			this.selectAtom({
				type: 'new',
				label: this.state.query,
				confidence: 1,
			});
		} else if (this.state.results[this.state.selectedIndex]) {
			const atom = this.state.results[this.state.selectedIndex];
			this.selectAtom({
				type: 'existing',
				termId: atom.id,
				label: atom.label,
				atom,
				confidence: 1,
			});
		}
	}

	private selectAtom(ref: AtomReference): void {
		this.inputEl.value = ref.label;
		this.hideDropdown();
		this.showPreview(ref);
		this.onSelect(ref);
	}

	private renderDropdown(): void {
		this.dropdownEl.empty();

		if (this.state.isSearching) {
			this.dropdownEl.createDiv({
				cls: 'intuition-atom-search-loading',
				text: 'Searching...',
			});
			this.showDropdown();
			return;
		}

		if (this.state.error) {
			this.dropdownEl.createDiv({
				cls: 'intuition-atom-search-error',
				text: `Error: ${this.state.error}`,
			});
			this.showDropdown();
			return;
		}

		// Results
		this.state.results.forEach((atom, index) => {
			const item = this.dropdownEl.createDiv({
				cls: `intuition-atom-suggestion ${
					index === this.state.selectedIndex ? 'selected' : ''
				}`,
			});
			item.setAttribute('role', 'option');
			item.setAttribute(
				'aria-selected',
				(index === this.state.selectedIndex).toString()
			);

			// Icon/Emoji/Image
			this.renderAtomImage(item, atom, 'suggestion-icon');

			// Label
			item.createSpan({ cls: 'suggestion-label', text: atom.label });

			// Type badge
			item.createSpan({ cls: 'suggestion-type', text: atom.type });

			// Description (if available from semantic search)
			if (atom.description) {
				item.createDiv({
					cls: 'suggestion-description',
					text: atom.description,
				});
			}

			// Trust indicator (placeholder - vault data would need to be fetched)
			// For now, showing atom ID as indicator
			item.createSpan({
				cls: 'suggestion-trust',
				text: `#${atom.id}`,
			});

			item.addEventListener('click', () => {
				this.selectAtom({
					type: 'existing',
					termId: atom.id,
					label: atom.label,
					atom,
					confidence: 1,
				});
			});
		});

		// "Create new" option
		if (this.config.allowCreate && this.state.query) {
			const createItem = this.dropdownEl.createDiv({
				cls: `intuition-atom-suggestion create-new ${
					this.state.selectedIndex === this.state.results.length
						? 'selected'
						: ''
				}`,
			});
			createItem.setAttribute('role', 'option');
			createItem.setAttribute(
				'aria-selected',
				(this.state.selectedIndex === this.state.results.length).toString()
			);

			createItem.createSpan({ cls: 'suggestion-icon', text: '+' });
			createItem.createSpan({
				cls: 'suggestion-label',
				text: `Create "${this.state.query}"`,
			});

			createItem.addEventListener('click', () => {
				this.selectAtom({
					type: 'new',
					label: this.state.query,
					confidence: 1,
				});
			});
		}

		// Show empty state
		if (this.state.results.length === 0 && !this.config.allowCreate) {
			this.dropdownEl.createDiv({
				cls: 'intuition-atom-search-empty',
				text: 'No results found',
			});
		}

		this.showDropdown();
	}

	private showDropdown(): void {
		if (this.state.query.length >= this.config.minQueryLength) {
			this.dropdownEl.style.display = 'block';
			this.inputEl.setAttribute('aria-expanded', 'true');
		}
	}

	private hideDropdown(): void {
		this.dropdownEl.style.display = 'none';
		this.inputEl.setAttribute('aria-expanded', 'false');
	}

	/**
	 * Renders an atom's icon/emoji/image with XSS protection
	 * @param container - Container element to render into
	 * @param atom - Atom data with image/emoji information
	 * @param className - CSS class for the rendered element
	 */
	private renderAtomImage(
		container: HTMLElement,
		atom: AtomData,
		className: string
	): void {
		if (atom.cachedImage?.url) {
			const img = container.createEl('img', { cls: className });
			setImageSrc(img, atom.cachedImage.url, atom.emoji || undefined);
		} else if (atom.emoji) {
			container.createSpan({ cls: className, text: atom.emoji });
		} else if (atom.image) {
			const img = container.createEl('img', { cls: className });
			setImageSrc(img, atom.image);
		}
	}

	private showPreview(ref: AtomReference): void {
		this.previewEl.empty();

		if (ref.type === 'existing' && ref.atom) {
			const atom = ref.atom;

			const header = this.previewEl.createDiv({ cls: 'preview-header' });

			// Icon
			this.renderAtomImage(header, atom, 'preview-icon');

			header.createSpan({ cls: 'preview-label', text: atom.label });
			header.createSpan({ cls: 'preview-type', text: atom.type });

			// Description
			if (atom.description) {
				this.previewEl.createDiv({
					cls: 'preview-description',
					text: atom.description,
				});
			}

			// Stats
			const stats = this.previewEl.createDiv({ cls: 'preview-stats' });
			stats.createSpan({ text: `ID: ${atom.id}` });

			// Clear button
			const clearBtn = this.previewEl.createEl('button', {
				cls: 'preview-clear',
				text: '×',
			});
			clearBtn.addEventListener('click', () => this.clear());
		} else {
			const newAtom = this.previewEl.createDiv({ cls: 'preview-new' });
			newAtom.createSpan({ cls: 'preview-icon', text: '+' });
			newAtom.createSpan({
				cls: 'preview-label',
				text: `New atom: "${ref.label}"`,
			});

			const clearBtn = this.previewEl.createEl('button', {
				cls: 'preview-clear',
				text: '×',
			});
			clearBtn.addEventListener('click', () => this.clear());
		}

		this.previewEl.style.display = 'flex';
		this.inputEl.style.display = 'none';
	}

	/**
	 * Clear selection and reset component
	 */
	clear(): void {
		this.inputEl.value = '';
		this.state = {
			query: '',
			isSearching: false,
			results: [],
			selectedIndex: 0,
			error: null,
		};
		this.previewEl.style.display = 'none';
		this.inputEl.style.display = 'block';
		this.inputEl.focus();
		this.onSelect(null);
	}

	/**
	 * Set the component value programmatically
	 * Triggers search and auto-selects first match if available
	 * If no match, creates new atom with the label
	 */
	async setValue(label: string): Promise<void> {
		// Set input text
		this.inputEl.value = label;
		this.state.query = label;

		// Trigger search
		await this.performSearch(label);

		// Auto-select first result if available
		if (this.state.results.length > 0) {
			const atom = this.state.results[0];
			this.selectAtom({
				type: 'existing',
				termId: atom.id,
				label: atom.label,
				atom,
				confidence: 1,
			});
		} else if (this.config.allowCreate) {
			// No existing atom, create new one
			this.selectAtom({
				type: 'new',
				label: label,
				confidence: 1,
			});
		}
	}

	/**
	 * Set the component value with an AtomReference
	 */
	setValueFromReference(ref: AtomReference): void {
		this.inputEl.value = ref.label;
		this.showPreview(ref);
	}

	/**
	 * Get the current input value
	 */
	getValue(): string {
		return this.inputEl.value;
	}

	/**
	 * Clean up component resources
	 */
	destroy(): void {
		this.debouncedSearch.cancel();
		if (this.searchAbortController) {
			this.searchAbortController.abort();
			this.searchAbortController = null;
		}
		if (this.blurTimeoutId !== null) {
			clearTimeout(this.blurTimeoutId);
			this.blurTimeoutId = null;
		}
		this.abortController.abort();
		this.container.remove();
	}
}
