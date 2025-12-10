# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Intuition Obsidian Plugin integrates [Intuition](https://intuition.systems) - a decentralized, composable knowledge graph - into Obsidian. Users can publish claims from their notes to the blockchain, search the global knowledge graph, and participate in a permissionless network of interconnected ideas.

The plugin is under active development following a phased implementation approach documented in the `plans/` directory (001-012). Currently implemented: Plans 001-006 (Foundation, Settings, Wallet, SDK Integration, Atom Search, Claim Modal).

## Build Commands

```bash
# Development (watch mode)
npm run dev

# Production build (includes tests and type checking)
npm run build

# Testing
npm test                    # Run unit tests
npm run test:watch          # Watch mode
npm run test:ui             # Interactive UI
npm run test:coverage       # Coverage report
npm run test:integration    # Integration tests (requires network)
npm run test:all            # Both unit and integration tests

# Quality checks
npm run lint                # Run ESLint
npm run lint:fix            # Auto-fix linting issues
npm run type-check          # TypeScript type checking
npm run ci                  # Full CI pipeline (lint + coverage + build)
```

## Architecture

### Service Layer Pattern

The plugin uses a **service-oriented architecture** where all business logic is abstracted into services that extend `BaseService`:

```typescript
abstract class BaseService {
  constructor(plugin: IntuitionPlugin);
  abstract initialize(): Promise<void>;
  abstract cleanup(): void;
}
```

**Core Services:**
- **SettingsService** - Settings validation and migration
- **WalletService** - Encrypted wallet management (AES-GCM encryption)
- **IntuitionService** - GraphQL client for Intuition SDK integration
- **ClaimParserService** - Text parsing for triple extraction (currently regex-based, Plan 006-2 will migrate to LLM)
- **CacheService** - In-memory TTL caching for GraphQL responses
- **GraphQLClient** - Low-level HTTP client for Intuition's GraphQL API

**Service Lifecycle:**
1. Services are instantiated in `main.ts` during `onload()`
2. Each service's `initialize()` is called sequentially
3. Services depend on each other (e.g., `IntuitionService` depends on `WalletService`)
4. Services are cleaned up in reverse order during `onunload()`

### Data Flow

```
User Input → UI Components → Plugin (main.ts) → Services → External APIs
                                      ↓
                              Settings/State
```

**Key data types:**
- Settings are deeply merged on load to support migrations
- GraphQL responses use snake_case, mapped to camelCase TypeScript interfaces
- BigInt is used for blockchain values (shares, prices, assets)
- Cache keys are deterministically generated from query parameters

### GraphQL Integration

The plugin queries Intuition's GraphQL API for:
- **Atoms** - Knowledge graph entities (terms, concepts)
- **Triples** - Subject-Predicate-Object claims
- **Vaults** - Staking/position data for atoms and triples
- **Positions** - User's stakes in vaults
- **Semantic Search** - AI-powered atom search (via `search_term` function)

**Important mapping:**
- GraphQL uses `snake_case` (e.g., `term_id`, `creator_id`)
- TypeScript uses `camelCase` (e.g., `termId`, `creatorId`)
- Mapper functions in `IntuitionService` handle this translation

### Network Switching

The plugin supports **testnet** and **mainnet**:
- Network selection in settings updates `GraphQLClient` endpoint
- All caches are cleared on network switch to prevent stale data
- Settings auto-repair if network config is invalid

### LLM CORS Fix

**Problem**: Browser-based CORS restrictions prevent direct fetch calls to LLM provider APIs (Anthropic, OpenAI, etc.) from Obsidian's Electron sandbox.

**Solution**: Use Obsidian's `requestUrl()` API which bypasses CORS by making requests from the Electron main process instead of the renderer process.

**Implementation**:
- `src/utils/obsidian-fetch.ts` - Fetch-compatible wrapper around Obsidian's `requestUrl()`
- Passed to all AI SDK provider clients via `fetch` configuration option
- Transparently handles request/response format conversion between fetch API and Obsidian's format

**Limitations**:
- **No streaming**: Responses are fully buffered (not a problem for `generateObject()` which expects complete responses)
- **No FormData**: Not needed for LLM APIs which exclusively use JSON
- **ReadableStream buffering**: Stream request bodies are buffered before sending (rarely needed for LLM requests)

**Usage Example**:
```typescript
// In LLMService.createClient()
const customFetch = createObsidianFetch(this.plugin);

const client = createAnthropic({
  apiKey: this.decryptedApiKey,
  fetch: customFetch,  // Uses Obsidian's requestUrl instead of fetch
});
```

**Testing**:
- Unit tests: `src/utils/obsidian-fetch.spec.ts` - Mock requestUrl and verify request/response mapping
- Integration tests: `tests/integration/llm-cors.integration.spec.ts` - Real API calls to verify CORS bypass works

**Troubleshooting**:
- Check Developer Console for fetch/network errors
- Verify API key is valid and unlocked in LLM settings
- Ensure HTTPS endpoints (HTTP blocked in production except localhost)
- Check that `requestUrl` is being called (not standard fetch) by monitoring network requests

### Wallet Security Model

**CRITICAL SECURITY WARNINGS:**
- Private keys are encrypted with AES-GCM using user password
- Keys are stored in Obsidian's `data.json` (may sync to cloud!)
- Password is NOT stored - lost password = lost wallet access
- Only use for testing/low-value transactions
- Plan 003 considered hardware wallets and browser extensions

The encrypted key storage uses:
- `SubtleCrypto.deriveKey()` with PBKDF2 for key derivation
- Random salt stored alongside encrypted key
- No password storage or recovery mechanism

## Testing Strategy

### Unit Tests
- Location: `src/**/*.spec.ts`
- Environment: `happy-dom`
- Coverage: 80% threshold enforced
- Mocked dependencies: Obsidian API, crypto, IndexedDB, viem

### Integration Tests
- Location: `tests/integration/**/*.spec.ts`
- Make **real API calls** to testnet/mainnet GraphQL endpoints
- Longer timeouts (30s), retry on failure, sequential execution
- Separate config: `vitest.integration.config.ts`

**Path aliases for imports:**
- `@/` → `src/`
- `@tests/` → `tests/`
- `obsidian` → `tests/mocks/obsidian.ts`

### Test Fixtures
- `tests/fixtures/` - Reusable test data (settings, wallet, GraphQL responses)
- `tests/helpers/` - Test utilities (async helpers, crypto utils, plugin mocks)
- `tests/mocks/` - Mocked external dependencies

**Coverage exclusions:**
- Type files (`types/**`)
- Main entry point (`main.ts`)
- Test files themselves

## Code Style Guidelines

### TypeScript Practices
- Strict null checks enabled
- No unused locals/parameters
- No implicit any
- Barrel exports via `index.ts` in each directory
- Use `type` for interfaces that extend from types, `interface` otherwise

### Naming Conventions
- Services: `*Service` suffix (e.g., `WalletService`)
- Modals: `*Modal` suffix (e.g., `ClaimModal`)
- UI Components: PascalCase (e.g., `AtomSearchInput`)
- Types: PascalCase interfaces (e.g., `IntuitionPluginSettings`)
- Constants: UPPER_SNAKE_CASE in `types/constants.ts`

### Service Implementation Checklist
When creating a new service:
1. Extend `BaseService`
2. Implement `initialize()` and `cleanup()`
3. Add service to `main.ts` initialization sequence
4. Handle initialization failures gracefully
5. Add unit tests with mocked dependencies
6. Consider integration tests if service makes network calls

### Error Handling
- Use custom error types from `types/errors.ts`
- Services log errors but don't throw during initialization
- UI shows user-friendly messages via `NoticeManager`
- Network failures are non-fatal (plugin continues loading)

## Plan Implementation Workflow

Each feature follows a documented plan in `plans/`:

1. Read the plan thoroughly (plans are highly detailed specifications)
2. Plans include:
   - Acceptance criteria
   - File structure
   - Type definitions
   - Implementation order
   - Testing requirements
3. Create types first (`types/`)
4. Implement service layer (`services/`)
5. Build UI components (`ui/`)
6. Wire up in `main.ts`
7. Write unit tests alongside implementation
8. Add integration tests if applicable
9. Update README.md with completed feature

**Current Status:** Plans 001-006 complete. Next: Plan 006-2 (LLM Integration) or Plan 007 (Publishing Flow).

## Plugin Development Workflow

1. Run `npm run dev` in watch mode
2. Copy plugin directory to vault's `.obsidian/plugins/` folder
3. Reload plugin in Obsidian (Ctrl/Cmd+R or Settings → Plugins)
4. Check Developer Console for logs (Ctrl/Cmd+Shift+I)
5. Main entry point: `src/main.ts` → `onload()`

**Hot Reload:**
- Changes to `src/` are automatically compiled by esbuild
- Reload plugin manually in Obsidian after each rebuild
- Status bar shows wallet connection state

## Dependencies

### Core
- **Obsidian API** - Plugin framework
- **@0xintuition/sdk** - Intuition protocol SDK
- **@0xintuition/graphql** - GraphQL types and queries
- **viem** - Ethereum wallet utilities
- **idb** - IndexedDB wrapper for cache storage
- **zod** - Runtime type validation

### Development
- **esbuild** - Fast bundler (config: `esbuild.config.mjs`)
- **vitest** - Test runner with coverage
- **happy-dom** - Lightweight DOM for testing
- **TypeScript** - Strict mode enabled

### Upcoming (Plan 006-2)
- **ai** (Vercel AI SDK) - LLM abstraction layer
- **@ai-sdk/openai**, **@ai-sdk/anthropic**, **@ai-sdk/google** - LLM providers

## Important Caveats

### BigInt Arithmetic
When calculating vault assets or position values:
```typescript
// BigInt division truncates toward zero
const totalAssets = (totalShares * currentSharePrice) / BigInt(1e18);
// Max precision loss: 1 wei (~0.000000000000000001 ETH)
// Acceptable for display purposes
```

### Cache Invalidation
- Caches use TTL (Time To Live) expiration
- Network switch clears all caches
- Manual invalidation via `IntuitionService.invalidate*()` methods
- Cache keys are deterministic to ensure query deduplication

### Settings Migration
- Settings are deeply merged on load (not shallow merge!)
- `SettingsService.validateAndRepairSettings()` fixes corrupt settings
- Always call after loading settings to ensure schema compliance

### Obsidian API Patterns
- Use `this.addCommand()` for commands/hotkeys
- Use `this.addRibbonIcon()` for toolbar buttons
- Use `this.addSettingTab()` for settings UI
- Use `this.addStatusBarItem()` for status bar
- All cleanup must happen in `onunload()`

## Debugging Tips

**GraphQL queries failing:**
- Check network selection (testnet vs mainnet)
- Verify `NetworkConfig` in `types/networks.ts`
- Test connection: `IntuitionService.checkConnection()`
- Check GraphQL endpoint URLs in console logs

**Wallet issues:**
- Encrypted key format: base64-encoded AES-GCM ciphertext
- Salt format: base64-encoded random bytes
- Password is never stored or logged
- Use `CryptoService` for encryption/decryption

**Cache issues:**
- Check `CacheService.getStats()` for cache size/keys
- Cache keys are prefixed by type (`atom:`, `triple:`, `search:`, etc.)
- Clear cache: `IntuitionService.clearCache()`

**Test failures:**
- Unit tests should never make real network calls
- Integration tests require internet connection
- Check path aliases in `vitest.config.ts`
- Verify mocks in `tests/mocks/`

## Future Directions

**Plan 006-2 (LLM Integration):**
- Replace regex-based claim parsing with LLM
- Add batch note analysis, entity disambiguation, smart suggestions
- Use Vercel AI SDK for provider-agnostic LLM access
- Store encrypted API keys in settings

**Plan 007 (Publishing Flow):**
- Submit claims to blockchain via wallet
- Transaction signing and confirmation
- Error handling for failed transactions
- Gas estimation and user preview

**Plans 008-012:**
- Offline queue for claims
- Entity decorations in editor
- Hover cards for atom previews
- Claim indicators for published notes
- Portfolio dashboard for user positions
