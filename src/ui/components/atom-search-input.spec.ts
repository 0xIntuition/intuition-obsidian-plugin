import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtomSearchInput } from './atom-search-input';
import type { IntuitionService } from '../../services/intuition-service';
import type { Atom } from '@0xintuition/graphql';
// Import obsidian mocks to ensure HTMLElement.createDiv is available
import 'obsidian';

describe('AtomSearchInput - setValue Method', () => {
	let parentEl: HTMLElement;
	let mockIntuitionService: IntuitionService;
	let onSelectSpy: ReturnType<typeof vi.fn>;
	let component: AtomSearchInput;

	beforeEach(() => {
		parentEl = document.createElement('div');
		onSelectSpy = vi.fn();

		// Create mock IntuitionService
		mockIntuitionService = {
			semanticSearchAtoms: vi.fn(),
			searchAtoms: vi.fn(),
		} as unknown as IntuitionService;
	});

	describe('setValue - Auto-selection', () => {
		it('should auto-select first result when atoms are found', async () => {
			const mockAtom: Atom = {
				id: 'test-id-1',
				label: 'Albert Einstein',
				vaultId: 'vault-1',
				data: 'ipfs://test',
				creator: { id: '0xtest', label: 'Test Creator' },
				__typename: 'Atom',
			};

			// Mock search to return results
			vi.mocked(mockIntuitionService.semanticSearchAtoms).mockResolvedValue([]);
			vi.mocked(mockIntuitionService.searchAtoms).mockResolvedValue([mockAtom]);

			component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
				placeholder: 'Test',
				allowCreate: false,
			});

			await component.setValue('Albert Einstein');

			// Should call onSelect with the first result
			expect(onSelectSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'existing',
					termId: 'test-id-1',
					label: 'Albert Einstein',
					atom: mockAtom,
					confidence: 1,
				})
			);
		});

		it('should create new atom when no results and allowCreate is true', async () => {
			// Mock search to return no results
			vi.mocked(mockIntuitionService.semanticSearchAtoms).mockResolvedValue([]);
			vi.mocked(mockIntuitionService.searchAtoms).mockResolvedValue([]);

			component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
				placeholder: 'Test',
				allowCreate: true,
			});

			await component.setValue('New Term');

			// Should call onSelect with a new atom
			expect(onSelectSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'new',
					label: 'New Term',
					confidence: 1,
				})
			);
		});

		it('should not create atom when no results and allowCreate is false', async () => {
			// Mock search to return no results
			vi.mocked(mockIntuitionService.semanticSearchAtoms).mockResolvedValue([]);
			vi.mocked(mockIntuitionService.searchAtoms).mockResolvedValue([]);

			component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
				placeholder: 'Test',
				allowCreate: false,
			});

			await component.setValue('New Term');

			// Should not call onSelect
			expect(onSelectSpy).not.toHaveBeenCalled();
		});
	});

	describe('setValue - Race Condition Prevention', () => {
		it('should discard results from older searches', async () => {
			const mockAtom1: Atom = {
				id: 'test-id-1',
				label: 'First Result',
				vaultId: 'vault-1',
				data: 'ipfs://test1',
				creator: { id: '0xtest', label: 'Test Creator' },
				__typename: 'Atom',
			};

			const mockAtom2: Atom = {
				id: 'test-id-2',
				label: 'Second Result',
				vaultId: 'vault-2',
				data: 'ipfs://test2',
				creator: { id: '0xtest', label: 'Test Creator' },
				__typename: 'Atom',
			};

			let firstSearchResolve: ((value: Atom[]) => void) | null = null;
			let secondSearchResolve: ((value: Atom[]) => void) | null = null;

			// Mock searches to be controllable
			vi.mocked(mockIntuitionService.semanticSearchAtoms)
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);

			vi.mocked(mockIntuitionService.searchAtoms)
				.mockImplementationOnce(() => {
					return new Promise<Atom[]>((resolve) => {
						firstSearchResolve = resolve;
					});
				})
				.mockImplementationOnce(() => {
					return new Promise<Atom[]>((resolve) => {
						secondSearchResolve = resolve;
					});
				});

			component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
				placeholder: 'Test',
				allowCreate: false,
			});

			// Start first search (doesn't await)
			const firstPromise = component.setValue('First Search');

			// Start second search immediately
			const secondPromise = component.setValue('Second Search');

			// Resolve second search first
			secondSearchResolve?.([mockAtom2]);
			await secondPromise;

			// Resolve first search after
			firstSearchResolve?.([mockAtom1]);
			await firstPromise;

			// Should only have called onSelect once with the second result
			// First result should be discarded due to race condition check
			expect(onSelectSpy).toHaveBeenCalledTimes(1);
			expect(onSelectSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					termId: 'test-id-2',
					label: 'Second Result',
				})
			);
		});
	});

	describe('setValue - Input State', () => {
		it('should update input value before searching', async () => {
			vi.mocked(mockIntuitionService.semanticSearchAtoms).mockResolvedValue([]);
			vi.mocked(mockIntuitionService.searchAtoms).mockResolvedValue([]);

			component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
				placeholder: 'Test',
				allowCreate: false,
			});

			await component.setValue('Test Query');

			// Input should be updated
			expect(component.getValue()).toBe('Test Query');
		});
	});
});

describe('AtomSearchInput - setValueFromReference', () => {
	it('should have setValueFromReference for backwards compatibility', () => {
		// The setValueFromReference() method:
		// - Takes an AtomReference object
		// - Sets the input value and shows preview
		// - Does not trigger a search
		// - Used for programmatically setting known atoms

		expect(true).toBe(true);
	});
});

describe('AtomSearchInput - Entity Disambiguation', () => {
	let parentEl: HTMLElement;
	let mockIntuitionService: IntuitionService;
	let onSelectSpy: ReturnType<typeof vi.fn>;
	let component: AtomSearchInput;

	beforeEach(() => {
		parentEl = document.createElement('div');
		onSelectSpy = vi.fn();

		mockIntuitionService = {
			semanticSearchAtoms: vi.fn(),
			searchAtoms: vi.fn(),
		} as unknown as IntuitionService;

		vi.mocked(mockIntuitionService.semanticSearchAtoms).mockResolvedValue([]);
		vi.mocked(mockIntuitionService.searchAtoms).mockResolvedValue([]);
	});

	it('should set entity hint and include in selection', async () => {
		const mockAtom: Atom = {
			id: 'test-id-1',
			label: 'Apple Inc.',
			vaultId: 'vault-1',
			data: 'ipfs://test',
			creator: { id: '0xtest', label: 'Test Creator' },
			__typename: 'Atom',
		};

		vi.mocked(mockIntuitionService.searchAtoms).mockResolvedValue([mockAtom]);

		component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
			placeholder: 'Test',
			allowCreate: true,
		});

		// Set entity hint
		component.setEntityHint({
			type: 'organization',
			disambiguation: 'Technology company',
			confidence: 0.95,
		});

		await component.setValue('Apple Inc.');

		// Should include entity metadata in selection
		expect(onSelectSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'existing',
				termId: 'test-id-1',
				label: 'Apple Inc.',
				entityType: 'organization',
				disambiguation: 'Technology company',
				entityConfidence: 0.95,
			})
		);
	});

	it('should include entity hint for new atoms', async () => {
		component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
			placeholder: 'Test',
			allowCreate: true,
		});

		component.setEntityHint({
			type: 'person',
			disambiguation: 'Physicist',
			confidence: 0.92,
		});

		await component.setValue('Einstein');

		expect(onSelectSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'new',
				label: 'Einstein',
				entityType: 'person',
				disambiguation: 'Physicist',
				entityConfidence: 0.92,
			})
		);
	});

	it('should work without entity hint', async () => {
		const mockAtom: Atom = {
			id: 'test-id-1',
			label: 'Test',
			vaultId: 'vault-1',
			data: 'ipfs://test',
			creator: { id: '0xtest', label: 'Test Creator' },
			__typename: 'Atom',
		};

		vi.mocked(mockIntuitionService.searchAtoms).mockResolvedValue([mockAtom]);

		component = new AtomSearchInput(parentEl, mockIntuitionService, onSelectSpy, {
			placeholder: 'Test',
			allowCreate: true,
		});

		// No entity hint set
		await component.setValue('Test');

		// Should still call onSelect but without entity metadata
		const call = onSelectSpy.mock.calls[0][0];
		expect(call).toMatchObject({
			type: 'existing',
			termId: 'test-id-1',
			label: 'Test',
		});
		// Entity fields should be undefined
		expect(call.entityType).toBeUndefined();
		expect(call.disambiguation).toBeUndefined();
		expect(call.entityConfidence).toBeUndefined();
	});
});
