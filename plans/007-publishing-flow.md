# Plan 007: Claim Publishing & Staking Flow

## Objective
Implement the complete publishing flow including stake amount input, impact preview calculations, transaction building, and on-chain submission.

## Prerequisites
- Plan 003 (Wallet Infrastructure)
- Plan 006 (Claim Structuring Modal)

## Deliverables
1. Stake amount input with balance validation
2. Position selection (For/Against)
3. Impact preview calculations
4. Transaction building and estimation
5. Transaction confirmation modal
6. Success/error handling with note annotation

## Files to Create

```
src/
  types/
    transactions.ts          # Transaction types
    staking.ts               # Staking-related types
  services/
    transaction-service.ts   # Transaction building
    impact-calculator.ts     # Impact preview math
  ui/
    modals/
      stake-modal.ts         # Stake configuration
      tx-confirm-modal.ts    # Transaction confirmation
      tx-success-modal.ts    # Success state
    components/
      stake-input.ts         # Amount input
      impact-preview.ts      # Impact display
      position-selector.ts   # For/Against toggle
```

## Data Models

```typescript
// src/types/staking.ts
import type { Hex, Address } from 'viem';
import { ClaimDraft } from './claims';
import { VaultData } from './intuition';

export interface StakeConfig {
  amount: bigint;
  position: 'for' | 'against';
}

export interface ImpactPreview {
  currentConsensus: number;
  newConsensus: number;
  consensusChange: number;

  yourShares: bigint;
  yourOwnershipPercent: number;

  currentSharePrice: bigint;
  estimatedExitValue: bigint;

  estimatedMonthlyFees: bigint;
  breakEvenMonths: number | null; // null if no activity
}

// src/types/transactions.ts
export type TransactionType =
  | 'createAtom'
  | 'createTriple'
  | 'depositAtom'
  | 'depositTriple';

export interface TransactionStep {
  id: string;
  type: TransactionType;
  description: string;
  status: 'pending' | 'signing' | 'confirming' | 'confirmed' | 'failed';
  hash?: Hex;
  error?: string;
}

export interface TransactionPlan {
  steps: TransactionStep[];
  totalCost: bigint;
  estimatedGas: bigint;
}

export interface PublishResult {
  success: boolean;
  tripleId?: Hex;
  atomsCreated: Hex[];
  transactionHashes: Hex[];
  sharesReceived?: bigint;
  error?: string;
}
```

## Implementation

### Impact Calculator (src/services/impact-calculator.ts)

```typescript
import { PublicClient } from 'viem';
import { VaultData } from '../types/intuition';
import { ImpactPreview } from '../types/staking';
import { MULTI_VAULT_ABI } from './transaction-service'; // Assuming ABI is exported

export class ImpactCalculator {
  private publicClient: PublicClient;
  private multiVaultAddress: `0x${string}`;

  constructor(publicClient: PublicClient, multiVaultAddress: `0x${string}`) {
    this.publicClient = publicClient;
    this.multiVaultAddress = multiVaultAddress;
  }

  async calculateImpact(
    forVault: VaultData,
    againstVault: VaultData,
    stakeAmount: bigint,
    position: 'for' | 'against'
  ): Promise<ImpactPreview> {
    const targetVault = position === 'for' ? forVault : againstVault;
    const opposingVault = position === 'for' ? againstVault : forVault;

    // Use a read-only contract call to preview the number of shares
    const yourShares = await this.publicClient.readContract({
      address: this.multiVaultAddress,
      abi: MULTI_VAULT_ABI,
      functionName: 'previewDeposit',
      args: [BigInt(targetVault.id), stakeAmount],
    }) as bigint;

    // Current state
    const currentForAssets = forVault.totalAssets;
    const currentAgainstAssets = againstVault.totalAssets;
    const currentTotal = currentForAssets + currentAgainstAssets;
    const currentConsensus = currentTotal > 0n
      ? Number((currentForAssets * 10000n) / currentTotal) / 100
      : 50;

    // New state after your stake
    const newForAssets = position === 'for'
      ? currentForAssets + stakeAmount
      : currentForAssets;
    const newAgainstAssets = position === 'against'
      ? currentAgainstAssets + stakeAmount
      : currentAgainstAssets;
    const newTotal = newForAssets + newAgainstAssets;
    const newConsensus = newTotal > 0n
      ? Number((newForAssets * 10000n) / newTotal) / 100
      : 50;

    // Ownership
    const newTotalShares = targetVault.totalShares + yourShares;
    const yourOwnershipPercent = newTotalShares > 0n
      ? Number((yourShares * 10000n) / newTotalShares) / 100
      : 0;
    
    // Exit value at current price
    const currentSharePrice = targetVault.currentSharePrice;
    const estimatedExitValue = (yourShares * currentSharePrice) / BigInt(1e18);
    
    // Fee estimation (simplified)
    const estimatedMonthlyFees = 0n;
    const breakEvenMonths = null;

    return {
      currentConsensus,
      newConsensus,
      consensusChange: newConsensus - currentConsensus,
      yourShares,
      yourOwnershipPercent,
      currentSharePrice,
      estimatedExitValue,
      estimatedMonthlyFees,
      breakEvenMonths,
    };
  }
}
```

### Transaction Service (src/services/transaction-service.ts)

```typescript
import { encodeFunctionData, parseEther, type Hex, type Address } from 'viem';
import { WalletService } from './wallet-service';
import { IntuitionService } from './intuition-service';
import { ClaimDraft } from '../types/claims';
import { StakeConfig } from '../types/staking';
import { TransactionPlan, TransactionStep, PublishResult } from '../types/transactions';
import { NETWORKS } from '../types/networks';
import IntuitionPlugin from '../main';

// MultiVault ABI (partial) - EXPORTED for use in ImpactCalculator
export const MULTI_VAULT_ABI = [
  {
    name: 'createAtom',
    type: 'function',
    inputs: [{ name: 'atomUri', type: 'bytes' }],
    outputs: [{ name: 'atomCost', type: 'uint256' }],
  },
  {
    name: 'createTriple',
    type: 'function',
    inputs: [
      { name: 'subjectId', type: 'uint256' },
      { name: 'predicateId', type: 'uint256' },
      { name: 'objectId', type: 'uint256' },
    ],
    outputs: [{ name: 'tripleCost', type: 'uint256' }],
  },
  {
    name: 'depositTriple',
    type: 'function',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'tripleId', type: 'uint256' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'previewDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [
        { name: 'vaultId', type: 'uint256' },
        { name: 'depositAmount', type: 'uint256' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  }
] as const;

export class TransactionService {
  private plugin: IntuitionPlugin;
  private walletService: WalletService;
  private intuitionService: IntuitionService;

  constructor(
    plugin: IntuitionPlugin,
    walletService: WalletService,
    intuitionService: IntuitionService
  ) {
    this.plugin = plugin;
    this.walletService = walletService;
    this.intuitionService = intuitionService;
  }

  async buildTransactionPlan(
    draft: ClaimDraft,
    stakeConfig: StakeConfig
  ): Promise<TransactionPlan> {
    const steps: TransactionStep[] = [];
    let totalCost = stakeConfig.amount;

    // Check which atoms need to be created
    if (draft.subject?.type === 'new') {
      steps.push({
        id: crypto.randomUUID(),
        type: 'createAtom',
        description: `Create atom: ${draft.subject.label}`,
        status: 'pending',
      });
      totalCost += parseEther('0.0003'); // Atom creation fee estimate
    }

    if (draft.predicate?.type === 'new') {
      steps.push({
        id: crypto.randomUUID(),
        type: 'createAtom',
        description: `Create atom: ${draft.predicate.label}`,
        status: 'pending',
      });
      totalCost += parseEther('0.0003');
    }

    if (draft.object?.type === 'new') {
      steps.push({
        id: crypto.randomUUID(),
        type: 'createAtom',
        description: `Create atom: ${draft.object.label}`,
        status: 'pending',
      });
      totalCost += parseEther('0.0003');
    }

    // Create triple if it doesn't exist
    if (!draft.existingTriple) {
      steps.push({
        id: crypto.randomUUID(),
        type: 'createTriple',
        description: 'Create triple claim',
        status: 'pending',
      });
      totalCost += parseEther('0.0004'); // Triple creation fee estimate
    }

    // Deposit stake
    steps.push({
      id: crypto.randomUUID(),
      type: 'depositTriple',
      description: `Stake ${Number(stakeConfig.amount) / 1e18} TRUST (${stakeConfig.position})`,
      status: 'pending',
    });

    // Estimate gas (rough estimate)
    const estimatedGas = BigInt(steps.length * 200000) * parseEther('0.000000001');

    return {
      steps,
      totalCost,
      estimatedGas,
    };
  }

  async executeTransactionPlan(
    draft: ClaimDraft,
    stakeConfig: StakeConfig,
    plan: TransactionPlan,
    onStepUpdate: (step: TransactionStep) => void
  ): Promise<PublishResult> {
    const network = NETWORKS[this.plugin.settings.network];
    const multiVaultAddress = network.multiVaultAddress;
    const walletClient = this.walletService.getWalletClient();
    const publicClient = this.walletService.getPublicClient();
    const address = this.walletService.getAddress()!;

    const atomsCreated: Hex[] = [];
    const transactionHashes: Hex[] = [];
    let subjectId: bigint | undefined;
    let predicateId: bigint | undefined;
    let objectId: bigint | undefined;
    let tripleId: bigint | undefined;

    try {
      for (const step of plan.steps) {
        step.status = 'signing';
        onStepUpdate(step);

        let hash: Hex;

        switch (step.type) {
          case 'createAtom': {
            // Determine which atom this is
            let atomData: string;
            if (!subjectId && draft.subject?.type === 'new') {
              atomData = draft.subject.label;
            } else if (!predicateId && draft.predicate?.type === 'new') {
              atomData = draft.predicate.label;
            } else if (draft.object?.type === 'new') {
              atomData = draft.object.label;
            } else {
              throw new Error('Unexpected createAtom step');
            }
            
            // SIMPLIFICATION: Atom URI is just the string label encoded as bytes.
            // No complex object structure or IPFS upload is involved.
            const atomUri = new TextEncoder().encode(atomData);

            hash = await walletClient.writeContract({
              address: multiVaultAddress,
              abi: MULTI_VAULT_ABI,
              functionName: 'createAtom',
              args: [atomUri],
              value: parseEther('0.0003'),
            });

            step.status = 'confirming';
            step.hash = hash;
            onStepUpdate(step);

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            // Parse atom ID from receipt (simplified - would need proper event parsing)
            const atomId = BigInt(receipt.logs[0]?.topics[1] || '0');
            atomsCreated.push(hash);

            // Assign to correct field
            if (!subjectId && draft.subject?.type === 'new') {
              subjectId = atomId;
            } else if (!predicateId && draft.predicate?.type === 'new') {
              predicateId = atomId;
            } else {
              objectId = atomId;
            }
            break;
          }

          case 'createTriple': {
            // Get IDs for existing atoms
            if (!subjectId && draft.subject?.type === 'existing') {
              subjectId = BigInt(draft.subject.termId!);
            }
            if (!predicateId && draft.predicate?.type === 'existing') {
              predicateId = BigInt(draft.predicate.termId!);
            }
            if (!objectId && draft.object?.type === 'existing') {
              objectId = BigInt(draft.object.termId!);
            }

            hash = await walletClient.writeContract({
              address: multiVaultAddress,
              abi: MULTI_VAULT_ABI,
              functionName: 'createTriple',
              args: [subjectId!, predicateId!, objectId!],
              value: parseEther('0.0004'),
            });

            step.status = 'confirming';
            step.hash = hash;
            onStepUpdate(step);

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            tripleId = BigInt(receipt.logs[0]?.topics[1] || '0');
            break;
          }

          case 'depositTriple': {
            // Get triple ID
            if (!tripleId && draft.existingTriple) {
              tripleId = BigInt(draft.existingTriple.tripleId);
            }

            // For "against" position, we need the counter vault
            // This is simplified - actual implementation needs vault ID lookup
            const vaultId = stakeConfig.position === 'for'
              ? tripleId!
              : tripleId! + 1n; // Counter vault convention

            hash = await walletClient.writeContract({
              address: multiVaultAddress,
              abi: MULTI_VAULT_ABI,
              functionName: 'depositTriple',
              args: [address, vaultId],
              value: stakeConfig.amount,
            });

            step.status = 'confirming';
            step.hash = hash;
            onStepUpdate(step);

            await publicClient.waitForTransactionReceipt({ hash });
            break;
          }
        }

        step.status = 'confirmed';
        transactionHashes.push(hash!);
        onStepUpdate(step);
      }

      return {
        success: true,
        tripleId: tripleId ? `0x${tripleId.toString(16)}` as Hex : undefined,
        atomsCreated,
        transactionHashes,
      };
    } catch (error) {
      const failedStep = plan.steps.find(s => s.status === 'signing' || s.status === 'confirming');
      if (failedStep) {
        failedStep.status = 'failed';
        failedStep.error = error.message;
        onStepUpdate(failedStep);
      }

      return {
        success: false,
        atomsCreated,
        transactionHashes,
        error: error.message,
      };
    }
  }
}
```

### Stake Modal (src/ui/modals/stake-modal.ts)

```typescript
import { App, Modal, Setting } from 'obsidian';
import { formatEther, parseEther } from 'viem';
import IntuitionPlugin from '../../main';
import { ClaimDraft } from '../../types/claims';
import { StakeConfig, ImpactPreview } from '../../types/staking';
import { TransactionPlan } from '../../types/transactions';
import { ImpactCalculator } from '../../services/impact-calculator';

export class StakeModal extends Modal {
  plugin: IntuitionPlugin;
  private draft: ClaimDraft;
  private impactCalculator: ImpactCalculator;

  private stakeAmount: string = '';
  private position: 'for' | 'against' = 'for';
  private impact: ImpactPreview | null = null;
  private plan: TransactionPlan | null = null;

  private impactEl: HTMLElement;
  private planEl: HTMLElement;

  constructor(app: App, plugin: IntuitionPlugin, draft: ClaimDraft) {
    super(app);
    this.plugin = plugin;
    this.draft = draft;
    this.impactCalculator = new ImpactCalculator();
    this.stakeAmount = plugin.settings.ui.defaultStakeAmount;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('intuition-stake-modal');

    contentEl.createEl('h2', { text: 'Stake on Claim' });

    // Show claim summary
    this.renderClaimSummary(contentEl);

    // Stake input
    this.renderStakeInput(contentEl);

    // Impact preview
    this.impactEl = contentEl.createDiv({ cls: 'impact-section' });

    // Transaction plan
    this.planEl = contentEl.createDiv({ cls: 'plan-section' });

    // Actions
    this.renderActions(contentEl);

    // Initial calculation
    this.calculateImpact();
  }

  private renderClaimSummary(container: HTMLElement): void {
    const summary = container.createDiv({ cls: 'claim-summary' });

    const tripleText = `[${this.draft.subject?.label}] → [${this.draft.predicate?.label}] → [${this.draft.object?.label}]`;
    summary.createEl('p', { text: tripleText, cls: 'triple-display' });

    if (this.draft.consensus) {
      const consensusText = `Current: ${this.draft.consensus.forPercentage.toFixed(1)}% For`;
      summary.createEl('small', { text: consensusText });
    }
  }

  private renderStakeInput(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'stake-input-section' });

    // Amount
    new Setting(section)
      .setName('Stake Amount')
      .setDesc(`Balance: ${this.plugin.walletService.getFormattedBalance()} TRUST`)
      .addText(text => text
        .setPlaceholder('0.001')
        .setValue(this.stakeAmount)
        .onChange(value => {
          this.stakeAmount = value;
          this.calculateImpact();
        }));

    // Position
    new Setting(section)
      .setName('Position')
      .addDropdown(dropdown => dropdown
        .addOption('for', 'For (agree with claim)')
        .addOption('against', 'Against (disagree with claim)')
        .setValue(this.position)
        .onChange((value: 'for' | 'against') => {
          this.position = value;
          this.calculateImpact();
        }));
  }

  private async calculateImpact(): Promise<void> {
    const amount = parseEther(this.stakeAmount || '0');

    if (amount <= 0n) {
      this.impact = null;
      this.renderImpact();
      return;
    }

    // Get vault data
    let forVault = this.draft.existingTriple?.forVault;
    let againstVault = this.draft.existingTriple?.againstVault;

    // For new claims, use empty vaults
    if (!forVault) {
      forVault = {
        id: '',
        totalAssets: 0n,
        totalShares: 0n,
        currentSharePrice: BigInt(1e18),
        positionCount: 0,
      };
    }
    if (!againstVault) {
      againstVault = {
        id: '',
        totalAssets: 0n,
        totalShares: 0n,
        currentSharePrice: BigInt(1e18),
        positionCount: 0,
      };
    }

    this.impact = this.impactCalculator.calculateImpact(
      forVault,
      againstVault,
      amount,
      this.position
    );

    // Build transaction plan
    this.plan = await this.plugin.transactionService.buildTransactionPlan(
      this.draft,
      { amount, position: this.position }
    );

    this.renderImpact();
    this.renderPlan();
  }

  private renderImpact(): void {
    this.impactEl.empty();

    if (!this.impact) return;

    this.impactEl.createEl('h4', { text: 'Impact Preview' });

    const grid = this.impactEl.createDiv({ cls: 'impact-grid' });

    // Consensus change
    const consensusRow = grid.createDiv({ cls: 'impact-row' });
    consensusRow.createSpan({ text: 'Consensus Change' });
    const change = this.impact.consensusChange;
    const changeText = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
    consensusRow.createSpan({
      text: `${this.impact.currentConsensus.toFixed(1)}% → ${this.impact.newConsensus.toFixed(1)}% (${changeText})`,
      cls: change >= 0 ? 'positive' : 'negative',
    });

    // Your shares
    const sharesRow = grid.createDiv({ cls: 'impact-row' });
    sharesRow.createSpan({ text: 'Your Shares' });
    sharesRow.createSpan({ text: formatEther(this.impact.yourShares) });

    // Ownership
    const ownershipRow = grid.createDiv({ cls: 'impact-row' });
    ownershipRow.createSpan({ text: 'Your Ownership' });
    ownershipRow.createSpan({ text: `${this.impact.yourOwnershipPercent.toFixed(4)}%` });

    // Exit value
    const exitRow = grid.createDiv({ cls: 'impact-row' });
    exitRow.createSpan({ text: 'Estimated Exit Value' });
    exitRow.createSpan({ text: `${formatEther(this.impact.estimatedExitValue)} TRUST` });
  }

  private renderPlan(): void {
    this.planEl.empty();

    if (!this.plan) return;

    this.planEl.createEl('h4', { text: 'Transaction Steps' });

    const list = this.planEl.createEl('ol', { cls: 'plan-steps' });

    for (const step of this.plan.steps) {
      const item = list.createEl('li');
      item.createSpan({ text: step.description });
    }

    // Total cost
    const costDiv = this.planEl.createDiv({ cls: 'total-cost' });
    costDiv.createSpan({ text: 'Total Cost (incl. fees): ' });
    costDiv.createSpan({
      text: `${formatEther(this.plan.totalCost)} TRUST`,
      cls: 'cost-amount',
    });
  }

  private renderActions(container: HTMLElement): void {
    const actions = container.createDiv({ cls: 'stake-actions' });

    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = actions.createEl('button', {
      text: 'Confirm & Sign',
      cls: 'mod-cta',
    });
    confirmBtn.addEventListener('click', () => this.executeStake());
  }

  private async executeStake(): Promise<void> {
    if (!this.plan) return;

    const amount = parseEther(this.stakeAmount || '0');
    if (amount <= 0n) {
      this.plugin.noticeManager.error('Invalid stake amount');
      return;
    }

    // Check wallet is unlocked
    if (!this.plugin.walletService.isUnlocked()) {
      this.plugin.noticeManager.error('Please unlock your wallet first');
      return;
    }

    // Check balance
    const balance = await this.plugin.walletService.refreshBalance();
    if (balance < this.plan.totalCost) {
      this.plugin.noticeManager.error('Insufficient balance');
      return;
    }

    // Execute
    this.plugin.noticeManager.info('Signing transactions...');

    const result = await this.plugin.transactionService.executeTransactionPlan(
      this.draft,
      { amount, position: this.position },
      this.plan,
      (step) => {
        // Update UI with step progress
        console.log('Step update:', step);
      }
    );

    if (result.success) {
      this.plugin.noticeManager.success('Claim published successfully!');

      // Annotate note if enabled
      if (this.plugin.settings.ui.annotateOnPublish && result.tripleId) {
        // Add comment to note
        // This would be implemented with editor API
      }

      this.close();
    } else {
      this.plugin.noticeManager.error(`Transaction failed: ${result.error}`);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

## CSS Styles (add to styles.css)

```css
/* Stake Modal */
.intuition-stake-modal {
  max-width: 500px;
}

.claim-summary {
  background: var(--background-secondary);
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.claim-summary .triple-display {
  font-family: monospace;
  font-size: 13px;
  margin: 0 0 8px 0;
}

.impact-section,
.plan-section {
  margin: 16px 0;
}

.impact-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.impact-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.impact-row .positive {
  color: var(--text-success);
}

.impact-row .negative {
  color: var(--text-error);
}

.plan-steps {
  padding-left: 20px;
  margin: 8px 0;
}

.plan-steps li {
  margin: 4px 0;
}

.total-cost {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--background-modifier-border);
  font-weight: 500;
}

.stake-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
```

## Acceptance Criteria
- [ ] Stake input validates against wallet balance
- [ ] Position toggle switches For/Against
- [ ] Impact preview updates on amount change
- [ ] Transaction plan shows all steps
- [ ] Total cost includes creation fees
- [ ] Transaction signing works
- [ ] Success shows confirmation
- [ ] Failures show clear error
- [ ] Note annotation works (if enabled)

## Testing
1. Open stake modal from claim modal
2. Enter stake amount - verify impact updates
3. Toggle position - verify impact changes
4. Verify transaction plan steps are correct
5. Execute with testnet wallet
6. Verify transaction confirms
7. Test with insufficient balance

## Estimated Effort
High - Full transaction lifecycle with calculations
