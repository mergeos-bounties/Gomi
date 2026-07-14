# Security Policy

## Reporting a vulnerability

**Do not open a public issue.** Email the maintainers directly.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x (master) | Yes |

## Security model

Gomi IDE runs on your local machine. Key trust boundaries:

### Provider API keys
Store provider keys via Electron `safeStorage` (or OS keychain) when packaged. Never commit keys or write them into plain JSON. For the web prototype, use environment variables with a memory-only fallback.

### Workspace access
- Agents run with the user's filesystem permissions
- Patch approval is required before any file modification
- The patch applier blocks path escape outside the workspace root
- Workspace trust state gates live provider execution

### Webview bridge
All messages crossing the webview/host boundary are validated:
- Protocol version enforcement
- Payload size limits (64 KB)
- Strict schema validation per message type
- Unknown or malformed messages are rejected with a safe error event

### Memory & privacy
- `.env` and secret files are excluded from indexing
- Memory retention is configurable (days / item cap)
- Strict privacy mode redacts sensitive patterns

## Disclosure timeline

- Acknowledgment within 48 hours
- Fix within 7 days for critical issues
- Public disclosure after fix is merged and released

## Out of scope

- Social engineering
- Physical access attacks
- Denial of service via resource exhaustion (file count, payload size)

Thank you for helping keep Gomi IDE secure.
