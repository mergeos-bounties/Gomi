# Gomi IDE

[![CI](https://github.com/mergeos-bounties/Gomi/actions/workflows/ci.yml/badge.svg)](https://github.com/mergeos-bounties/Gomi/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-0E8A16.svg)](package.json)
[![Node](https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Built on Code - OSS](https://img.shields.io/badge/built%20on-Code%20--%20OSS-007ACC?logo=visualstudiocode&logoColor=white)](https://github.com/microsoft/vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MergeOS](https://img.shields.io/badge/MergeOS-bounties-5319E7.svg)](https://github.com/mergeos-bounties)

**Gomi IDE** is a multi-agent development environment built toward a standalone **Code - OSS** distribution. A familiar editor workbench meets a **visual multi-agent office** — plan, delegate, review, and approve code changes before they touch the workspace.

**Product:** [mergeos-bounties/Gomi](https://github.com/mergeos-bounties/Gomi)

```text
Fork Code - OSS → rebrand as Gomi IDE → customize workbench
  → Gomi Multi-Agent Office → AI agent runtime → standalone installer
```

---

## Table of contents

- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [Product vision](#product-vision)
- [Quick start](#quick-start)
- [Desktop product path](#desktop-product-path)
- [Multi-agent office](#multi-agent-office)
- [Architecture](#architecture)
- [Agent providers](#agent-providers)
- [Shared project memory](#shared-project-memory)
- [Patch review & safety](#patch-review--safety)
- [Code - OSS integration](#code---oss-integration)
- [Repository layout](#repository-layout)
- [Status](#status)
- [Development](#development)
- [Trust & privacy](#trust--privacy)
- [Contributing](#contributing)
- [License](#license)

---

## Highlights

| Area | What you get |
| --- | --- |
| **Visual multi-agent office** | Phaser 2D office — rooms, desks, animated agents, chat bubbles, route lines |
| **CEO planning flow** | Plan → delegate to specialists → synthesize → patch proposal |
| **Review-first patches** | Diff preview, approve/reject, apply only after approval |
| **Hybrid project memory** | Lexical + vector retrieval, privacy controls, workspace persistence |
| **Provider routing** | Demo, CLI agents, OpenAI-compatible HTTP, Ollama local models |
| **Code - OSS ready** | Integration manifest, branding assets, workbench contribution templates |
| **Desktop packaging path** | Windows Code - OSS packaging script + GitHub Actions release workflow |

---

## Screenshots

<p align="center">
  <img src="docs/images/gomi-office-cute-office.png" alt="Gomi Office IDE — visual multi-agent office" width="100%" />
</p>
<p align="center"><em>Gomi Multi-Agent Office — animated agents, memory board, task flow</em></p>

<p align="center">
  <img src="docs/images/gomi-office-full-office.png" alt="Gomi Office full layout" width="100%" />
</p>
<p align="center"><em>Full office layout with status wall and department rooms</em></p>

---

## Product vision

Most AI coding tools collapse collaboration into a single chat pane. Gomi makes project work **visible and auditable**:

1. You describe a development request.
2. The **CEO Agent** analyzes the workspace and builds a plan.
3. Specialist agents work in parallel and write findings into **shared memory**.
4. Results become a **patch proposal**.
5. You review the diff and approve — only then can changes apply.

This repository is the **product foundation and technical prototype**. It is not yet a fully packaged Code - OSS distribution. The commercial product is an independent IDE — not a VS Code extension marketplace listing.

---

## Quick start

**Requirements:** Node.js **22**, npm.

```bash
git clone https://github.com/mergeos-bounties/Gomi.git
cd Gomi
npm ci

npm run dev          # Gomi Office workbench demo (Vite)
npm test             # Vitest suite
npm run build        # Production web bundle
```

Optional Electron shell (prototype desktop window, not the final Code - OSS product):

```bash
npm run build
npm run electron:start
# or: npm run desktop:build   # NSIS installer under release/desktop/
```

Quality gate (matches CI):

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run verify:release
```

---

## Desktop product path

**Gomi IDE should be released as a desktop artifact from a Code - OSS fork**, not as an `npm run dev` app.

The React/Vite app in this repo develops the **Gomi Office** module. End users install a branded IDE built from Code - OSS packaging.

### What this repo provides

| Asset | Role |
| --- | --- |
| `product.json` | Gomi-branded product metadata (Open VSX gallery, not Microsoft Marketplace) |
| **Generated desktop branding assets** | Windows icons/installer bitmaps, Linux icon, macOS `.icns` |
| `build/gomi-code-oss.integration.json` | Manifest of files/metadata to apply into a fork |
| `build/code-oss-templates/` | Native workbench contribution templates |
| `npm run build:webview` | React/Phaser office bundle for the native webview pane |
| `scripts/bootstrap-gomi-code-oss-fork.ps1` | Clone/reuse a Code - OSS checkout and apply Gomi |
| `scripts/apply-gomi-code-oss-integration.ps1` | Apply or validate the integration overlay |
| **Windows Code - OSS packaging script** | `scripts/build-gomi-code-oss-windows.ps1` |
| **GitHub Actions release workflow** | `.github/workflows/build-release.yml` |

See [docs/windows-release.md](docs/windows-release.md) for the full Windows release runbook.

### GitHub Actions

- Pushes to `master` verify the scaffold, run release-readiness checks, and upload the Gomi Office prototype/webview bundle with a SHA-256 checksum.
- Tags matching `v*` run the Windows Code - OSS packaging job and publish a prerelease.
- Manual workflow runs can publish a release only when the Windows desktop packaging job is enabled and succeeds.

### Local dry-run (Code - OSS fork)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-gomi-code-oss-fork.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -Repository https://github.com/your-org/gomi-code-oss.git `
  -Ref main `
  -DryRun

powershell -ExecutionPolicy Bypass -File .\scripts\build-gomi-code-oss-windows.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -Platform win32-x64 `
  -Minified `
  -BuildSetup `
  -DryRun
```

---

## Multi-agent office

| Role | Responsibility |
| --- | --- |
| **CEO Agent** | Plan, delegate, track progress, synthesize final report |
| **System Analyst** | Requirements, modules, risks, acceptance criteria |
| **Backend** | APIs, services, models, server logic |
| **Frontend** | Workbench UI, webview state, panels, flows |
| **Designer** | UX direction, visual language, office atmosphere |
| **Database** | Schema, migrations, persistence |
| **QA** | Edge cases, test strategy, regression gates |
| **DevOps** | Build, packaging, environments, deploy path |
| **Gomi Guide** | Visual companion inside the office simulation |

**Office UI modes:** Standard · Expanded · Full Office (panels collapse so the map can fill the workspace).

**Staffing controls:** Assign CLI/provider routes per role, sleep department heads, hire/offboard staff, run staffing demos. Settings persist via webview state (localStorage fallback in the standalone demo).

---

## Architecture

```text
Gomi IDE
├── Code Editor Core          # Explorer · editor · terminal · debug · git
├── Gomi Multi-Agent Office   # CEO + specialists + Gomi Guide
├── Agent Communication       # Planner · bus · events · policy · aggregator
├── Visual Office Simulation  # Phaser map · avatars · bubbles · memory board
└── AI Runtime
    ├── Agent providers (demo · CLI · HTTP · Ollama)
    ├── Hybrid project memory + embeddings
    ├── Project context indexer
    └── Patch proposal → review → apply
```

```text
src/vs/workbench/contrib/gomi/
  browser/     # React office, Phaser scene, webview bridges, patch UI
  common/      # Types, events, settings, unified diff helpers
  electron-sandbox/
  node/        # Runtime, providers, memory, planner, patch applier
```

The **webview ↔ host bridge** (message protocol, versioning, validation and
error flow) is documented in
[docs/webview-host-bridge.md](docs/webview-host-bridge.md).

Supporting release paths:

```text
build/                 # webview bundle + Code - OSS integration manifest
scripts/               # bootstrap, apply, Windows packaging, brand assets
resources/gomi-branding/
.github/workflows/     # CI + build-release
```

---

## Agent providers

Office organization is separate from **how** agents execute. Routes are selected in Office Settings; the workbench controller dispatches work.

| Route | Notes |
| --- | --- |
| `demo-runtime` | Offline, deterministic (default for tests) |
| CLI | `codex-cli`, `claude-code`, `gemini-cli`, `aider-cli`, `cursor-style-agent`, `local-llm` |
| `openai-compatible-api` | `GOMI_CLOUD_LLM_ENDPOINT`, `GOMI_CLOUD_LLM_MODEL`, optional `GOMI_CLOUD_LLM_API_KEY` |
| `ollama-local-model` | `GOMI_LOCAL_LLM_ENDPOINT`, `GOMI_LOCAL_LLM_MODEL` |

**Execution policy (Office Settings):**

- `demo-only` — non-demo routes fall back to deterministic behavior  
- `trusted-workspaces` — live providers only when the workspace is trusted  
- `allow-all` — controlled/dev and enterprise-managed environments  
- CLI and HTTP transports can be enabled independently  
- Department agent execution uses a configurable fair queue for concurrent runs  
- Patch approval can be required before live routes run  

CLI and HTTP execution are **off by default** in the prototype for safety and deterministic CI.

### Agent Result JSON Schema

CLI and HTTP providers may return plain English, but structured responses should use schema version `1`:

```json
{
  "schemaVersion": 1,
  "summary": "Short result summary.",
  "findings": ["Concrete observation."],
  "recommendations": ["Actionable next step."],
  "proposedFiles": ["src/example.ts"],
  "confidence": 0.82
}
```

`schemaVersion` is optional for older providers. When present, version `1` is the supported contract. The parser ignores unsupported future versions so provider callers can continue using the existing plain-text fallback path. If a provider response is interrupted after a mostly complete JSON object, the parser attempts to close missing arrays and objects before falling back to the original text.

---

## Shared project memory

Agents share scoped project memory so they do not re-broadcast every finding in chat.

| Layer | Purpose |
| --- | --- |
| **Lexical search** | Paths, symbols, package names, config keys |
| **Vector-style retrieval** | Semantic search over facts and findings |
| **Communication policy** | Low-importance → memory only; high-importance → bubbles |
| **Privacy guard** | Redact secrets, skip sensitive paths, strict mode |
| **Retention** | Prune by days / cap items per workspace |
| **Persistence** | File-backed stores under `.gomi-ide/memory` |

**Embeddings (default offline):** deterministic local hashing — no API key.

Optional HTTP embeddings:

- OpenAI-compatible: `GOMI_EMBEDDINGS_ENDPOINT`, `GOMI_EMBEDDINGS_MODEL`, optional `GOMI_EMBEDDINGS_API_KEY`
- Ollama: `GOMI_EMBEDDINGS_PROVIDER=ollama-embeddings` (+ local endpoint/model)
- Toggle: `GOMI_EMBEDDINGS_ENABLED=true|false` or host controller options  
- Safe fallback to local hashing on misconfiguration

---

## Patch review & safety

```text
Agent results → CEO synthesis → Patch proposal
  → Webview diff preview (+ native Code - OSS diff when host available)
  → User approves or rejects
  → Apply disabled until approval (and required preview)
  → Approved unified diff applied inside workspace root
```

The node-side patch applier:

- Parses unified diffs and verifies context lines  
- Blocks path escape outside the workspace  
- Supports dry-run  
- Refuses unapproved patches by default  
- Can require that the applied diff matches the previewed diff  

---

## Code - OSS integration

Intended product path:

1. Fork Code - OSS (or bootstrap with `scripts/bootstrap-gomi-code-oss-fork.ps1`).
2. Apply `build/gomi-code-oss.integration.json` via `scripts/apply-gomi-code-oss-integration.ps1`.
3. Replace product metadata and branding assets with Gomi.
4. Point the extension gallery at **Open VSX** (or a Gomi marketplace).
5. Register **Gomi Office** in the Activity Bar; mount the office webview.
6. Wire `gomiBridge` / `gomiWorkbenchController` to the workbench message boundary.
7. Feed workspace context (folders, editors, selection, diagnostics, terminal, SCM) into the indexer.
8. Enforce diff-first approval before apply.
9. Package for Windows / macOS / Linux.

**Product identity** (from `product.json`):

| Field | Value |
| --- | --- |
| Short name | Gomi |
| Long name | Gomi IDE |
| Application | `gomi-ide` |
| Data folder | `.gomi-ide` |
| Protocol | `gomi://` |
| Bundle ID | `com.gomi.ide` |
| Gallery | Open VSX Registry |

---

## Repository layout

```text
Gomi/
├── src/vs/workbench/contrib/gomi/   # Workbench module (browser · common · node)
├── build/                           # Webview output + Code - OSS integration
├── scripts/                         # Bootstrap, apply, Windows pack, branding
├── resources/gomi-branding/         # Desktop icons & installer bitmaps
├── docs/                            # Images + windows-release.md
├── electron/                        # Prototype Electron main
├── tests/                           # Vitest
├── product.json                     # Gomi product metadata
└── package.json
```

---

## Status

### Implemented

- Gomi product metadata + merge-safe Code - OSS overlay  
- Generated desktop branding assets (Win / Linux / macOS)  
- React workbench shell + Phaser office simulation  
- CEO planning, specialist agents, Designer role  
- Office settings, staffing lifecycle, layout modes  
- Workbench/webview bridges and host controller  
- Provider router (demo · CLI · HTTP · Ollama)  
- Hybrid memory, embeddings, privacy, persistence  
- Project context indexing  
- Patch proposal, preview, approval, safe apply  
- Integration manifest, bootstrap/apply scripts  
- GitHub Actions verification + Windows packaging path  
- Broad Vitest coverage for runtime, memory, patch, and release readiness  

### Not yet

- Full upstream Code - OSS source merge as a shipped installer  
- Production secrets UI and enterprise model governance  
- Database-backed / external vector DB memory  
- Signed release assets and update channel  
- Durable terminal scrollback beyond currently exposed text  

**Build note:** Phaser increases production JS chunk size; expected for the office prototype — optimize with code splitting before a packaged IDE release.

---

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite office demo |
| `npm run build` | Typecheck + production bundle |
| `npm run build:webview` | Bundle for Code - OSS webview pane |
| `npm run generate:brand-assets` | Desktop branding assets |
| `npm test` | Vitest |
| `npm run verify:release` | Release-readiness checks |
| `npm run electron:start` | Prototype Electron window |
| `npm run desktop:build` | Electron-builder Windows installer |

Stack: **TypeScript** · **React + Vite** · **Phaser** · **Lucide** · **Vitest** · target runtime **Electron + Node** via Code - OSS.

---

## Trust & privacy

- Users review generated changes before apply.  
- Workspace memory is scoped and controllable.  
- Provider routing is explicit; local models are supported for private projects.  
- Secrets (e.g. `.env`) must not be indexed or committed by default.  
- Telemetry, if added later, must be documented and optional.  

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).  
Changelog: [CHANGELOG.md](CHANGELOG.md).

MergeOS bounties: **follow** [mergeos-bounties](https://github.com/mergeos-bounties) + star [mergeos](https://github.com/mergeos-bounties/mergeos) + [mergeos-contracts](https://github.com/mergeos-bounties/mergeos-contracts), claim open issues, PR to **master**.

---

## License

[MIT](LICENSE) · MergeOS / Gomi

Before commercial distribution, review Code - OSS license obligations, third-party licenses, marketplace terms, branding rules, and generated asset rights.
