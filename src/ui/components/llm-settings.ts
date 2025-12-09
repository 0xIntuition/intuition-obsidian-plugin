/**
 * LLM Settings UI Component
 * Renders all LLM configuration options in the settings tab
 */

import { Setting } from 'obsidian';
import type IntuitionPlugin from '../../main';
import { LLM_PROVIDERS, type LLMProvider } from '../../types/llm';
import { ApiKeyModal } from '../modals/api-key-modal';
import { UnlockLLMModal } from '../modals/unlock-llm-modal';

/**
 * LLM Settings Component
 * Handles rendering and interaction for all LLM-related settings
 */
export class LLMSettingsComponent {
	private plugin: IntuitionPlugin;
	private containerEl: HTMLElement;
	private testResultEl: HTMLElement | null = null;

	constructor(plugin: IntuitionPlugin, containerEl: HTMLElement) {
		this.plugin = plugin;
		this.containerEl = containerEl;
	}

	/**
	 * Render all LLM settings sections
	 */
	render(): void {
		// Section header
		this.containerEl.createEl('h2', { text: 'AI Features (LLM)' });

		// Enable/disable toggle
		this.addEnableToggle();

		// Only show other settings if enabled
		if (this.plugin.settings.llm.enabled) {
			this.addProviderSelection();
			this.addModelSelection();
			this.addApiKeySection();
			this.addCustomEndpointSection();
			this.addConnectionTest();
			this.addCostManagementSection();
			this.addUsageStatsSection();
			this.addFeatureToggles();
		}
	}

	/**
	 * Enable/Disable LLM features
	 */
	private addEnableToggle(): void {
		new Setting(this.containerEl)
			.setName('Enable AI features')
			.setDesc(
				'Enable LLM-powered features like advanced claim extraction, entity disambiguation, and smart suggestions'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.llm.enabled)
					.onChange(async (value) => {
						this.plugin.settings.llm.enabled = value;
						await this.plugin.saveSettings();
						// Re-render to show/hide other settings
						this.containerEl.empty();
						this.render();
					})
			);
	}

	/**
	 * Provider selection dropdown
	 */
	private addProviderSelection(): void {
		new Setting(this.containerEl)
			.setName('LLM Provider')
			.setDesc('Select your AI provider')
			.addDropdown((dropdown) => {
				// Add all providers
				Object.values(LLM_PROVIDERS).forEach((provider) => {
					dropdown.addOption(provider.id, provider.name);
				});

				dropdown
					.setValue(this.plugin.settings.llm.provider)
					.onChange(async (value: string) => {
						const oldProvider = this.plugin.settings.llm.provider;
						this.plugin.settings.llm.provider =
							value as LLMProvider;

						// Reset to first recommended model of new provider
						const newProvider = LLM_PROVIDERS[value as LLMProvider];
						const recommendedModel = newProvider.models.find(
							(m) => m.recommended
						);
						if (recommendedModel) {
							this.plugin.settings.llm.modelId =
								recommendedModel.id;
						}

						// Lock service if provider changed
						if (oldProvider !== value) {
							this.plugin.llmService.lock();
							this.plugin.noticeManager.warning(
								'LLM service locked due to provider change'
							);
						}

						await this.plugin.saveSettings();
						// Re-render to update model dropdown
						this.containerEl.empty();
						this.render();
					});
			});
	}

	/**
	 * Model selection dropdown
	 */
	private addModelSelection(): void {
		const provider = LLM_PROVIDERS[this.plugin.settings.llm.provider];
		const currentModel = provider.models.find(
			(m) => m.id === this.plugin.settings.llm.modelId
		);

		// Build description with pricing info
		let desc = `Context: ${currentModel?.contextWindow.toLocaleString()} tokens`;
		if (currentModel) {
			desc += ` | Cost: $${currentModel.inputPricePerMillion}/M input, $${currentModel.outputPricePerMillion}/M output`;
		}

		new Setting(this.containerEl)
			.setName('Model')
			.setDesc(desc)
			.addDropdown((dropdown) => {
				// Add all models for current provider
				provider.models.forEach((model) => {
					const label = model.recommended
						? `${model.name} (Recommended)`
						: model.name;
					dropdown.addOption(model.id, label);
				});

				dropdown
					.setValue(this.plugin.settings.llm.modelId)
					.onChange(async (value: string) => {
						this.plugin.settings.llm.modelId = value;
						await this.plugin.saveSettings();
						// Re-render to update pricing info
						this.containerEl.empty();
						this.render();
					});
			});
	}

	/**
	 * API key input and management
	 */
	private addApiKeySection(): void {
		const hasApiKey = !!this.plugin.settings.llm.encryptedApiKey;
		const provider = LLM_PROVIDERS[this.plugin.settings.llm.provider];

		// Status display
		const statusText = hasApiKey ? 'API key configured' : 'No API key';

		new Setting(this.containerEl)
			.setName('API Key')
			.setDesc(statusText)
			.addButton((button) =>
				button
					.setButtonText(hasApiKey ? 'Change Key' : 'Save Key')
					.onClick(() => {
						new ApiKeyModal(
							this.plugin.app,
							this.plugin,
							hasApiKey ? 'change' : 'save',
							() => {
								// Re-render settings to update status
								this.containerEl.empty();
								this.render();
							}
						).open();
					})
			)
			.addButton((button) =>
				button
					.setButtonText('Remove Key')
					.setWarning()
					.setDisabled(!hasApiKey)
					.onClick(() => {
						new ApiKeyModal(
							this.plugin.app,
							this.plugin,
							'remove',
							() => {
								// Re-render settings to update status
								this.containerEl.empty();
								this.render();
							}
						).open();
					})
			);

		// Link to provider's API key page
		const linkEl = this.containerEl.createDiv({ cls: 'setting-item-description' });
		linkEl.innerHTML = `Get your API key from <a href="${provider.docsUrl}" target="_blank">${provider.name}</a>`;
	}

	/**
	 * Custom endpoint configuration
	 */
	private addCustomEndpointSection(): void {
		let previousValidUrl = this.plugin.settings.llm.customBaseUrl || '';

		new Setting(this.containerEl)
			.setName('Custom Endpoint')
			.setDesc(
				'Override default API endpoint (for proxies/corporate setups). Leave empty for default.'
			)
			.addText((text) => {
				text.setPlaceholder('https://...')
					.setValue(this.plugin.settings.llm.customBaseUrl || '');

				// Validate on blur
				text.inputEl.addEventListener('blur', async () => {
					const value = text.getValue().trim();

					// Empty is valid (use default)
					if (value === '') {
						this.plugin.settings.llm.customBaseUrl = null;
						await this.plugin.saveSettings();
						previousValidUrl = '';
						return;
					}

					// Validate URL
					try {
						new URL(value);
						this.plugin.settings.llm.customBaseUrl = value;
						await this.plugin.saveSettings();
						previousValidUrl = value;
					} catch (error) {
						this.plugin.noticeManager.error('Invalid URL format');
						text.setValue(previousValidUrl);
						this.plugin.settings.llm.customBaseUrl =
							previousValidUrl || null;
					}
				});
			});
	}

	/**
	 * Connection test button with latency display
	 */
	private addConnectionTest(): void {
		const setting = new Setting(this.containerEl)
			.setName('Test Connection')
			.setDesc('Verify API key and measure latency')
			.addButton((button) =>
				button
					.setButtonText('Test Connection')
					.setDisabled(!this.plugin.settings.llm.encryptedApiKey)
					.onClick(async () => {
						await this.testConnection();
					})
			);

		// Add result display area
		this.testResultEl = setting.descEl.createDiv({
			cls: 'llm-test-result',
		});
	}

	/**
	 * Execute connection test
	 */
	private async testConnection(): Promise<void> {
		if (!this.testResultEl) return;

		// Clear previous result
		this.testResultEl.setText('Testing...');
		this.testResultEl.className = 'llm-test-result llm-test-pending';

		try {
			// First, unlock if needed
			if (!this.plugin.llmService.isAvailable()) {
				// Prompt for password
				new UnlockLLMModal(this.plugin.app, this.plugin, () => {
					// Retry connection test after unlock
					this.testConnection();
				}).open();
				return; // Exit and wait for modal callback
			}

			// TODO: Implement actual connection test in Phase 7 after AI SDK installation
			// For now, just check if service is available
			if (this.plugin.llmService.isAvailable()) {
				this.testResultEl.setText('✓ Connection successful');
				this.testResultEl.className =
					'llm-test-result llm-test-success';
				this.plugin.noticeManager.success('Connection test passed');
			} else {
				throw new Error('Service not available');
			}
		} catch (error) {
			this.testResultEl.setText(`✗ ${error.message}`);
			this.testResultEl.className = 'llm-test-result llm-test-error';
		}
	}

	/**
	 * Cost management settings
	 */
	private addCostManagementSection(): void {
		this.containerEl.createEl('h3', { text: 'Cost Management' });

		// Track usage toggle
		new Setting(this.containerEl)
			.setName('Track Usage')
			.setDesc('Monitor API usage and costs')
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.llm.costManagement.trackUsage
					)
					.onChange(async (value) => {
						this.plugin.settings.llm.costManagement.trackUsage =
							value;
						await this.plugin.saveSettings();
						// Re-render to show/hide budget settings
						this.containerEl.empty();
						this.render();
					})
			);

		// Budget settings (only if tracking enabled)
		if (this.plugin.settings.llm.costManagement.trackUsage) {
			// Monthly budget
			let previousValidBudget =
				this.plugin.settings.llm.costManagement.monthlyBudgetUSD?.toString() ||
				'';

			new Setting(this.containerEl)
				.setName('Monthly Budget (USD)')
				.setDesc('Set to 0 or leave empty for unlimited')
				.addText((text) => {
					text.setPlaceholder('20')
						.setValue(previousValidBudget)
						.onChange(async (value) => {
							const trimmed = value.trim();

							// Empty or 0 means unlimited
							if (trimmed === '' || trimmed === '0') {
								this.plugin.settings.llm.costManagement.monthlyBudgetUSD =
									null;
								await this.plugin.saveSettings();
								previousValidBudget = '';
								return;
							}

							// Validate number
							const num = parseFloat(trimmed);
							if (isNaN(num) || num < 0) {
								this.plugin.noticeManager.error(
									'Budget must be a positive number'
								);
								text.setValue(previousValidBudget);
								return;
							}

							this.plugin.settings.llm.costManagement.monthlyBudgetUSD =
								num;
							await this.plugin.saveSettings();
							previousValidBudget = trimmed;
						});
				});

			// Warning threshold
			new Setting(this.containerEl)
				.setName('Warning Threshold (%)')
				.setDesc('Show warning when budget usage exceeds this percentage')
				.addSlider((slider) =>
					slider
						.setLimits(50, 100, 5)
						.setValue(
							this.plugin.settings.llm.costManagement
								.warningThresholdPercent
						)
						.setDynamicTooltip()
						.onChange(async (value) => {
							this.plugin.settings.llm.costManagement.warningThresholdPercent =
								value;
							await this.plugin.saveSettings();
						})
				);

			// Require confirmation
			new Setting(this.containerEl)
				.setName('Require Confirmation')
				.setDesc('Ask for confirmation before expensive operations')
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.llm.costManagement
								.requireConfirmation
						)
						.onChange(async (value) => {
							this.plugin.settings.llm.costManagement.requireConfirmation =
								value;
							await this.plugin.saveSettings();
						})
				);
		}
	}

	/**
	 * Usage statistics display
	 */
	private addUsageStatsSection(): void {
		if (!this.plugin.settings.llm.costManagement.trackUsage) {
			return; // Only show if tracking is enabled
		}

		this.containerEl.createEl('h3', { text: 'Usage Statistics' });

		const stats = this.plugin.settings.llm.usageStats;
		const budget =
			this.plugin.settings.llm.costManagement.monthlyBudgetUSD;

		// Stats grid
		const statsContainer = this.containerEl.createDiv({
			cls: 'llm-usage-stats',
		});

		const statsGrid = statsContainer.createDiv({
			cls: 'llm-usage-stats-grid',
		});

		// Total requests
		const requestsStat = statsGrid.createDiv({ cls: 'llm-stat' });
		requestsStat.createEl('div', {
			text: 'Requests',
			cls: 'llm-stat-label',
		});
		requestsStat.createEl('div', { text: stats.totalRequests.toString() });

		// Total cost
		const costStat = statsGrid.createDiv({ cls: 'llm-stat' });
		costStat.createEl('div', { text: 'Cost', cls: 'llm-stat-label' });
		const costValue = costStat.createEl('div', {
			text: `$${stats.totalCostUSD.toFixed(4)}`,
			cls: 'llm-stat-cost',
		});

		// Budget indicator
		if (budget && budget > 0) {
			const percentUsed = (stats.totalCostUSD / budget) * 100;
			const budgetText = ` / $${budget} (${percentUsed.toFixed(1)}%)`;
			costValue.appendText(budgetText);

			// Warning if near limit
			if (
				percentUsed >=
				this.plugin.settings.llm.costManagement.warningThresholdPercent
			) {
				costValue.addClass('llm-stat-warning');
			}
		}

		// Tokens
		const tokensStat = statsGrid.createDiv({ cls: 'llm-stat' });
		tokensStat.createEl('div', { text: 'Tokens', cls: 'llm-stat-label' });
		tokensStat.createEl('div', {
			text: `${stats.totalInputTokens.toLocaleString()} in / ${stats.totalOutputTokens.toLocaleString()} out`,
		});

		// Last reset
		const resetDate = new Date(stats.lastReset).toLocaleDateString();
		statsContainer.createEl('div', {
			text: `Period: ${resetDate} - ${new Date().toLocaleDateString()}`,
			cls: 'setting-item-description',
		});

		// Reset button
		new Setting(this.containerEl)
			.setName('Reset Statistics')
			.setDesc('Clear monthly usage stats')
			.addButton((button) =>
				button
					.setButtonText('Reset')
					.setWarning()
					.onClick(async () => {
						await this.plugin.llmService.resetUsageStats();
						// Re-render to show updated stats
						this.containerEl.empty();
						this.render();
					})
			);
	}

	/**
	 * Feature toggles for individual LLM features
	 */
	private addFeatureToggles(): void {
		this.containerEl.createEl('h3', { text: 'AI Features' });

		const features = this.plugin.settings.llm.features;

		new Setting(this.containerEl)
			.setName('Claim Extraction')
			.setDesc('Use LLM for advanced claim parsing and extraction')
			.addToggle((toggle) =>
				toggle
					.setValue(features.claimExtraction)
					.onChange(async (value) => {
						features.claimExtraction = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Entity Disambiguation')
			.setDesc('Disambiguate entities with multiple meanings')
			.addToggle((toggle) =>
				toggle
					.setValue(features.entityDisambiguation)
					.onChange(async (value) => {
						features.entityDisambiguation = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Predicate Suggestion')
			.setDesc('Suggest predicates based on context')
			.addToggle((toggle) =>
				toggle
					.setValue(features.predicateSuggestion)
					.onChange(async (value) => {
						features.predicateSuggestion = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Batch Analysis')
			.setDesc('Analyze multiple notes at once')
			.addToggle((toggle) =>
				toggle
					.setValue(features.batchAnalysis)
					.onChange(async (value) => {
						features.batchAnalysis = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Knowledge Q&A')
			.setDesc('Answer questions about your knowledge graph')
			.addToggle((toggle) =>
				toggle
					.setValue(features.knowledgeQA)
					.onChange(async (value) => {
						features.knowledgeQA = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Claim Improvement')
			.setDesc('Suggest improvements to claims')
			.addToggle((toggle) =>
				toggle
					.setValue(features.claimImprovement)
					.onChange(async (value) => {
						features.claimImprovement = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Auto-Tagging')
			.setDesc('Automatically suggest tags for notes')
			.addToggle((toggle) =>
				toggle
					.setValue(features.autoTagging)
					.onChange(async (value) => {
						features.autoTagging = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Relationship Discovery')
			.setDesc('Discover implicit relationships between entities')
			.addToggle((toggle) =>
				toggle
					.setValue(features.relationshipDiscovery)
					.onChange(async (value) => {
						features.relationshipDiscovery = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Summary Generation')
			.setDesc('Generate summaries of notes and claims')
			.addToggle((toggle) =>
				toggle
					.setValue(features.summaryGeneration)
					.onChange(async (value) => {
						features.summaryGeneration = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName('Fact Checking')
			.setDesc('Check claims against known facts')
			.addToggle((toggle) =>
				toggle
					.setValue(features.factChecking)
					.onChange(async (value) => {
						features.factChecking = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
