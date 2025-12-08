# Plan 001: Project Foundation & Plugin Architecture

## Objective
Establish the foundational plugin architecture, project structure, build configuration, and core patterns that all subsequent phases will build upon.

## Prerequisites
- None (starting phase)

## Deliverables
1. Reorganized project structure with `src/` directory
2. Updated plugin identity (from sample to intuition)
3. Core service abstractions and interfaces
4. Basic modal and settings tab patterns
5. Error notification system
6. Updated dependencies for Intuition SDK

## Files to Create/Modify

### New Directory Structure
```
src/
  main.ts                    # Plugin entry point (minimal)
  types/
    index.ts                 # Core type exports
    plugin.ts                # Plugin interfaces
    errors.ts                # Error types
  services/
    index.ts                 # Service exports
    base-service.ts          # Abstract service class
  ui/
    index.ts                 # UI exports
    base-modal.ts            # Abstract modal class
    notice-manager.ts        # Notification helper
  utils/
    index.ts                 # Utility exports
    constants.ts             # Plugin constants
    helpers.ts               # Common helpers
```

### Files to Modify
- `manifest.json` - Update plugin ID, name, description
- `package.json` - Add Intuition dependencies
- `esbuild.config.mjs` - Update entry point to src/main.ts
- `styles.css` - Base styles for plugin UI

## Data Models

```typescript
// src/types/plugin.ts
export interface IntuitionPluginSettings {
  version: string;
  initialized: boolean;
}

export const DEFAULT_SETTINGS: IntuitionPluginSettings = {
  version: '1.0.0',
  initialized: false,
};

// src/types/errors.ts
export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  NETWORK = 'NETWORK',
  WALLET = 'WALLET',
  VALIDATION = 'VALIDATION',
  TRANSACTION = 'TRANSACTION',
}

export interface IntuitionError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

// src/services/base-service.ts
export abstract class BaseService {
  protected plugin: IntuitionPlugin;

  constructor(plugin: IntuitionPlugin) {
    this.plugin = plugin;
  }

  abstract initialize(): Promise<void>;
  abstract cleanup(): void;
}
```

## Implementation Steps

### Step 1: Update package.json
```json
{
  "name": "intuition-obsidian-plugin",
  "version": "1.0.0",
  "description": "Connect your Obsidian notes to Intuition's decentralized knowledge graph",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"
  },
  "dependencies": {
    "@0xintuition/sdk": "^2.0.0-alpha.4",
    "@0xintuition/graphql": "^2.0.0-alpha.4",
    "@0xintuition/protocol": "^2.0.0-alpha.4",
    "viem": "^2.0.0",
    "idb": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0",
    "obsidian": "latest",
    "tslib": "2.4.0"
  }
}
```

### Step 2: Update manifest.json
```json
{
  "id": "intuition-plugin",
  "name": "Intuition",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Connect your notes to Intuition's decentralized knowledge graph",
  "author": "0xIntuition",
  "isDesktopOnly": false
}
```

### Step 3: Create src/main.ts
```typescript
import { Plugin } from 'obsidian';
import { IntuitionPluginSettings, DEFAULT_SETTINGS } from './types';
import { NoticeManager } from './ui/notice-manager';

export default class IntuitionPlugin extends Plugin {
  settings: IntuitionPluginSettings;
  noticeManager: NoticeManager;

  async onload() {
    await this.loadSettings();
    this.noticeManager = new NoticeManager();

    // Register ribbon icon
    this.addRibbonIcon('network', 'Intuition', () => {
      this.noticeManager.info('Intuition plugin active');
    });

    // Register commands (placeholder)
    this.addCommand({
      id: 'publish-claim',
      name: 'Publish claim to Intuition',
      callback: () => {
        this.noticeManager.info('Claim publishing coming soon');
      }
    });

    console.log('Intuition plugin loaded');
  }

  onunload() {
    console.log('Intuition plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
```

### Step 4: Update esbuild.config.mjs
```javascript
// Update entryPoints to ['src/main.ts']
```

## Acceptance Criteria
- [ ] Plugin loads successfully in Obsidian
- [ ] Plugin name shows as "Intuition" in settings
- [ ] Ribbon icon appears (network icon)
- [ ] Command palette shows "Publish claim to Intuition"
- [ ] Console shows no errors on load/unload
- [ ] Build produces single `main.js` file
- [ ] All TypeScript compiles without errors
- [ ] Dependencies install without conflicts

## Estimated Effort
Medium - Foundational restructuring and pattern establishment

## Testing
1. Run `npm install` - verify no dependency conflicts
2. Run `npm run build` - verify clean compilation
3. Copy to Obsidian plugins folder
4. Enable plugin in Obsidian settings
5. Verify ribbon icon and command work
