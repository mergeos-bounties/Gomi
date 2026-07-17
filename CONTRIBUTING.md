# Contributing to Gomi IDE

Thanks for contributing! Gomi IDE is a MergeOS-funded project — many issues carry **MRG token bounties**.

## Bounty workflow

1. **Star** [mergeos-bounties/mergeos](https://github.com/mergeos-bounties/mergeos)
2. **Claim** on both:
   - [mergeos#1 — Claim MRG Tokens](https://github.com/mergeos-bounties/mergeos/issues/1)
   - [mergeos#244 — Gomi IDE job tracker](https://github.com/mergeos-bounties/mergeos/issues/244)
3. **Fork** this repo, create a feature branch, implement the fix
4. **Open a PR** targeting `master`, linking the issue number and `mergeos#244`
5. **Pass the quality gate** (see below)
6. After merge, MRG is credited to `github:<PR author>` on the MergeOS admin ledger

## Local verify script

```bash
npm ci && npm run typecheck && npm test
```

One command to verify everything is green before pushing.

## Quality gate

CI runs these checks on every PR. Make sure they pass locally:

```bash
npm run typecheck   # TypeScript compilation
npm test            # Vitest suite (193+ tests)
```

## Code style

- TypeScript strict mode
- Prefer explicit types over `any`
- New message types MUST be registered in the bridge validator (see `src/vs/workbench/contrib/gomi/common/gomiMessageValidator.ts`)
- Keep public APIs backward-compatible unless the issue explicitly allows breaking changes

## Pull request guidelines

- One focused change per PR
- Link the issue with `Closes #NN`
- Include evidence: test output, screenshots (for UI changes), or logs
- No secrets, keys, or credentials in commits or PR descriptions

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities. Never commit secrets — use environment variables or Electron `safeStorage`.

## Documentation

Contributions to documentation are welcome! See the `docs/` platform for platform-specific guides:
- [macOS & Linux Packaging Guide](docs/macos-linux-packaging.md) - Instructions for cross-platform builds
- [Windows First Run](docs/windows-first-run.md) - Initial setup guide
- [Windows Release Notes](docs/windows-release.md) - Release-specific information

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
