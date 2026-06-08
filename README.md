# Gomi IDE

**Gomi Office IDE: Multi-Agent Development Environment**

Gomi IDE is a standalone IDE direction based on a **Code - OSS fork**. It rebrands the editor as Gomi IDE, customizes the workbench experience, and introduces a visual **Gomi Multi-Agent Office** where a CEO Agent can plan work and delegate tasks to technical agents.

Instead of presenting AI assistance as a simple chat box, Gomi IDE models software delivery as a virtual office. The user enters a project request, the CEO Agent analyzes the workspace, then specialist agents coordinate through visible task status, chat bubbles, memory notes, and final reports.

![Gomi Office IDE interface](docs/images/gomi-office-cute-office.png)

## Product Direction

```text
Fork Code - OSS
-> Rebrand as Gomi IDE
-> Customize the workbench UI
-> Add the Gomi Multi-Agent Panel
-> Add the AI Agent Runtime
-> Package as a standalone IDE
```

Gomi IDE should be described as **an IDE built from Code - OSS**, not as a VS Code extension or a wrapper around Visual Studio Code.

## What This Repository Contains

This repository is the first production-oriented scaffold for the Gomi module before it is merged into a full Code - OSS fork. It includes:

- Product branding metadata in `product.json`.
- A workbench-compatible module path under `src/vs/workbench/contrib/gomi`.
- A React workbench demo for the Gomi Office panel.
- A Phaser-powered 2D office simulation.
- Cute game-style agent avatars with animated status behavior.
- A memory board for task context and shared office notes.
- Chat bubbles above agents when they exchange information.
- CEO Agent planning flow and specialist agent task updates.
- Message bus, task planner, workspace reader scaffold, patch proposal, and final report events.
- Open VSX Registry metadata instead of Microsoft Visual Studio Marketplace metadata.

## Core Concept

The Gomi Multi-Agent Office contains:

- **CEO Agent**: receives the request, creates the plan, delegates work, and summarizes results.
- **System Analyst Agent**: maps requirements, modules, risks, and acceptance criteria.
- **Backend Agent**: reviews or prepares APIs, services, controllers, and server-side logic.
- **Frontend Agent**: reviews or prepares workbench UI, views, panels, and user flows.
- **Database Agent**: reviews schemas, migrations, models, and data persistence.
- **QA Agent**: checks logic, test coverage, edge cases, and verification gates.
- **DevOps Agent**: checks build scripts, packaging, environment, CI/CD, and deployment paths.
- **Gomi Guide**: a visual companion that moves through the office and reports workflow status.

## Architecture

```text
Gomi IDE
├── Code Editor Core
│   ├── File Explorer
│   ├── Text Editor
│   ├── Terminal
│   ├── Debug
│   └── Git
│
├── Gomi Multi-Agent Office
│   ├── CEO Agent
│   ├── System Analyst Agent
│   ├── Backend Agent
│   ├── Frontend Agent
│   ├── Database Agent
│   ├── QA Agent
│   ├── DevOps Agent
│   └── Gomi Guide
│
├── Agent Communication Layer
│   ├── Task Planner
│   ├── Message Bus
│   ├── Event System
│   └── Result Aggregator
│
├── Visual Office Simulation
│   ├── 2D Office Map
│   ├── Agent Avatar
│   ├── Animation
│   ├── Chat Bubble
│   ├── Memory Board
│   └── Task Status Panel
│
└── AI Runtime
    ├── LLM API Adapter
    ├── Local Model Option
    ├── Memory
    └── Project Context Reader
```

## Repository Layout

```text
src/vs/workbench/contrib/gomi/
├── browser/
│   ├── GomiOfficeApp.tsx
│   ├── PhaserOffice.tsx
│   ├── gomiOfficeView.ts
│   ├── gomiAgentPanel.ts
│   ├── gomiTaskView.ts
│   └── gomiChatView.ts
│
├── common/
│   ├── gomiTypes.ts
│   ├── gomiEvents.ts
│   └── gomiConstants.ts
│
├── electron-sandbox/
│   └── gomiBridge.ts
│
└── node/
    ├── agentRuntime.ts
    ├── taskPlanner.ts
    ├── messageBus.ts
    ├── workspaceReader.ts
    └── patchApplier.ts
```

## Workbench Experience

The current MVP opens directly into a workbench-style interface. It is intentionally not a marketing landing page.

Key UI areas:

- **Activity Bar**: includes the Gomi Office entry alongside editor-style navigation.
- **Project Sidebar**: shows project context, files, and runtime status.
- **Project Request**: accepts a natural-language engineering request.
- **2D Office Simulation**: renders rooms, desks, a memory board, animated avatars, and speech bubbles.
- **Agent List**: tracks each agent's role and live status.
- **Task Queue**: shows queued, running, and completed work.
- **Agent Chat Log**: records the information exchanged by agents.
- **Final Report**: summarizes delivery output and generated patch proposals.

## Runtime Flow

```text
User opens Gomi IDE
-> Opens a project folder
-> Opens Gomi Office
-> Enters a request
-> CEO Agent reads project context
-> CEO Agent creates a task plan
-> Specialist agents process their tasks
-> Gomi Office displays movement, chat bubbles, and task state
-> CEO Agent produces a final report
-> Runtime creates a patch proposal
-> User reviews before applying changes
```

## Branding Notes

The fork should not keep Visual Studio Code or Microsoft branding for the standalone product.

Current product metadata is defined in `product.json`:

```json
{
  "nameShort": "Gomi",
  "nameLong": "Gomi IDE",
  "applicationName": "gomi-ide",
  "dataFolderName": ".gomi-ide",
  "win32MutexName": "gomiide",
  "licenseName": "MIT"
}
```

The extension gallery is configured for **Open VSX Registry**, which is the recommended open registry path for Code - OSS based products.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the local Gomi Office demo:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

## Current MVP Status

Implemented:

- Gomi IDE branding scaffold.
- Open VSX product metadata.
- Gomi workbench module skeleton.
- React workbench shell.
- Phaser 2D office simulation.
- Animated game-style agent avatars.
- Memory board and chat bubbles above agents.
- CEO Agent task planning simulation.
- Agent status stream and task queue.
- Final report and patch proposal events.
- Unit tests for runtime, planner, and message bus.

Not yet implemented:

- Full upstream Code - OSS fork integration.
- Native workbench contribution registration inside a complete Code - OSS source tree.
- Real LLM provider adapter.
- Real local model adapter.
- Real filesystem workspace indexing inside the browser demo.
- Diff viewer with approve/reject controls.
- Full desktop packaging pipeline.

## Code - OSS Integration Path

When this module is merged into the full fork, the expected work is:

1. Fork Code - OSS.
2. Replace product metadata and resources with Gomi branding.
3. Register the Gomi Office view container in the Activity Bar.
4. Load the Gomi Office webview bundle inside the workbench.
5. Connect `gomiBridge.ts` to the workbench/webview message boundary.
6. Replace demo runtime calls with the node-side agent runtime service.
7. Connect workspace files, selected code, terminal output, git diff, and diagnostics to the project context reader.
8. Add a review-first patch application flow using the editor diff surface.
9. Package the fork as Gomi IDE for Windows, macOS, and Linux.

## Technology Stack

- Base direction: Code - OSS fork
- Language: TypeScript
- Runtime: Electron + Node.js in the final IDE target
- Demo UI: React + Vite
- Office simulation: Phaser
- Icons: Lucide React
- Testing: Vitest
- Extension registry direction: Open VSX Registry

## License

This scaffold is prepared as a Gomi IDE project foundation. Validate upstream Code - OSS license obligations and third-party asset usage before distributing packaged builds.
