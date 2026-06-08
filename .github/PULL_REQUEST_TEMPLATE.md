## Summary

This pull request introduces the Gomi IDE foundation: a Code - OSS fork direction with Gomi branding, a multi-agent office workflow, and a visual Gomi Office experience for planning and reviewing software work.

## Highlights

- Adds Gomi product branding metadata.
- Adds the `src/vs/workbench/contrib/gomi` module structure for future Code - OSS integration.
- Adds a React workbench demo for the Gomi Office panel.
- Adds a Phaser 2D office scene with animated game-style agents, a memory board, and chat bubbles.
- Adds a CEO Agent runtime simulation with task planning, event streaming, final reports, and patch proposals.
- Adds tests for the message bus, planner, and runtime flow.

## Screenshot

![Gomi Office IDE interface](docs/images/gomi-office-cute-office.png)

## Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Visual QA confirms the Phaser office canvas renders agents, memory board, and chat bubbles.

## Notes

This is not a VS Code extension release. It is a scaffold for a standalone Gomi IDE direction based on a Code - OSS fork.
