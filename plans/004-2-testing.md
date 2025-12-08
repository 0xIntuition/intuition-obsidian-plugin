# Plan 004-2: Testing Infrastructure

**Status**: Draft
**Priority**: High
**Estimated Effort**: 16 days (60-70 hours)
**Dependencies**: Plan 004 (SDK Integration)

## Overview

Implement comprehensive testing infrastructure for the Intuition Obsidian plugin using **Vitest**, achieving **80%+ code coverage** with GitHub Actions CI integration running on every PR.

**Current State**: Zero testing infrastructure
**Target State**: 450-550 tests across unit + integration categories
**Framework**: Vitest (modern, fast, Vite-native) with happy-dom environment

## User Requirements

- ✅ **Framework**: Vitest
- ✅ **Test Types**: Unit tests + Integration tests (no E2E)
- ✅ **Coverage**: 80%+ enforced in CI
- ✅ **Approach**: Broad coverage across all components
- ✅ **CI**: Tests run on every PR via GitHub Actions

## Implementation Strategy

### Phase 1: Setup Infrastructure (Day 1)

**1.1 Install Dependencies**

```bash
npm install --save-dev vitest@^1.0.4 @vitest/coverage-v8@^1.0.4 @vitest/ui@^1.0.4 happy-dom@^12.10.3
```

**1.2 Create Core Configuration Files**

**vitest.config.ts**
- Environment: happy-dom (3-5x faster than jsdom)
- Coverage: V8 provider with 80% thresholds (lines, functions, branches, statements)
- Exclude: Type files, index.ts re-exports, settings-tab.ts (partial coverage due to 10,761 lines)
- Test patterns: `src/**/*.{test,spec}.ts` and `tests/**/*.{test,spec}.ts`
- Timeout: 10 seconds for async/crypto operations
- Setup file: `tests/setup.ts`

**tests/setup.ts**
- Global mocks for Obsidian, viem, idb
- Configure fetch mock
- Setup TextEncoder/TextDecoder
- Configure console suppression for cleaner test output

**1.3 Create Mock Library**

**tests/mocks/obsidian.ts** - Mock Obsidian API
- Classes: Notice, Plugin, PluginSettingTab, Setting, Modal, Component
- Methods: loadData, saveData, addRibbonIcon, addStatusBarItem, addCommand, addSettingTab
- UI components: Text, Toggle, Dropdown, Button components

**tests/mocks/viem.ts** - Mock blockchain operations
- generatePrivateKey, privateKeyToAccount
- createPublicClient, createWalletClient
- getBalance, formatEther, http

**tests/mocks/idb.ts** - Mock IndexedDB
- openDB with in-memory Map storage
- get, put, delete, clear, getAllKeys, getAll

**tests/mocks/crypto.ts** - Crypto helpers
- Re-export actual crypto (Node 18+ has Web Crypto)
- mockRandomValues for deterministic tests

**1.4 Create Test Fixtures**

**tests/fixtures/settings.ts**
- createTestSettings() helper
- testSettingsWithWallet
- invalidSettings examples

**tests/fixtures/wallet.ts**
- TEST_PRIVATE_KEY, TEST_ADDRESS, TEST_PASSWORD constants
- mockEncryptedKey example

**tests/fixtures/graphql-responses.ts**
- mockAtomResponse, mockTripleResponse
- mockSearchResponse examples

**tests/fixtures/plugin.ts**
- createMockPlugin() factory function

**1.5 Create Test Helpers**

**tests/helpers/test-plugin.ts**
- createTestPlugin() - fully initialized plugin for integration tests
- waitForAsync(), flushPromises()

**tests/helpers/crypto-utils.ts**
- createMockEncryptedData() - real encryption for integration tests

**tests/helpers/async-utils.ts**
- useFakeTimers() wrapper
- waitFor() condition waiter

**1.6 Update package.json Scripts**

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "npm run test && tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "type-check": "tsc -noEmit -skipLibCheck",
    "ci": "npm run lint && npm run test:coverage && npm run build"
  }
}
```

### Phase 2: Quick Wins - Utilities & Simple Services (Days 2-3)

**Target: ~20% coverage**

**src/utils/helpers.spec.ts** (100% coverage)
- truncateAddress: 5 tests (short/long addresses, empty, null/undefined, default length)
- deepMergeSettings: 5 tests (nested objects, null values, array replacement)
- createDeterministicCacheKey: 4 tests (property order, undefined filtering, sorting)
- formatTimestamp: 2 tests (locale string formatting)

**src/types/errors.spec.ts** (100% coverage)
- PluginError constructor: 5 tests (message, code, originalError)
- GraphQLQueryError: 3 tests

**src/ui/notice-manager.spec.ts** (100% coverage)
- info/success/error/warning: 4 tests (Obsidian Notice wrapper)

**src/services/cache-service.spec.ts** (100% coverage)
- get/set: 8 tests (store/retrieve, expiration, TTL validation, complex objects)
- invalidate/invalidatePattern: 6 tests (single removal, prefix matching)
- clear/cleanup: 4 tests (remove all, expired only)
- getStats: 2 tests

### Phase 3: Core Services (Days 4-6)

**Target: ~45% coverage**

**src/services/crypto-service.spec.ts** (95% coverage)
- encryptPrivateKey: 10 tests (success, password validation, salt generation)
- decryptPrivateKey: 10 tests (correct password, wrong password, invalid data)
- Error handling: 8 tests (OperationError, invalid algorithm)

**src/services/settings-service.spec.ts** (95% coverage)
- validateAndRepairSettings: 12 tests (corrupted data, missing fields, migration)
- validateSettings: 10 tests (RPC URL, network, cache TTL, stake amount)
- Validation helpers: 15 tests

**src/services/graphql-client.spec.ts** (95% coverage)
- query success: 8 tests (different query types, response parsing)
- Error handling: 12 tests (network errors, GraphQL errors, HTTP status)
- Network switching: 5 tests

### Phase 4: Complex Services (Days 7-10)

**Target: ~70% coverage**

**src/services/wallet-service.spec.ts** (90% coverage)
- createWallet: 15 tests (success, duplicate wallet, password validation)
- importWallet: 12 tests (valid key, invalid key, existing wallet)
- unlock/lock: 15 tests (correct password, wrong password, state changes)
- Balance operations: 10 tests (refresh, formatting, concurrent requests)
- Error scenarios: 15 tests

**src/services/intuition-service.spec.ts** (85% coverage)
- getAtom: 10 tests (success, not found, caching)
- searchAtoms: 12 tests (filters, pagination, sorting)
- getTriple: 8 tests
- Cache integration: 15 tests (TTL, invalidation patterns)
- Network switching: 8 tests

### Phase 5: UI Components (Days 11-12)

**Target: ~78% coverage**

**src/ui/components/wallet-status.spec.ts** (90% coverage)
- Rendering: 8 tests (status display, balance formatting, locked/unlocked states)
- Refresh logic: 6 tests (manual refresh, auto-refresh)
- Click handlers: 3 tests

**src/ui/modals/** (partial coverage)
- Modal lifecycle: 8 tests per modal (open, close, onOpen, onClose)
- Form validation: varies by modal

**Note**: settings-tab.ts (10,761 lines) gets 40-50% coverage - test core logic only, skip exhaustive UI rendering

### Phase 6: Integration Tests (Days 13-14)

**Target: ~82% coverage**

**tests/integration/plugin-lifecycle.test.ts**
- Plugin load/unload: 6 tests
- Service initialization sequence: 8 tests
- Cleanup verification: 3 tests

**tests/integration/wallet-flow.test.ts**
- Create → Unlock → Lock flow: 5 tests
- Import → Delete flow: 4 tests
- Error scenarios: 6 tests (duplicate creation, wrong password)

**tests/integration/settings-persistence.test.ts**
- Save/load cycle: 5 tests (data integrity, encryption)
- Migration tests: 4 tests (version upgrades, corrupted data repair)

**tests/integration/cache-integration.test.ts**
- Cache + GraphQL: 6 tests (query caching, invalidation)
- Cache + Wallet: 4 tests

### Phase 7: GitHub Actions CI/CD (Day 15)

**Create .github/workflows/test.yml**

Three jobs (parallelizable):

**1. Lint Job**
- Checkout code
- Setup Node.js 18 with npm cache
- Run `npm run lint`

**2. Test Job**
- Checkout code
- Setup Node.js 18 with npm cache
- Run `npm run test:coverage`
- Upload coverage to Codecov
- Comment PR with coverage report (lcov-reporter-action)
- Upload coverage artifacts (30-day retention)

**3. Build Job** (depends on lint + test)
- Checkout code
- Setup Node.js 18 with npm cache
- Run `npm run build`
- Verify artifacts (main.js, manifest.json)

**Triggers**:
- Pull requests (opened, synchronize, reopened) to main/develop
- Direct pushes to main/develop

**Failure Conditions**:
- Tests fail → CI fails → PR blocked
- Coverage below 80% → CI fails → PR blocked
- Lint errors → CI fails → PR blocked
- Build fails → CI fails → PR blocked

### Phase 8: Documentation & Refinement (Day 16)

- Create TESTING.md guide (running tests, writing new tests, mocking patterns)
- Update README.md with test badges
- Document testing strategy in CONTRIBUTING.md
- Review coverage gaps and add targeted tests
- Verify 80%+ coverage achieved

## Directory Structure

```
intuition-obsidian-plugin/
├── src/
│   ├── services/
│   │   ├── wallet-service.ts
│   │   ├── wallet-service.spec.ts          ← Co-located unit tests
│   │   ├── crypto-service.ts
│   │   ├── crypto-service.spec.ts
│   │   └── ...
│   ├── utils/
│   │   ├── helpers.ts
│   │   └── helpers.spec.ts
│   └── ui/
│       ├── notice-manager.ts
│       └── notice-manager.spec.ts
├── tests/
│   ├── setup.ts                             ← Global test setup
│   ├── mocks/
│   │   ├── obsidian.ts                      ← Obsidian API mocks
│   │   ├── viem.ts                          ← Blockchain mocks
│   │   ├── idb.ts                           ← IndexedDB mocks
│   │   └── crypto.ts                        ← Crypto helpers
│   ├── fixtures/
│   │   ├── settings.ts                      ← Test data
│   │   ├── wallet.ts
│   │   ├── graphql-responses.ts
│   │   └── plugin.ts
│   ├── helpers/
│   │   ├── test-plugin.ts                   ← Test utilities
│   │   ├── async-utils.ts
│   │   └── crypto-utils.ts
│   └── integration/
│       ├── plugin-lifecycle.test.ts         ← Integration tests
│       ├── wallet-flow.test.ts
│       ├── settings-persistence.test.ts
│       └── cache-integration.test.ts
├── coverage/                                 ← Generated reports
├── vitest.config.ts                         ← Test configuration
└── .github/workflows/test.yml               ← CI pipeline
```

## Coverage Targets

- **Overall**: 80%+ (enforced in CI)
- **Utilities**: 95%+ (pure functions, easy to test)
- **Core Services**: 90%+ (crypto, settings, GraphQL client)
- **Complex Services**: 85%+ (wallet, Intuition service)
- **UI Components**: 75%+ (DOM-heavy)
- **Settings Tab**: 40-50% (10,761 lines, partial coverage acceptable)

## Key Testing Patterns

**Async Operations**
```typescript
it('should fetch balance', async () => {
  const balance = await walletService.refreshBalance();
  expect(balance).toBe(TEST_BALANCE);
});
```

**Promise Rejections**
```typescript
await expect(
  cryptoService.decrypt(encrypted, 'wrong-password')
).rejects.toThrow('Invalid password');
```

**Time-Dependent Tests**
```typescript
vi.useFakeTimers();
cacheService.set('key', 'value', 1000);
vi.advanceTimersByTime(1001);
expect(cacheService.get('key')).toBeNull();
vi.useRealTimers();
```

**Mock Fetch**
```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: mockAtomResponse }),
});
```

## Critical Files to Create/Modify

### Configuration
- `vitest.config.ts` - Test framework configuration
- `package.json` - Add test scripts and dependencies
- `.github/workflows/test.yml` - CI pipeline

### Test Infrastructure
- `tests/setup.ts` - Global test setup
- `tests/mocks/obsidian.ts` - Obsidian API mocks (most critical!)
- `tests/mocks/viem.ts` - Blockchain mocks
- `tests/mocks/idb.ts` - IndexedDB mocks
- `tests/fixtures/settings.ts` - Test data
- `tests/fixtures/wallet.ts` - Wallet test data
- `tests/helpers/test-plugin.ts` - Plugin test utilities

### High-Priority Test Files (Implement First)
1. `src/utils/helpers.spec.ts` - Pure functions, quick wins
2. `src/services/cache-service.spec.ts` - Simple service, clear logic
3. `src/services/crypto-service.spec.ts` - Security-critical
4. `src/services/wallet-service.spec.ts` - Core functionality (398 lines)
5. `src/services/intuition-service.spec.ts` - Main service (630 lines)

### Integration Tests
- `tests/integration/wallet-flow.test.ts` - End-to-end wallet operations
- `tests/integration/plugin-lifecycle.test.ts` - Plugin initialization/cleanup

## Success Metrics

- ✅ 80%+ code coverage enforced
- ✅ 450-550 total tests
- ✅ Test execution < 5 seconds
- ✅ CI pipeline < 3 minutes
- ✅ All PRs blocked until tests pass
- ✅ Coverage reports on every PR
- ✅ Zero flaky tests (deterministic, isolated)

## Risk Mitigation

**Challenge**: Large settings-tab.ts (10,761 lines)
**Solution**: Partial coverage (40-50%) - test core logic, skip exhaustive UI rendering

**Challenge**: Crypto operations complexity
**Solution**: Use real Web Crypto API (Node 18+ supports it), mock only when necessary

**Challenge**: Time-dependent tests
**Solution**: Use `vi.useFakeTimers()` for deterministic control

**Challenge**: Async complexity
**Solution**: Clear async/await patterns, 10-second timeout, helper functions

## Implementation Checklist

### Setup Phase
- [ ] Install Vitest dependencies
- [ ] Create vitest.config.ts
- [ ] Create tests/setup.ts
- [ ] Create all mock files (obsidian, viem, idb, crypto)
- [ ] Create all fixture files (settings, wallet, graphql, plugin)
- [ ] Create all helper files (test-plugin, crypto-utils, async-utils)
- [ ] Update package.json scripts
- [ ] Verify setup: `npm run test` (0 tests, should pass)

### Test Implementation
- [ ] Phase 2: Utils & simple services (~20% coverage)
- [ ] Phase 3: Core services (~45% coverage)
- [ ] Phase 4: Complex services (~70% coverage)
- [ ] Phase 5: UI components (~78% coverage)
- [ ] Phase 6: Integration tests (~82% coverage)
- [ ] Verify 80%+ coverage: `npm run test:coverage`

### CI/CD
- [ ] Create .github/workflows/test.yml
- [ ] Test workflow on feature branch
- [ ] Verify coverage enforcement works
- [ ] Confirm PR comments show coverage

### Documentation
- [ ] Create TESTING.md
- [ ] Update README.md with test badges
- [ ] Add testing section to CONTRIBUTING.md

## Estimated Timeline

- **Setup**: 1 day
- **Unit tests**: 10 days
- **Integration tests**: 2 days
- **CI/CD**: 1 day
- **Documentation**: 1 day
- **Buffer**: 1 day

**Total: 16 days** (60-70 hours)

## Next Steps

1. Install Vitest dependencies
2. Create vitest.config.ts and tests/setup.ts
3. Build mock library (especially obsidian.ts)
4. Create fixtures and helpers
5. Start with helpers.spec.ts (quick win)
6. Progress through services in order of priority
7. Add integration tests
8. Configure GitHub Actions
9. Document everything
