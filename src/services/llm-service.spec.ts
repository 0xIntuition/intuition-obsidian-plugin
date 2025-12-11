import { describe, it, expect, vi, beforeEach } from 'vitest';
import type IntuitionPlugin from '../main';
import { DEFAULT_SETTINGS } from '../types';

// Mock the budget modals BEFORE importing LLMService
vi.mock('../ui/modals/budget-warning-modal', () => {
	return {
		BudgetWarningModal: class {
			constructor(
				public app: any,
				public plugin: any,
				public currentUsage: number,
				public budget: number,
				public estimatedCost: number,
				public onContinue: () => void,
				public onCancel: () => void
			) {}

			open() {
				// Simulate user clicking Continue by default
				this.onContinue();
			}
		}
	};
});

vi.mock('../ui/modals/budget-exceeded-modal', () => {
	return {
		BudgetExceededModal: class {
			constructor(
				public app: any,
				public plugin: any
			) {}

			open() {
				// Modal shown but doesn't resolve anything
			}
		}
	};
});

// Import AFTER mocks are set up
import { LLMService } from './llm-service';

describe('LLMService - Budget Warnings', () => {
	let service: LLMService;
	let mockPlugin: Partial<IntuitionPlugin>;

	beforeEach(() => {
		// Create mock plugin
		mockPlugin = {
			app: {} as any,
			settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
			saveSettings: vi.fn().mockResolvedValue(undefined),
			noticeManager: {
				success: vi.fn(),
				error: vi.fn(),
				warning: vi.fn(),
				info: vi.fn(),
			} as any,
		};

		service = new LLMService(mockPlugin as IntuitionPlugin);
	});

	describe('checkBudgetWithModal', () => {
		it('should allow requests below threshold', async () => {
			// Set budget to $10, usage to $5 (50%)
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 5;
			mockPlugin.settings!.llm.costManagement.warningThresholdPercent = 80;

			const shouldProceed = await service.checkBudgetWithModal(0.0003);

			expect(shouldProceed).toBe(true);
		});

		it('should show warning modal at threshold', async () => {
			// Set budget to $10, usage to $8 (80%)
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 8;
			mockPlugin.settings!.llm.costManagement.warningThresholdPercent = 80;

			const shouldProceed = await service.checkBudgetWithModal(0.0003);

			// Modal should have been shown (mocked to auto-continue)
			expect(shouldProceed).toBe(true);
		});

		it('should block at 100% budget', async () => {
			// Set budget to $10, usage to $10.5 (105%)
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 10.5;

			const shouldProceed = await service.checkBudgetWithModal(0.0003);

			expect(shouldProceed).toBe(false);
		});

		it('should not show warning if session dismissed', async () => {
			// Set budget to $10, usage to $8.5 (85%)
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 8.5;
			mockPlugin.settings!.llm.costManagement.warningThresholdPercent = 80;
			service.sessionWarningDismissed = true;

			const shouldProceed = await service.checkBudgetWithModal(0.0003);

			expect(shouldProceed).toBe(true); // No modal shown
		});

		it('should allow requests when tracking disabled', async () => {
			// Disable tracking
			mockPlugin.settings!.llm.costManagement.trackUsage = false;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 15; // Over budget

			const shouldProceed = await service.checkBudgetWithModal(0.0003);

			expect(shouldProceed).toBe(true); // Allowed because tracking disabled
		});

		it('should allow requests when no budget set', async () => {
			// Enable tracking but no budget
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 0;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 15;

			const shouldProceed = await service.checkBudgetWithModal(0.0003);

			expect(shouldProceed).toBe(true); // Allowed because no budget set
		});
	});

	describe('checkBudget (legacy)', () => {
		it('should pass validation below threshold', () => {
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 5;

			const result = service.checkBudget(0.0003);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should fail validation at 100% budget', () => {
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 10;

			const result = service.checkBudget(0.0003);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should warn at threshold', () => {
			mockPlugin.settings!.llm.costManagement.trackUsage = true;
			mockPlugin.settings!.llm.costManagement.monthlyBudgetUSD = 10;
			mockPlugin.settings!.llm.usageStats.totalCostUSD = 8.5;
			mockPlugin.settings!.llm.costManagement.warningThresholdPercent = 80;

			const result = service.checkBudget(0.0003);

			expect(result.valid).toBe(true);
			expect(mockPlugin.noticeManager!.warning).toHaveBeenCalled();
		});
	});
});
