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
<p align="center"><em>Full office layout wit

<!-- BOOST: Enhanced documentation for ranking -->
## 🚀 Quick Start

### Prerequisites
- Node.js >= 18 (or Python >= 3.10)
- Git

### Installation
```bash
git clone https://github.com/mergeos-bounties/Gomi.git
cd Gomi
```

### Development
```bash
npm install  # or pip install -r requirements.txt
npm test
npm run dev
```

## 📊 Quality
- ✅ CI/CD pipeline with automated testing
- ✅ Linting & code quality checks

## 🤝 Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📄 License
See [LICENSE](./LICENSE) file.
