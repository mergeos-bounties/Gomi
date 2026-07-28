# Contributing to Gomi IDE

Thanks for contributing. Gomi IDE is a MergeOS-funded project, and many issues carry MRG token bounties.

## Bounty Workflow

1. Follow [mergeos-bounties](https://github.com/mergeos-bounties).
2. Star [mergeos](https://github.com/mergeos-bounties/mergeos) and [mergeos-contracts](https://github.com/mergeos-bounties/mergeos-contracts).
3. Claim on both:
   - [mergeos#1 - Claim MRG Tokens](https://github.com/mergeos-bounties/mergeos/issues/1)
   - [mergeos#244 - Gomi IDE job tracker](https://github.com/mergeos-bounties/mergeos/issues/244)
4. Fork this repo, create a feature branch, and implement one focused fix.
5. Open a PR targeting `master`, linking the Gomi issue and `mergeos#244`.
6. Pass the quality gate below and include command output in the PR.
7. After merge, MRG is credited to `github:<PR author>` on the MergeOS admin ledger.

## Local Verify Script

```bash
npm ci && npm run verify:local
```

`verify:local` runs the currently green release-readiness checks before pushing.

## Quality Gate

CI runs these checks on every PR. Make sure they pass locally:

```bash
npm run typecheck
npm test
npm run verify:release
npm run verify:local
```

## Code Style

- TypeScript strict mode.
- Prefer explicit types over `any`.
- New message types must be registered in the bridge validator at `src/vs/workbench/contrib/gomi/common/gomiMessageValidator.ts`.
- Keep public APIs backward-compatible unless the issue explicitly allows breaking changes.

## Pull Request Guidelines

- Keep one focused change per PR.
- Link the issue with `Fixes #NN` or `Closes #NN`.
- Include evidence: test output, screenshots for UI changes, or logs.
- Do not commit secrets, keys, credentials, or local environment files.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities. Never open public issues for private security reports.

## Documentation

Contributions to documentation are welcome. See the `docs/` directory for platform-specific guides:

- [macOS and Linux Packaging Guide](docs/macos-linux-packaging.md)
- [Windows First Run](docs/windows-first-run.md)
- [Windows Release Notes](docs/windows-release.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
