# Intuition Obsidian Plugin

Connect your Obsidian notes to Intuition's decentralized knowledge graph.

## About

The Intuition Obsidian Plugin integrates [Intuition](https://intuition.systems) - a decentralized, composable knowledge graph - directly into your Obsidian workspace. Publish claims from your notes to the blockchain, search the global knowledge graph, and participate in a permissionless network of interconnected ideas.

## Features

### Current
- **Plugin Foundation**: Complete plugin architecture with modular service layer
- **Settings System**: Comprehensive configuration UI with network selection
- **Embedded Wallet**: Secure encrypted wallet with key management
- **Intuition SDK Integration**: GraphQL client with caching and error handling
- **Atom Search**: AI-powered semantic search with fuzzy matching and autocomplete
  - Dual search strategy (semantic + label-based)
  - Intelligent result ranking and deduplication
  - Rich metadata display (descriptions, types, trust indicators)
  - Create new atoms directly from search
  - Keyboard navigation support
- **Claim Structuring Modal**: Transform selected text into structured triples
  - Auto-extraction of Subject/Predicate/Object from natural language
  - Search and select existing atoms or create new ones
  - Real-time existence checking against the knowledge graph
  - Consensus display for existing claims (FOR/AGAINST percentages)
  - Validation and error handling
  - Hotkey support (Cmd/Ctrl+Shift+I)
- **LLM Integration (Core Infrastructure)**: Foundational AI capabilities
  - Multi-provider support (Anthropic, OpenAI, OpenRouter, Google AI)
  - Secure encrypted API key storage with password protection
  - Usage tracking and cost management with monthly budgets
  - Rate limiting and prompt injection protection
  - Auto-lock security feature (30-minute timeout)
  - Cost estimation and budget warnings
  - Custom endpoint support for proxies/corporate setups
  - Feature toggles for individual LLM capabilities

### Planned
The plugin is under active development with 12 implementation plans:

1. **Project Foundation** ✅ - Core architecture and plugin setup
2. **Settings System** ✅ - Configurable plugin options
3. **Embedded Wallet** ✅ - Secure wallet integration with key management
4. **SDK Integration** ✅ - Connection to Intuition's protocol via GraphQL
5. **Atom Search** ✅ - Search and browse the global knowledge graph with AI-powered semantic search
6. **Claim Modal** ✅ - UI for structuring claims as triples with existence checking and consensus display
6-2. **LLM Service** ✅ - Core infrastructure for AI-powered features (multi-provider support, encryption, cost tracking)
7. **Publishing Flow** - Submit claims to the blockchain
8. **Offline Queue** - Queue claims when offline
9. **Entity Decorations** - Highlight linked entities in your notes
10. **Hover Cards** - Preview entity details on hover
11. **Claim Indicators** - Show which claims exist for your notes
12. **Portfolio Dashboard** - View your claims and attestations

See the `plans/` directory for detailed specifications of each feature.

## Installation

### Manual Installation (Development)
Since this plugin is in active development and not yet in the community plugin marketplace:

1. Download or clone this repository
2. Copy the following files to your vault:
   ```
   <your-vault>/.obsidian/plugins/intuition-obsidian-plugin/
   ├── main.js
   ├── manifest.json
   └── styles.css (if present)
   ```
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Development

### Prerequisites
- Node.js v16 or higher
- npm or yarn

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd intuition-obsidian-plugin

# Install dependencies
npm install

# Start development build (watch mode)
npm run dev
```

### Building
```bash
# Production build
npm run build
```

The build process:
1. Runs TypeScript compiler for type checking
2. Bundles the plugin using esbuild
3. Outputs `main.js` and other assets

### Hot Reload
For faster development:
1. Copy the plugin directory to your vault's `.obsidian/plugins/` folder
2. Run `npm run dev` to start watch mode
3. Reload the plugin in Obsidian (Ctrl/Cmd+R or reload plugin in settings)
4. Changes will be automatically compiled

### Project Structure
```
src/
├── main.ts              # Plugin entry point
├── types/               # TypeScript interfaces
│   ├── plugin.ts        # Plugin settings
│   ├── errors.ts        # Error types
│   └── index.ts         # Barrel exports
├── services/            # Business logic layer
│   └── base-service.ts  # Service base class
├── ui/                  # User interface components
│   ├── modals/          # Modal dialogs
│   │   └── base-modal.ts
│   └── notice-manager.ts # Notification system
└── utils/               # Utility functions
    ├── helpers.ts       # Common helpers
    └── index.ts         # Barrel exports
```

## Roadmap

This project follows a phased implementation approach. Check the `plans/` directory for:
- Detailed technical specifications
- Implementation order and dependencies
- Acceptance criteria and testing requirements

Current status: **Plans 001-006, 006-2a Complete** (Foundation, Settings, Wallet, SDK Integration, Atom Search, Claim Modal, LLM Service)

## Contributing

This plugin is in active development. While it's not yet ready for external contributions, you can:
- Report bugs or suggest features via GitHub Issues
- Follow development progress in the `plans/` directory
- Test the plugin and provide feedback

## License

MIT

## Author

[0xIntuition](https://intuition.systems)

---

For more information about the Intuition protocol, visit [intuition.systems](https://intuition.systems)
