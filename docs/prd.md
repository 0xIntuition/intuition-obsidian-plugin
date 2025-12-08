# Obsidian + Intuition Plugin: Product Requirements Document

> **Document Purpose**: Comprehensive exploration of the design space for an Obsidian plugin integrating with Intuition Network’s decentralized knowledge graph. Includes hackathon MVP specification and future roadmap.

-----

## Executive Summary

**Product Vision**: Transform Obsidian from a personal knowledge management tool into a bidirectional interface with humanity’s shared knowledge graph. Users can enrich their notes with trust-weighted information from the public graph and contribute verified claims back—with economic stake signaling conviction.

**Core Value Propositions**:

1. **For the user**: Notes become “alive” with real-time trust signals from global consensus
1. **For the network**: High-quality claims from structured thinkers flow into the knowledge graph
1. **For the ecosystem**: Obsidian’s millions of users become potential Intuition contributors

**Hackathon MVP**: **Claim Publisher with Stake Preview**—select text, structure as Triple, preview economic impact, publish with stake.

-----

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
1. [Feature Catalog: Decorations](#2-feature-catalog-decorations)
1. [Feature Catalog: Publishing & Sharing](#3-feature-catalog-publishing--sharing)
1. [Feature Catalog: Graph Integration](#4-feature-catalog-graph-integration)
1. [Feature Catalog: Economics & Staking](#5-feature-catalog-economics--staking)
1. [Hackathon MVP Specification](#6-hackathon-mvp-specification)
1. [Future Roadmap](#7-future-roadmap)
1. [Technical Considerations](#8-technical-considerations)

-----

## 1. Architecture Overview

### 1.1 Offline-First Design

```
┌─────────────────────────────────────────────────────────────┐
│                      OBSIDIAN PLUGIN                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Local     │  │   Sync      │  │   Decoration        │ │
│  │   Cache     │◄─┤   Engine    │◄─┤   Renderer          │ │
│  │   (IndexedDB)│  │             │  │                     │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│                          │                                   │
│  ┌─────────────┐  ┌──────▼──────┐  ┌─────────────────────┐ │
│  │  Embedded   │  │   Intuition │  │   Claim             │ │
│  │  Wallet     │◄─┤   SDK       │◄─┤   Extractor         │ │
│  │  (ethers.js)│  │             │  │   (NLP/Patterns)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   INTUITION NETWORK                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  GraphQL    │  │  MultiVault │  │   IPFS              │ │
│  │  API        │  │  Contracts  │  │   (Metadata)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Principles

|Scenario     |Behavior                                               |
|-------------|-------------------------------------------------------|
|**Online**   |Real-time sync, live trust scores, immediate publishing|
|**Offline**  |Cached decorations, queued publishes, stale indicators |
|**Reconnect**|Background sync, conflict resolution, queue flush      |

### 1.3 Embedded Wallet Design

> **Note**: The @0xintuition/sdk uses **viem** for all wallet and blockchain operations.

```typescript
import { privateKeyToAccount, createWalletClient, createPublicClient, http } from 'viem'
import { intuitionTestnet, intuition } from '@0xintuition/protocol'

interface WalletConfig {
  // Encrypted private key stored in plugin settings
  encryptedKey: string;
  // Derived from user's vault password or separate PIN
  encryptionMethod: 'vault-password' | 'separate-pin' | 'biometric';
  // Network configuration
  chainId: number; // Intuition L3: 13579 (testnet) or 1155 (mainnet)
  rpcUrl: string;
}

// Creating wallet client with viem
const account = privateKeyToAccount(decryptedKey as `0x${string}`)
const chain = config.chainId === 13579 ? intuitionTestnet : intuition

const publicClient = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
})

const walletClient = createWalletClient({
  chain,
  transport: http(config.rpcUrl),
  account,
})
```

**Security Considerations**:

- Private key never leaves device
- Encryption at rest using Obsidian’s secure storage APIs
- Optional hardware wallet support for high-value operations
- Transaction signing requires explicit user confirmation

-----

## 2. Feature Catalog: Decorations

Decorations are visual overlays that enrich note content with information from the Intuition knowledge graph. All decorations should:

- Be toggleable (global and per-note settings)
- Degrade gracefully when offline (show cached or hide)
- Be non-destructive (don’t modify underlying markdown)

### 2.1 Entity Trust Scores

**Description**: Automatically detect mentions of entities (people, projects, protocols, companies) and display their aggregate trust score from Intuition.

**Visual Mockup**:

```markdown
# Research Notes: DeFi Protocols

I've been researching [[Uniswap]] [🟢 94% · $2.3M staked] and 
comparing it to [[SushiSwap]] [🟡 71% · $890K staked]. The founder 
[[Hayden Adams]] [🟢 89%] has been building in public since 2018.
```

**Trust Score Tiers**:

|Score Range|Indicator|Meaning                       |
|-----------|---------|------------------------------|
|80-100%    |🟢 Green  |High consensus trust          |
|60-79%     |🟡 Yellow |Moderate/contested trust      |
|40-59%     |🟠 Orange |Low trust or insufficient data|
|0-39%      |🔴 Red    |Negative consensus            |
|N/A        |⚪ Gray   |Not in knowledge graph        |

**Calculation Method**:

```
Trust Score = (For Vault TVL) / (For Vault TVL + Against Vault TVL) × 100
```

**Why Build This**: Transforms passive reading into active trust verification. Users develop intuition about which entities are community-validated vs. contested.

**Complexity**: Medium

- Requires entity recognition (can use simple bracket detection + fuzzy matching to Atoms)
- Requires caching strategy for offline support
- Requires efficient batch queries to avoid API rate limits

-----

### 2.2 Claim Existence Indicators

**Description**: Detect assertion-like sentences in notes and indicate whether they exist as Triples in the public graph.

**Visual Mockup**:

```markdown
## My Analysis

Ethereum uses proof-of-stake consensus. [✓ Verified · 1.2K stakers]

Solana processes 65,000 TPS. [⚠ Contested · 234 For / 189 Against]

Cardano will flip Ethereum by 2025. [✗ Not in graph]

Bitcoin was created by Craig Wright. [✗ Disputed · 12 For / 8.9K Against]
```

**Indicator Types**:

|Icon|State    |Meaning                                     |
|----|---------|--------------------------------------------|
|✓   |Verified |Claim exists with strong positive consensus |
|⚠   |Contested|Claim exists but consensus is mixed         |
|✗   |Disputed |Claim exists with strong negative consensus |
|○   |Unstaked |Claim exists but has minimal economic signal|
|·   |Not found|No matching claim in knowledge graph        |

**Matching Strategy**:

1. Extract subject-predicate-object from sentence (NLP or pattern matching)
1. Fuzzy match each component to existing Atoms
1. Search for matching Triple
1. Return stake status if found

**Why Build This**: Users can instantly see which of their notes align with or contradict public consensus. Encourages critical thinking and fact-verification.

**Complexity**: High

- Requires robust claim extraction (NLP is imperfect)
- False positive/negative management
- Performance optimization for long documents

-----

### 2.3 Source Credibility Badges

**Description**: When notes contain URLs or citations, show the source’s trust score from Intuition.

**Visual Mockup**:

```markdown
## Sources

- [Vitalik's Blog](https://vitalik.eth.limo) [🟢 Trusted Source · 97%]
- [CoinDesk Article](https://coindesk.com/...) [🟡 News Outlet · 68%]  
- [Random Medium Post](https://medium.com/...) [⚪ Unknown Source]
- [Known Scam Site](https://example-scam.com) [🔴 Flagged · 3%]
```

**Why Build This**: Immediate credibility signal for sources without leaving the note. Particularly valuable for research workflows.

**Complexity**: Low-Medium

- URL extraction is straightforward
- Requires mapping URLs to Atoms (may need heuristics for domain-level scoring)

-----

### 2.4 Inline Confidence Annotations

**Description**: Allow users to annotate their own confidence in claims using a syntax that maps to Intuition’s staking model.

**Syntax Options**:

```markdown
<!-- Option A: Percentage syntax -->
The merge will reduce ETH issuance by 90%. {{confidence: 85%}}

<!-- Option B: Stake syntax -->
Arbitrum has lower fees than Optimism. {{stake: 0.1 ETH}}

<!-- Option C: Emoji shorthand -->
GPT-5 will be released in 2024. 🎯70%

<!-- Option D: Callout blocks -->
> [!claim|confidence:high]
> Zero-knowledge proofs will be standard in all L2s by 2026.
```

**Decoration Rendering**:

- Shows user’s confidence alongside public consensus
- Visual diff when user disagrees with consensus
- Prompt to publish if user has high confidence but claim doesn’t exist

**Why Build This**: Externalizes the user’s mental model of certainty. Creates a pipeline for publishing well-considered claims.

**Complexity**: Low

- Syntax parsing is deterministic
- Rendering is straightforward
- Good foundation for publishing features

-----

### 2.5 Knowledge Graph Hover Cards

**Description**: Hovering over any decorated entity shows a rich card with full Intuition data.

**Hover Card Contents**:

```
┌────────────────────────────────────────┐
│ 🔷 Ethereum                            │
│ ─────────────────────────────────────  │
│ Trust Score: 94% (🟢 High Consensus)   │
│ Total Staked: $2.3M across 12.4K users │
│ ─────────────────────────────────────  │
│ Top Claims:                            │
│ • [is] [Blockchain Platform] - 98%     │
│ • [uses] [Proof of Stake] - 96%        │
│ • [created by] [Vitalik Buterin] - 94% │
│ ─────────────────────────────────────  │
│ Your Position: 0.05 ETH staked (For)   │
│ ─────────────────────────────────────  │
│ [View in Explorer] [Stake More] [Copy] │
└────────────────────────────────────────┘
```

**Why Build This**: Provides depth without cluttering the note. Users can explore without context-switching to browser.

**Complexity**: Medium

- Rich data fetching
- Performant hover state management
- Caching for responsiveness

-----

### 2.6 Relationship Path Indicators

**Description**: When two entities appear in the same note, show how they’re connected in the knowledge graph.

**Visual Mockup**:

```markdown
Comparing [[Vitalik Buterin]] and [[Gavin Wood]]:

[Path: Vitalik —[co-founded]→ Ethereum ←[co-founded]— Gavin]
[Path: Vitalik —[knows]→ Gavin (direct)]
```

**Why Build This**: Surfaces non-obvious relationships. Valuable for research and due diligence workflows.

**Complexity**: High

- Requires graph traversal queries
- Path-finding algorithms
- Visualization of multi-hop relationships

-----

### 2.7 Temporal Trust Evolution

**Description**: Show how trust scores have changed over time with inline sparklines.

**Visual Mockup**:

```markdown
[[FTX]] [🔴 2% ▂▃▅▇▅▂▁ -94% from peak]
[[Ethereum]] [🟢 94% ▅▅▆▆▇▇█ +12% this year]
```

**Why Build This**: Trust isn’t static. Historical context reveals whether an entity is rising or falling in community estimation.

**Complexity**: Medium-High

- Requires historical data queries
- Sparkline rendering
- Efficient data aggregation

-----

### 2.8 Decoration Summary Dashboard

**Description**: A sidebar panel summarizing all decorated content in the current note.

**Dashboard Contents**:

- Total entities detected: 23
- Verified claims: 8
- Contested claims: 3
- Unknown entities: 12
- Aggregate note “trust score”
- Quick actions: Verify all, Publish selected

**Why Build This**: Overview without scrolling through entire document. Entry point for bulk actions.

**Complexity**: Medium

- Aggregation logic
- Sidebar UI in Obsidian
- State management

-----

## 3. Feature Catalog: Publishing & Sharing

Publishing features enable users to contribute claims from their notes to the Intuition knowledge graph.

### 3.1 Manual Claim Selection & Publishing

**Description**: Select text, invoke command, structure as Triple, preview impact, publish with stake.

**User Flow**:

```
1. Select text: "Ethereum uses proof-of-stake"
2. Invoke command: Ctrl+Shift+P → "Publish to Intuition"
3. Structuring modal appears:
   ┌─────────────────────────────────────────────┐
   │ 📤 Publish Claim to Intuition               │
   ├─────────────────────────────────────────────┤
   │ Selected text:                              │
   │ "Ethereum uses proof-of-stake"              │
   │                                             │
   │ Structured as Triple:                       │
   │ Subject:   [Ethereum    ▼] ← dropdown/search│
   │ Predicate: [uses        ▼]                  │
   │ Object:    [Proof of Stake ▼]               │
   │                                             │
   │ ─────────────────────────────────────────── │
   │ Status: ✓ This exact claim exists           │
   │         Currently: 89% For ($1.2M staked)   │
   │                                             │
   │ Your stake: [0.01 ETH ▼]                    │
   │ Position:   (●) For  ( ) Against            │
   │                                             │
   │ Impact Preview:                             │
   │ • New consensus: 89% → 89.1%                │
   │ • Your share: 0.0012% of For vault          │
   │ • Est. fees earned: $0.02/month at current  │
   │   activity                                  │
   │                                             │
   │ [Cancel]              [Preview Tx] [Publish]│
   └─────────────────────────────────────────────┘
4. User clicks Publish
5. Transaction confirmation
6. Note is annotated with published claim reference
```

**Why Build This**: Core publishing primitive. Every other publishing feature builds on this.

**Complexity**: Medium

- Triple structuring UI
- Atom search/create
- Transaction building and signing
- State updates post-publish

-----

### 3.2 Structured Claim Syntax

**Description**: Define claims inline using a consistent syntax that the plugin auto-detects and can publish.

**Syntax Options**:

```markdown
<!-- Option A: Triple block -->
```triple
subject: Ethereum
predicate: created by
object: Vitalik Buterin
confidence: high
status: draft
```

<!-- Option B: Inline syntax -->

::claim[Ethereum | uses | Proof of Stake]{confidence=high}

<!-- Option C: Wikilink extension -->

[[Ethereum]] →[[uses]]→ [[Proof of Stake]] #claim

<!-- Option D: Frontmatter claims -->

-----

claims:

- subject: Ethereum
  predicate: uses
  object: Proof of Stake
  published: false
  stake: 0.01

-----

```
**Plugin Behavior**:
- Syntax highlighting for claim blocks
- Validation (are these valid Atoms?)
- Status indicators (draft/published/staked)
- Quick publish from claim block

**Why Build This**: Power users can batch-author claims. Explicit structure reduces NLP ambiguity.

**Complexity**: Medium
- Custom syntax parsing
- CodeMirror extensions for highlighting
- State tracking per claim

---

### 3.3 Auto-Extraction with Confirmation

**Description**: Plugin automatically extracts potential claims from freeform text, presents them for review, user confirms which to publish.

**User Flow**:
```

1. User writes normally in their note
1. Invoke command: “Extract Claims from Note”
1. Extraction panel appears:
   ┌─────────────────────────────────────────────┐
   │ 🔍 Extracted Claims (12 found)              │
   ├─────────────────────────────────────────────┤
   │ ☑ “Ethereum uses proof-of-stake”            │
   │   → [Ethereum] [uses] [Proof of Stake]      │
   │   Confidence: High (clear assertion)        │
   │                                             │
   │ ☑ “Vitalik created Ethereum”                │
   │   → [Vitalik Buterin] [created] [Ethereum]  │
   │   Confidence: High                          │
   │                                             │
   │ ☐ “Solana might be faster”                  │
   │   → [Solana] [is] [Fast] (?)                │
   │   Confidence: Low (hedged language)         │
   │                                             │
   │ ☐ “I think Layer 2s are the future”         │
   │   → Skipped (opinion, first-person)         │
   │                                             │
   │ [Select All] [Clear] [Publish Selected (2)] │
   └─────────────────────────────────────────────┘

```
**Extraction Heuristics**:
- Skip first-person statements ("I think...")
- Skip hedged language ("might", "could", "possibly")
- Skip questions
- Prioritize declarative statements with named entities
- Use sentence structure patterns (Subject-Verb-Object)

**Why Build This**: Lowers friction for publishing. Users write naturally, claims are extracted.

**Complexity**: High
- NLP/pattern matching for extraction
- Confidence scoring
- Batch review UI
- False positive management

---

### 3.4 Folder/Tag-Based Publishing Rules

**Description**: Configure automatic publishing rules based on folder location or tags.

**Configuration UI**:
```yaml
# In plugin settings or .obsidian/intuition-rules.yaml
publishing_rules:
  - name: "Verified Research"
    trigger:
      folder: "Research/Verified"
      tags: ["#verified", "#fact"]
    action:
      auto_extract: true
      require_confirmation: true
      default_stake: 0.001
      
  - name: "Quick Claims"
    trigger:
      tags: ["#claim"]
    action:
      auto_publish: true  # No confirmation
      default_stake: 0.0001
```

**Why Build This**: Power users can create workflows. “Move to Verified folder” triggers publishing.

**Complexity**: Medium

- Rule engine
- File system watchers
- Tag detection

-----

### 3.5 Claim Templates

**Description**: Pre-defined templates for common claim types.

**Template Examples**:

```markdown
<!-- Template: Person-Role-Organization -->
[[{{person}}]] →[[works at]]→ [[{{organization}}]] as [[{{role}}]]

<!-- Template: Project-Category -->
[[{{project}}]] →[[is a]]→ [[{{category}}]]

<!-- Template: Source-States-Claim -->
[[{{source}}]] →[[states]]→ [[{{claim}}]]
```

**Why Build This**: Consistency in claim structure. Faster authoring for common patterns.

**Complexity**: Low

- Template syntax
- Variable substitution
- Template library management

-----

### 3.6 Publish Queue (Offline Support)

**Description**: When offline, claims queue locally and publish when connection restored.

**Queue UI**:

```
┌─────────────────────────────────────────────┐
│ 📤 Publish Queue (3 pending)                │
├─────────────────────────────────────────────┤
│ ⏳ [Ethereum] [uses] [Proof of Stake]       │
│    Stake: 0.01 ETH · Queued: 2 hours ago    │
│    [Cancel] [Edit]                          │
│                                             │
│ ⏳ [Uniswap] [is a] [DEX]                   │
│    Stake: 0.001 ETH · Queued: 1 hour ago    │
│    [Cancel] [Edit]                          │
│                                             │
│ ⚠️ [New Token] [is a] [Scam]                │
│    Error: Atom "New Token" doesn't exist    │
│    [Create Atom & Retry] [Edit] [Cancel]    │
│                                             │
│ Status: Offline · Will sync when connected  │
└─────────────────────────────────────────────┘
```

**Why Build This**: Essential for offline-first. Users shouldn’t lose work due to connectivity.

**Complexity**: Medium

- Queue persistence
- Retry logic
- Conflict resolution
- Error handling

-----

### 3.7 Collaborative Review Before Publishing

**Description**: Share draft claims with trusted reviewers before publishing to the public graph.

**Flow**:

1. User marks claims as “Ready for Review”
1. Generates shareable link or exports to shared Obsidian vault
1. Reviewers comment/approve
1. User publishes approved claims

**Why Build This**: Quality control for important claims. Particularly valuable for research teams.

**Complexity**: High

- Sharing mechanism
- Review state tracking
- Multi-user coordination

-----

## 4. Feature Catalog: Graph Integration

Features that connect Obsidian’s local graph view with Intuition’s public knowledge graph.

### 4.1 Hybrid Graph View

**Description**: Overlay Intuition’s knowledge graph onto Obsidian’s local graph view.

**Visual Concept**:

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID GRAPH VIEW                        │
│                                                             │
│     [Your Notes]              [Public Graph]                │
│         ●───────────────────────────●                       │
│        /│\                         /│\                      │
│       / │ \    ← Shared Atoms →   / │ \                     │
│      ●  ●  ●                     ●  ●  ●                    │
│     Your    Your                Public Public               │
│     Note    Note                Claims Claims               │
│                                                             │
│  Legend:                                                    │
│  ● Blue = Your notes                                        │
│  ● Green = Public atoms (matched)                           │
│  ● Gray = Public atoms (unmatched)                          │
│  ─── Solid = Your links                                     │
│  --- Dashed = Public relationships                          │
└─────────────────────────────────────────────────────────────┘
```

**Features**:

- Toggle public graph overlay on/off
- Filter by trust score threshold
- Highlight entities that appear in both
- Show “expansion opportunities” (public connections to your entities)

**Why Build This**: Visual discovery of how your knowledge connects to public consensus. Reveals blind spots.

**Complexity**: Very High

- Graph rendering customization
- Data merging algorithms
- Performance with large graphs
- Obsidian graph view API limitations

-----

### 4.2 “Expand from Public Graph” Command

**Description**: Select an entity in your note, fetch related claims from Intuition, optionally import into your vault.

**User Flow**:

```
1. Right-click on [[Ethereum]]
2. Select "Expand from Intuition"
3. Panel shows related public claims:
   ┌─────────────────────────────────────────────┐
   │ 🔍 Public Claims about Ethereum (47 found)  │
   ├─────────────────────────────────────────────┤
   │ Filter: [Top 10 by stake ▼] [All predicates]│
   │                                             │
   │ ☐ [Ethereum] [uses] [Proof of Stake] 96%    │
   │ ☐ [Ethereum] [created by] [Vitalik] 94%     │
   │ ☐ [Ethereum] [is a] [Smart Contract Platform]│
   │ ☐ [Ethereum] [competes with] [Solana] 78%   │
   │ ...                                         │
   │                                             │
   │ [Import Selected as Notes] [Copy as List]   │
   └─────────────────────────────────────────────┘
```

**Import Options**:

- Create linked notes for each claim
- Append to current note as list
- Create a “Research: Ethereum” note with all claims

**Why Build This**: Public knowledge as research starting point. Accelerates learning about new topics.

**Complexity**: Medium

- GraphQL queries
- Import formatting
- Note creation automation

-----

### 4.3 Backlink from Public Graph

**Description**: Show which public claims reference entities in your notes (reverse lookup).

**Example**:

```
Your note: [[Vitalik Buterin]]

Public Backlinks (23 claims reference this entity):
• [Vitalik Buterin] [created] [Ethereum] - 94%
• [Vitalik Buterin] [advises] [Gitcoin] - 87%
• [Vitalik Buterin] [authored] [EIP-1559] - 91%
• [Vitalik Buterin] [is a] [Thought Leader] - 82%
```

**Why Build This**: Discover what the world knows about entities you’re researching.

**Complexity**: Medium

- Reverse queries by object
- Efficient caching
- UI integration with Obsidian’s backlinks panel

-----

### 4.4 Graph Diff: Your Notes vs. Public Consensus

**Description**: Identify where your notes contradict or extend public consensus.

**Diff Report**:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Knowledge Diff Report                                    │
├─────────────────────────────────────────────────────────────┤
│ AGREEMENTS (your notes align with public consensus):        │
│ ✓ Ethereum uses Proof of Stake (you: ✓, public: 96%)       │
│ ✓ Bitcoin created by Satoshi (you: ✓, public: 99%)         │
│                                                             │
│ CONTRADICTIONS (you disagree with consensus):               │
│ ⚠ Solana is decentralized (you: ✓, public: 34% Against)    │
│   → Consider reviewing or publishing counter-evidence       │
│                                                             │
│ UNIQUE TO YOU (not in public graph):                        │
│ + "Project X will launch in Q2" - consider publishing?      │
│ + "Team Y is building on Ethereum" - consider publishing?   │
│                                                             │
│ MISSING FROM YOUR NOTES (high-consensus public claims):     │
│ - Ethereum has EIP-1559 (public: 94%) - worth noting?       │
└─────────────────────────────────────────────────────────────┘
```

**Why Build This**: Meta-cognition tool. Shows blind spots and potential contributions.

**Complexity**: High

- Claim extraction from notes
- Semantic matching
- Diff algorithm
- Actionable recommendations

-----

### 4.5 “Why Trust This?” Provenance Explorer

**Description**: For any decorated claim, show the full provenance—who staked, when, how much.

**Provenance Panel**:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Provenance: [Ethereum] [uses] [Proof of Stake]          │
├─────────────────────────────────────────────────────────────┤
│ Current Consensus: 96% For                                  │
│ Total Staked: $1.2M (For: $1.15M | Against: $50K)          │
│                                                             │
│ Top Stakers (For):                                          │
│ • 0x1234...abcd - $50K - Staked 2023-09-15                 │
│   └─ Also staked on: 47 other Ethereum claims (92% acc)    │
│ • 0x5678...efgh - $30K - Staked 2023-11-02                 │
│ • vitalik.eth - $25K - Staked 2024-01-10                   │
│                                                             │
│ Recent Activity:                                            │
│ • +$5K staked (For) - 2 hours ago                          │
│ • -$1K redeemed (Against) - 1 day ago                      │
│                                                             │
│ Historical Consensus: [Sparkline showing 96%→94%→96%]      │
└─────────────────────────────────────────────────────────────┘
```

**Why Build This**: Transparency into why a claim has its trust score. Essential for critical evaluation.

**Complexity**: Medium-High

- Detailed GraphQL queries
- Staker profile aggregation
- Historical data

-----

## 5. Feature Catalog: Economics & Staking

Features related to economic participation in the knowledge graph.

### 5.1 Stake Preview & Impact Calculator

**Description**: Before any staking action, show detailed impact preview.

**Preview Panel**:

```
┌─────────────────────────────────────────────────────────────┐
│ 💰 Stake Impact Preview                                     │
├─────────────────────────────────────────────────────────────┤
│ Action: Stake 0.1 ETH FOR [Ethereum] [uses] [PoS]          │
│                                                             │
│ BEFORE YOUR STAKE:                                          │
│ • For Vault: $1,150,000 (2,340 stakers)                    │
│ • Against Vault: $50,000 (89 stakers)                      │
│ • Consensus: 95.8%                                          │
│ • Share Price: 1.0234 ETH/share                            │
│                                                             │
│ AFTER YOUR STAKE:                                           │
│ • For Vault: $1,150,350 (+$350)                            │
│ • Consensus: 95.82% (+0.02%)                               │
│ • Your Shares: 0.0976 (worth 0.0999 ETH at current price)  │
│ • Your Ownership: 0.03% of For vault                       │
│                                                             │
│ PROJECTED RETURNS (based on 30-day activity):               │
│ • If activity continues: ~$0.12/month in fees              │
│ • Break-even: ~29 months at current activity               │
│                                                             │
│ RISKS:                                                      │
│ • If consensus flips, your position loses value            │
│ • Bonding curve means exit price may differ                │
│                                                             │
│ [Cancel]                    [Confirm Stake: 0.1 ETH]       │
└─────────────────────────────────────────────────────────────┘
```

**Why Build This**: Informed economic decisions. Core to “understand impact before interaction” requirement.

**Complexity**: Medium

- Share price calculations
- Fee projections
- Risk modeling

-----

### 5.2 Portfolio Dashboard

**Description**: Overview of all your staked positions across the knowledge graph.

**Dashboard**:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Your Intuition Portfolio                                 │
├─────────────────────────────────────────────────────────────┤
│ Total Value: 2.34 ETH ($8,190)                             │
│ Total Claims Staked: 47                                     │
│ P&L (30d): +0.12 ETH (+5.4%)                               │
│                                                             │
│ TOP POSITIONS:                                              │
│ ├─ [Ethereum] [uses] [PoS] - 0.5 ETH - +12%               │
│ ├─ [Bitcoin] [is] [Store of Value] - 0.3 ETH - +8%        │
│ ├─ [Uniswap] [is a] [DEX] - 0.2 ETH - +3%                 │
│ └─ [View all 47 positions...]                              │
│                                                             │
│ ALERTS:                                                     │
│ ⚠ [Solana] [is] [Decentralized] consensus dropped to 34%   │
│ ✓ [Arbitrum] [is a] [L2] reached 90% consensus             │
│                                                             │
│ ACTIONS:                                                    │
│ [Rebalance] [Export CSV] [Set Alerts]                      │
└─────────────────────────────────────────────────────────────┘
```

**Why Build This**: Portfolio management for knowledge graph participants. Track economic positions.

**Complexity**: Medium

- Position aggregation
- P&L calculations
- Alert system

-----

### 5.3 Auto-Staking Rules

**Description**: Automatically stake on claims matching certain criteria.

**Rule Configuration**:

```yaml
auto_stake_rules:
  - name: "Support my published claims"
    trigger:
      type: "self_published"
    action:
      stake: 0.001 ETH
      position: for
      
  - name: "Follow trusted curators"
    trigger:
      type: "staked_by"
      addresses: ["vitalik.eth", "0x1234..."]
    action:
      stake: 0.0001 ETH
      position: same_as_trigger
      max_daily: 0.01 ETH
```

**Why Build This**: Automated curation based on trusted sources. “Copy trading” for knowledge.

**Complexity**: High

- Event monitoring
- Rule execution engine
- Budget management
- Risk controls

-----

### 5.4 Stake from Highlight

**Description**: Quick staking directly from highlighted text in notes.

**User Flow**:

```
1. Highlight text containing a claim
2. Right-click → "Quick Stake"
3. Mini-popup appears:
   ┌──────────────────────────┐
   │ Quick Stake              │
   │ [Ethereum uses PoS]      │
   │ [0.001 ▼] [For ●][Against○]│
   │ [Stake] [Full Preview]   │
   └──────────────────────────┘
4. One-click stake or expand to full preview
```

**Why Build This**: Minimal friction for quick stakes. Good for rapid curation workflows.

**Complexity**: Low

- Context menu integration
- Mini-UI component
- Transaction shortcut

-----

### 5.5 Claim Bounties

**Description**: Set bounties for claims you want verified. Others earn by staking with evidence.

**Bounty Creation**:

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Create Verification Bounty                               │
├─────────────────────────────────────────────────────────────┤
│ Claim to verify:                                            │
│ "Compound has never been exploited"                         │
│                                                             │
│ Bounty amount: [0.1 ETH]                                    │
│ Expires: [7 days ▼]                                         │
│ Minimum stake to claim: [0.01 ETH]                         │
│                                                             │
│ Reward distribution:                                        │
│ • First to stake For/Against with evidence: 50%            │
│ • Top 5 subsequent stakers: 50% (split)                    │
│                                                             │
│ [Cancel]                    [Create Bounty: 0.1 ETH]       │
└─────────────────────────────────────────────────────────────┘
```

**Why Build This**: Incentivize verification of specific claims. Useful for due diligence.

**Complexity**: High

- Custom smart contract or protocol extension
- Bounty state management
- Distribution logic

-----

## 6. Hackathon MVP Specification

### 6.1 Recommended MVP: Claim Publisher with Stake Preview

**Why This Feature**:

1. **Demonstrates Intuition’s unique value**: Semantic claims + economic staking in one flow
1. **Complete user journey**: Extract → Structure → Preview → Publish → Confirm
1. **Strong demo potential**: Live publishing during presentation creates “wow”
1. **Actually useful post-hackathon**: You’ll use this for your own notes
1. **Reasonable scope**: Achievable in 48 hours with focused execution

### 6.2 MVP Feature Specification

#### Core User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      MVP USER FLOW                          │
└─────────────────────────────────────────────────────────────┘

Step 1: SELECT TEXT
┌─────────────────────────────────────────────────────────────┐
│ # My Research Notes                                         │
│                                                             │
│ After researching the merge, I believe that                 │
│ [████████████████████████████████████]  ← User selects     │
│  "Ethereum uses proof-of-stake consensus"                   │
│                                                             │
│ This has significant implications for...                    │
└─────────────────────────────────────────────────────────────┘

Step 2: INVOKE COMMAND
• Keyboard shortcut: Ctrl/Cmd + Shift + I
• Right-click context menu: "Publish to Intuition"
• Command palette: "Intuition: Publish Claim"

Step 3: CLAIM STRUCTURING MODAL
┌─────────────────────────────────────────────────────────────┐
│ 📤 Publish Claim to Intuition                         [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ SELECTED TEXT                                               │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ "Ethereum uses proof-of-stake consensus"                ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ STRUCTURE AS TRIPLE                                         │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Subject:   [🔍 Ethereum                    ▼] [+ New]   ││
│ │            ✓ Matched: Ethereum (Atom #1234)             ││
│ │                                                         ││
│ │ Predicate: [🔍 uses                        ▼] [+ New]   ││
│ │            ✓ Matched: uses (Atom #5678)                 ││
│ │                                                         ││
│ │ Object:    [🔍 Proof of Stake              ▼] [+ New]   ││
│ │            ✓ Matched: Proof of Stake (Atom #9012)       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ CLAIM STATUS                                                │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ✓ This exact claim EXISTS in the knowledge graph        ││
│ │                                                         ││
│ │ Current State:                                          ││
│ │ • Consensus: 96.2% For                                  ││
│ │ • For Vault:  $1,234,567 (2,341 stakers)               ││
│ │ • Against:    $48,293 (127 stakers)                    ││
│ │ • Share Price: 1.0847 ETH                              ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ YOUR STAKE                                                  │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Amount: [0.01      ] ETH    Balance: 0.5 ETH           ││
│ │                                                         ││
│ │ Position: (●) For    ( ) Against                       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ IMPACT PREVIEW                                              │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ After your stake:                                       ││
│ │ • New Consensus: 96.2% → 96.21% (+0.01%)               ││
│ │ • Your Shares: 0.00921 (0.0008% of For vault)          ││
│ │ • Est. Monthly Fees: ~$0.02 at current activity        ││
│ │                                                         ││
│ │ ⚠️ Note: Share price may change before tx confirms     ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ [Cancel]              [Preview Transaction]   [Publish] ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

Step 4: TRANSACTION CONFIRMATION (if user clicks Preview)
┌─────────────────────────────────────────────────────────────┐
│ 🔐 Confirm Transaction                                [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Action: Deposit to Triple Vault (For)                       │
│ Triple: [Ethereum] [uses] [Proof of Stake]                 │
│                                                             │
│ Transaction Details:                                        │
│ • Amount: 0.01 ETH                                         │
│ • Est. Gas: 0.0003 ETH (~$1.05)                           │
│ • Total: 0.0103 ETH                                        │
│                                                             │
│ From Wallet: 0x1234...abcd                                  │
│ Network: Intuition Testnet (Chain ID: 13579)               │
│                                                             │
│ [Cancel]                              [Sign & Send]        │
└─────────────────────────────────────────────────────────────┘

Step 5: SUCCESS STATE
┌─────────────────────────────────────────────────────────────┐
│ ✅ Claim Published Successfully!                       [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Your stake of 0.01 ETH has been deposited.                 │
│                                                             │
│ Transaction: 0xabcd...1234                                  │
│ [View on Explorer]                                          │
│                                                             │
│ ☑ Add reference to note                                    │
│   (Inserts: <!-- intuition:triple:0x... -->)               │
│                                                             │
│ [Close]                              [Stake on Another]    │
└─────────────────────────────────────────────────────────────┘
```

#### MVP Feature Breakdown

|Component                  |Priority|Complexity|Notes                     |
|---------------------------|--------|----------|--------------------------|
|Text selection detection   |P0      |Low       |Use Obsidian’s editor API |
|Command registration       |P0      |Low       |Standard plugin API       |
|Claim structuring modal    |P0      |Medium    |Main UI component         |
|Atom search/autocomplete   |P0      |Medium    |Query existing Atoms      |
|Atom creation (inline)     |P1      |Medium    |Create new Atoms if needed|
|Claim existence check      |P0      |Medium    |GraphQL query for Triple  |
|Current state display      |P0      |Medium    |Vault TVL, consensus      |
|Stake amount input         |P0      |Low       |Form field with validation|
|Position selection         |P0      |Low       |Radio buttons             |
|Impact preview calculation |P0      |Medium    |Share price math          |
|Embedded wallet integration|P0      |High      |Key storage, signing      |
|Transaction building       |P0      |Medium    |Using Intuition SDK       |
|Transaction confirmation   |P0      |Medium    |Separate modal            |
|Success state handling     |P0      |Low       |Update note, show link    |
|Error handling             |P0      |Medium    |Network, validation errors|
|Offline queue (basic)      |P2      |Medium    |Store pending, retry      |

#### Tech Stack

```typescript
// Core dependencies
{
  "dependencies": {
    "obsidian": "latest",                        // Obsidian plugin API
    "@0xintuition/sdk": "2.0.0-alpha.4",         // Intuition SDK (uses viem internally)
    "@0xintuition/graphql": "2.0.0-alpha.4",     // GraphQL queries
    "@0xintuition/protocol": "2.0.0-alpha.4",    // Protocol constants & chain configs
    "viem": "^2.0.0",                            // Wallet operations
    "idb": "^7.0.0"                              // IndexedDB for caching
  }
}
```

#### Data Models

```typescript
interface ClaimDraft {
  id: string;
  sourceText: string;
  sourceFile: string;
  sourcePosition: { start: number; end: number };
  
  subject: AtomReference | null;
  predicate: AtomReference | null;
  object: AtomReference | null;
  
  existingTriple: TripleInfo | null;
  
  stakeAmount: bigint;
  position: 'for' | 'against';
  
  status: 'draft' | 'pending' | 'published' | 'failed';
  transactionHash?: string;
  error?: string;
}

interface AtomReference {
  type: 'existing' | 'new';
  atomId?: string;        // If existing
  label: string;
  searchQuery: string;
  confidence: number;     // Match confidence
}

interface TripleInfo {
  tripleId: string;
  forVault: VaultInfo;
  againstVault: VaultInfo;
  consensus: number;
}

interface VaultInfo {
  totalAssets: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  stakerCount: number;
}

interface ImpactPreview {
  currentConsensus: number;
  newConsensus: number;
  yourShares: bigint;
  yourOwnership: number;
  estimatedMonthlyFees: bigint;
}
```

#### Key Algorithms

**1. Claim Auto-Structuring**

```typescript
function extractTripleFromText(text: string): TripleSuggestion {
  // Simple heuristic approach (can enhance with NLP later)
  
  // Pattern 1: "X is Y" / "X is a Y"
  const isPattern = /^(.+?)\s+is\s+(?:a\s+)?(.+)$/i;
  
  // Pattern 2: "X uses Y" / "X has Y" / "X [verb] Y"
  const verbPattern = /^(.+?)\s+(uses|has|creates|enables|provides|supports)\s+(.+)$/i;
  
  // Pattern 3: "X created by Y" / "X founded by Y"
  const passivePattern = /^(.+?)\s+(created|founded|built|made)\s+by\s+(.+)$/i;
  
  // Try patterns in order, return best match with confidence
  // ...
}
```

**2. Impact Preview Calculation**

```typescript
function calculateImpactPreview(
  vault: VaultInfo,
  stakeAmount: bigint,
  position: 'for' | 'against',
  opposingVault: VaultInfo
): ImpactPreview {
  // Calculate shares received using bonding curve
  const newShares = calculateSharesFromDeposit(vault, stakeAmount);
  
  // Calculate new consensus
  const newForTotal = position === 'for' 
    ? vault.totalAssets + stakeAmount 
    : vault.totalAssets;
  const newAgainstTotal = position === 'against'
    ? opposingVault.totalAssets + stakeAmount
    : opposingVault.totalAssets;
  const newConsensus = Number(newForTotal) / Number(newForTotal + newAgainstTotal);
  
  // Calculate ownership percentage
  const newTotalShares = vault.totalShares + newShares;
  const ownership = Number(newShares) / Number(newTotalShares);
  
  // Estimate fees (based on 30-day trailing activity)
  const estimatedMonthlyFees = estimateMonthlyFees(vault, ownership);
  
  return { /* ... */ };
}
```

### 6.3 MVP Development Timeline (48 hours)

```
HOUR 0-4: SETUP & SCAFFOLD
├── Initialize Obsidian plugin project
├── Set up TypeScript config
├── Install dependencies (SDK, GraphQL, ethers)
├── Create basic plugin structure
└── Test hot reload working

HOUR 4-10: CORE INFRASTRUCTURE
├── Implement embedded wallet
│   ├── Key generation/import
│   ├── Secure storage
│   └── Basic signing
├── Set up Intuition SDK connection
├── Implement GraphQL client with caching
└── Create basic IndexedDB storage

HOUR 10-18: MAIN UI
├── Create claim structuring modal
│   ├── Text display
│   ├── Subject/Predicate/Object inputs
│   └── Atom search autocomplete
├── Implement Triple existence check
├── Build stake input section
└── Create impact preview component

HOUR 18-26: TRANSACTION FLOW
├── Implement transaction building
├── Create confirmation modal
├── Handle transaction signing
├── Implement success/error states
└── Add note annotation on success

HOUR 26-34: POLISH & EDGE CASES
├── Error handling (network, validation)
├── Loading states
├── Keyboard navigation
├── Mobile/responsive considerations
└── Empty states

HOUR 34-42: TESTING & DEMO PREP
├── End-to-end testing
├── Fix critical bugs
├── Prepare demo script
├── Create sample notes for demo
└── Record backup video

HOUR 42-48: BUFFER & PRESENTATION
├── Final bug fixes
├── Presentation practice
├── Documentation
└── Sleep before demo
```

### 6.4 Demo Script

```
DEMO FLOW (3 minutes)

[0:00-0:30] PROBLEM STATEMENT
"Every day, we write notes full of claims and facts. But they live 
in isolation—no one can verify them, no one can build on them, and 
we can't see if they align with what the world knows."

[0:30-1:00] SHOW THE SOLUTION
"I built an Obsidian plugin that connects your personal notes to 
Intuition's public knowledge graph. Watch this."

[Open Obsidian with prepared note]

[1:00-2:00] LIVE DEMO
1. Show a note with research content
2. Select text: "Ethereum uses proof-of-stake"
3. Invoke command (Ctrl+Shift+I)
4. Show modal:
   - "The plugin automatically structures this as a semantic triple"
   - "It found this claim already exists—96% consensus, $1.2M staked"
   - "I'll stake 0.01 ETH to add my signal"
5. Show impact preview:
   - "Before I stake, I can see exactly what impact I'll have"
6. Click Publish
7. Show success:
   - "Done. My notes are now connected to global knowledge."

[2:00-2:30] VISION
"This is just the beginning. Imagine every researcher, every analyst, 
every curious person contributing verified claims from their notes. 
We're building a Wikipedia where every fact has economic stake behind it."

[2:30-3:00] TECHNICAL HIGHLIGHTS
"Built with Intuition's SDK, embedded wallet for seamless UX, 
offline-first architecture. The code will be open source."
```

-----

## 7. Future Roadmap

### Phase 1: Foundation (Post-Hackathon, 2-4 weeks)

|Feature                                |Priority|Effort|
|---------------------------------------|--------|------|
|Offline queue & sync                   |High    |Medium|
|Basic entity decorations (trust scores)|High    |Medium|
|Atom creation flow                     |High    |Low   |
|Settings UI                            |Medium  |Low   |
|Error recovery improvements            |Medium  |Low   |

### Phase 2: Read Features (1-2 months)

|Feature                      |Priority|Effort|
|-----------------------------|--------|------|
|Claim existence indicators   |High    |High  |
|Hover cards with full data   |High    |Medium|
|Source credibility badges    |Medium  |Low   |
|Inline confidence annotations|Medium  |Low   |
|Decoration summary sidebar   |Medium  |Medium|

### Phase 3: Advanced Publishing (2-3 months)

|Feature                          |Priority|Effort|
|---------------------------------|--------|------|
|Structured claim syntax          |High    |Medium|
|Auto-extraction with confirmation|High    |High  |
|Publish queue management UI      |Medium  |Medium|
|Claim templates                  |Medium  |Low   |
|Batch publishing                 |Medium  |Medium|

### Phase 4: Graph Integration (3-4 months)

|Feature                 |Priority|Effort|
|------------------------|--------|------|
|Expand from public graph|High    |Medium|
|Public backlinks panel  |Medium  |Medium|
|Knowledge diff report   |Medium  |High  |
|Provenance explorer     |Low     |Medium|

### Phase 5: Economics & Power Features (4-6 months)

|Feature             |Priority|Effort   |
|--------------------|--------|---------|
|Portfolio dashboard |High    |Medium   |
|Auto-staking rules  |Medium  |High     |
|Hybrid graph view   |Low     |Very High|
|Collaborative review|Low     |High     |
|Claim bounties      |Low     |Very High|

-----

## 8. Technical Considerations

### 8.1 Obsidian Plugin API Constraints

**Capabilities**:

- Full access to vault files (read/write)
- Custom views (sidebars, modals)
- Editor extensions (CodeMirror 6)
- Settings management
- Command palette integration
- Hotkey registration
- Context menus

**Limitations**:

- No native network indicators (must implement custom)
- Storage limited to plugin data folder + IndexedDB
- No background sync when Obsidian closed
- Mobile plugins have additional restrictions
- Graph view customization is limited

### 8.2 Wallet Library: viem

> **Important**: This plugin uses **viem** (not ethers.js) for all wallet and blockchain operations. The @0xintuition/sdk v2.x requires viem internally.

**Why viem?**
- Native `bigint` support (no `BigNumber` class needed)
- Type-safe contract interactions with better TypeScript support
- Modular imports for smaller bundle size
- Direct compatibility with @0xintuition/sdk and @0xintuition/protocol

**Key viem patterns used in this plugin:**

```typescript
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { intuitionTestnet } from '@0xintuition/protocol'

// Generate new wallet
const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)

// Create clients
const publicClient = createPublicClient({
  chain: intuitionTestnet,
  transport: http(),
})

const walletClient = createWalletClient({
  chain: intuitionTestnet,
  transport: http(),
  account,
})

// Transaction example
const hash = await walletClient.writeContract({
  address: contractAddress,
  abi,
  functionName: 'depositTriple',
  args: [receiver, tripleId],
  value: stakeAmount, // bigint, e.g., parseEther('0.01')
})

const receipt = await publicClient.waitForTransactionReceipt({ hash })
```

### 8.3 Security Considerations

**Private Key Storage**:

```typescript
// Recommended: Encrypt with vault-derived key
async function storePrivateKey(privateKey: string, vaultPassword: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(vaultPassword, salt);
  const encrypted = await encrypt(privateKey, key);
  
  // Store encrypted key and salt
  await this.saveData({ 
    encryptedKey: encrypted, 
    salt: Array.from(salt) 
  });
}
```

**Transaction Signing**:

- Always show full transaction details before signing
- Implement spending limits
- Consider hardware wallet support for large stakes

### 8.4 Performance Considerations

**Caching Strategy**:

```typescript
interface CacheConfig {
  // Atom data: cache for 1 hour (rarely changes)
  atomTTL: 3600000,
  
  // Vault state: cache for 5 minutes (changes with activity)
  vaultTTL: 300000,
  
  // Search results: cache for 10 minutes
  searchTTL: 600000,
  
  // Max cache size: 50MB
  maxSize: 50 * 1024 * 1024
}
```

**Batch Queries**:

- Aggregate decoration requests
- Query all entities in visible viewport in single request
- Debounce as user scrolls

### 8.5 Error Handling Patterns

```typescript
enum ErrorType {
  NETWORK = 'network',
  WALLET = 'wallet',
  VALIDATION = 'validation',
  TRANSACTION = 'transaction',
  RATE_LIMIT = 'rate_limit'
}

interface ErrorHandler {
  [ErrorType.NETWORK]: () => {
    // Queue for retry, show offline indicator
  },
  [ErrorType.WALLET]: () => {
    // Prompt to check wallet settings
  },
  [ErrorType.VALIDATION]: () => {
    // Show specific field errors
  },
  [ErrorType.TRANSACTION]: () => {
    // Show failure reason, offer retry
  },
  [ErrorType.RATE_LIMIT]: () => {
    // Back off, show countdown
  }
}
```

-----

## Appendix A: Competitive Analysis

|Product             |Approach            |Gap Intuition Plugin Fills             |
|--------------------|--------------------|---------------------------------------|
|**Obsidian Publish**|Publish notes to web|No semantic structure, no trust signals|
|**Roam Research**   |Graph-based notes   |No external knowledge integration      |
|**Notion AI**       |AI-assisted writing |No decentralized verification          |
|**Logseq**          |Open-source PKM     |No economic incentives                 |
|**Athens Research** |Collaborative PKM   |No public knowledge graph              |

-----

## Appendix B: User Research Questions

For post-hackathon validation:

1. How often do you write claims/facts that others would find valuable?
1. Would you stake money on claims you’re confident about?
1. How do you currently verify information in your notes?
1. What would make you trust a “public consensus” score?
1. Would you change your notes based on public disagreement?

-----

## Appendix C: Success Metrics

**Hackathon**:

- Working demo of publish flow
- At least 3 claims published during demo
- Judge engagement/questions

**Post-Hackathon (30 days)**:

- Personal daily usage
- 10+ claims published
- Zero critical bugs

**Long-term**:

- Open source community contributions
- 100+ users
- Integration with other Intuition tools

