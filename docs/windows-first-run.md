# Windows First Run — Gomi IDE

> **Audience:** Developer who just installed Gomi IDE on Windows 11 or Windows 10 and
> wants to get the prototype running in under 10 minutes.
>
> **Scope:** The Vite/React + Electron prototype in this repository. Not the final
> Code-OSS-derived Windows installer (see [windows-release.md](./windows-release.md)
> for the packaging runbook).
>
> **Time to first run on a clean box:** ~8 minutes on a wired connection.

## 1. Prerequisites

| Tool | Required version | Verify | Install (admin PowerShell) |
| --- | --- | --- | --- |
| Node.js | **22.x LTS** (matches CI badge) | `node --version` | `winget install --id OpenJS.NodeJS.LTS -e` |
| npm | 10.x (bundled with Node 22) | `npm --version` | Comes with Node |
| Git for Windows | 2.47+ | `git --version` | `winget install --id Git.Git -e` |
| Visual Studio Build Tools 2022 | C++ workload (only if you hit `node-gyp` errors on `npm ci`) | `cl /?` in *x64 Native Tools Command Prompt* | `winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` |

PowerShell 5.1 (built into Windows 10/11) is enough. Windows Terminal is recommended
but not required.

> **Quick check before cloning:**
> ```powershell
> node --version; npm --version; git --version
> ```
> All three should print versions, not "command not found".

## 2. Clone the repository

```powershell
# Pick a working folder. Avoid `C:\Program Files` (permission issues).
cd $HOME\Documents
git clone https://github.com/mergeos-bounties/Gomi.git
cd Gomi
```

If you intend to push branches, fork first on GitHub and clone your fork:

```powershell
git clone https://github.com/<your-handle>/Gomi.git
cd Gomi
git remote add upstream https://github.com/mergeos-bounties/Gomi.git
```

## 3. Install dependencies

```powershell
npm ci
```

`npm ci` (not `npm install`) reads the locked `package-lock.json` and matches CI
exactly. First run downloads ~380 MB and takes 2-4 minutes on a fast connection.

If you see `gyp ERR! find Python` or `MSB8003` errors, install the Build Tools 2022
package from the table above.

## 4. Run the prototype

```powershell
npm run dev
```

This starts the Vite dev server on `http://localhost:5173` and the Electron shell
window. You should see the Gomi Office workbench within 5 seconds.

Hot reload is enabled. Edit anything under `src/` and the window updates without
restart.

To stop: `Ctrl+C` in the terminal, then close the Electron window.

## 5. Smoke tests

Run the test suite to confirm the install is healthy:

```powershell
npm test
```

Expected: all tests green, exit code 0. The first run is slower because Vite
spins up the test runner; subsequent runs are 3-5x faster.

## 6. Next steps

- **Try the multi-agent office** — open the CEO panel, plan a small task, and
  watch the specialist agents work.
- **Read the release runbook** — [docs/windows-release.md](./windows-release.md)
  covers the path from this prototype to a packaged Windows installer.
- **Pick a bounty** — issues tagged `bounty` and `good first issue` are the
  on-ramp. Comment `I claim this bounty` on the issue, then comment on
  [Claim Token #1](https://github.com/mergeos-bounties/mergeos/issues/1) with
  the issue link.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm ci` fails with `EACCES` on `C:\Program Files` | Cloned into system folder | `cd $HOME\Documents` then re-clone |
| Electron window is blank | GPU acceleration issue on virtualized Windows | `npm run dev -- --disable-gpu` |
| Port 5173 already in use | Another Vite project running | Stop the other process or run `npm run dev -- --port 5174` |
| `gyp ERR! find Python` | Missing Python for native module build | `winget install --id Python.Python.3.12 -e` then `npm ci` again |
| `EBUSY: resource busy or locked, rename` | Windows Defender still scanning `node_modules` | Add an exclusion for the Gomi folder, then re-run `npm ci` |

## See also

- [docs/windows-release.md](./windows-release.md) — packaging the standalone
  Windows installer
- [README.md](../README.md) — full project overview and architecture
- [CONTRIBUTING.md](../CONTRIBUTING.md) — bounty workflow, claim rules, evidence
  requirements
