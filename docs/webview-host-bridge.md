# Gomi Webview ↔ Host Bridge

This document describes the message bridge that carries commands and results
between the **webview (renderer)** and the **workbench host (extension host)**
in the Gomi office extension. It is the single enforcement point for every
message that crosses the webview↔host boundary.

- **Webview side** — `gomiWebviewBridge.ts` (browser)
- **Host side** — `gomiWebviewHostBridge.ts` (browser, runs in the workbench)
- **Shared contract** — `gomiBridge.ts` (electron-sandbox): protocol version,
  message union type, and the `GomiWorkbenchBridge` interface.

---

## 1. Why a typed bridge exists

The webview is an **untrusted** context. Anything rendered there (agent UI,
office panels, preview surfaces) can be influenced by user or model input, so
the host must never trust a raw `postMessage` payload. The bridge therefore:

1. Wraps every outbound message with a protocol version (`withGomiBridgeProtocol`).
2. Validates every inbound message against a structural predicate (`isGomiBridgeMessage`).
3. Rejects anything that does not conform, and reports a typed `gomi.bridgeError`
   back to the webview instead of dispatching it to listeners.

This keeps the rest of the extension (`agentRuntime`, `workspacePatchApplier`,
etc.) able to assume messages are already well-formed.

---

## 2. Protocol versioning

The version is a single constant in `electron-sandbox/gomiBridge.ts`:

```ts
export const GOMI_BRIDGE_PROTOCOL_VERSION = 1;
```

Every message carries an optional `protocolVersion` field:

```ts
export type GomiBridgeMessage = {
  protocolVersion?: GomiBridgeProtocolVersion;
} & (
  | { type: 'gomi.run'; request: string; officeSettings?: GomiOfficeSettings }
  | { type: 'gomi.stop'; reason?: string }
  // … (full union below)
);
```

Rules:

- `protocolVersion` is **optional but strongly recommended**. The host accepts
  messages that omit it for backward compatibility, but new integrations should
  always set it.
- When the protocol inevitably changes (new message kinds, renamed fields), the
  version is bumped and the host can branch on it without breaking old webviews.

---

## 3. Message envelope

`GomiBridgeMessage` is a discriminated union. The discriminator is `type`.
Every variant is listed below.

### Agent execution

| `type` | Payload | Direction | Purpose |
|---|---|---|---|
| `gomi.run` | `request: string`, `officeSettings?` | webview → host | Start an agent run. |
| `gomi.stop` | `reason?: string` | webview → host | Cancel the current run. |

### Memory

| `type` | Payload | Direction | Purpose |
|---|---|---|---|
| `gomi.pruneMemory` | `officeSettings?` | webview → host | Request a memory prune. |
| `gomi.pruneMemoryResult` | `report?`, `error?` | host → webview | Prune outcome. |

### Projects

| `type` | Payload | Direction | Purpose |
|---|---|---|---|
| `gomi.openProject` | `project: GomiRecentProject` | webview → host | Open a recent project. |

### Patch flow

| `type` | Payload | Direction | Purpose |
|---|---|---|---|
| `gomi.applyPatch` | `patch: GomiPatchProposal` | webview → host | Apply a proposed patch. |
| `gomi.previewPatch` | `patch: GomiPatchProposal` | webview → host | Preview a proposed patch. |
| `gomi.applyPatchResult` | `patchId`, `result?`, `error?` | host → webview | Apply outcome. |
| `gomi.previewPatchResult` | `patchId`, `result?`, `error?` | host → webview | Preview outcome. |

### Runtime events

| `type` | Payload | Direction | Purpose |
|---|---|---|---|
| `gomi.event` | `event: GomiRuntimeEvent` | host → webview | Stream a runtime event. |

### Errors

| `type` | Payload | Direction | Purpose |
|---|---|---|---|
| `gomi.bridgeError` | `code: 'invalid_message'`, `message: string` | host → webview | A rejected inbound message. |

---

## 4. Webview side

`resolveGomiWebviewBridgeContext` wires the bridge only when the webview was
opened with the bridge enabled:

```ts
if (!globalObject.__GOMI_ENABLE_WORKBENCH_BRIDGE__ || !globalObject.acquireVsCodeApi || !eventTarget) {
  return undefined;
}
```

When enabled, it returns:

```ts
{
  bridge: createGomiWebviewBridge(api, eventTarget),
  stateStore: createGomiWebviewStateStore(api)
}
```

`createGomiWebviewBridge.postMessage` always wraps the payload with
`withGomiBridgeProtocol`, so a raw `GomiBridgeMessage` never leaves the webview
without its envelope.

---

## 5. Host side

`GomiWebviewHostBridge` is the host-side implementation of
`GomiWorkbenchBridge`. Its constructor subscribes to the native webview
`onMessage` and does the following for every inbound payload:

```ts
this.webview.onMessage((event) => {
  if (!isGomiBridgeMessage(event.message)) {
    if (shouldReportInvalidGomiBridgeMessage(event.message)) {
      void this.webview.postMessage(createGomiBridgeErrorMessage());
    }
    return;
  }
  for (const listener of this.listeners) {
    listener(event.message);
  }
});
```

Flow:

1. **Structural check** — `isGomiBridgeMessage` confirms the payload is a
   non-null object with a known `type` and valid `protocolVersion`.
2. **Report invalid** — `shouldReportInvalidGomiBridgeMessage` decides whether
   the rejection is worth surfacing (avoids spamming the webview on noise).
3. **Reject** — a `gomi.bridgeError` with `code: 'invalid_message'` is posted
   back, and the payload is **not** forwarded to listeners.
4. **Dispatch** — valid messages fan out to every registered listener.

Listeners register via `onMessage(listener)` which returns an unsubscribe
function; `dispose()` clears the listener set and disposes the native
subscription.

---

## 6. Security model

- The **host is the enforcement point**; the webview is assumed untrusted.
- No inbound message reaches `agentRuntime` / `workspacePatchApplier` without
  passing `isGomiBridgeMessage`.
- Outbound host messages are also wrapped with `withGomiBridgeProtocol`, so the
  webview can apply the same structural check on its side if desired.
- Invalid messages are answered with a typed error instead of being silently
  dropped, which makes integration failures diagnosable.

---

## 7. Adding a new message type

1. Add a new variant to the `GomiBridgeMessage` union in
   `electron-sandbox/gomiBridge.ts`.
2. Update `isGomiBridgeMessage` (in `gomiWebviewBridge.ts`) to recognise the new
   `type` and validate its payload fields.
3. Emit the message from the webview through
   `createGomiWebviewBridge(...).postMessage(...)` (envelope is added for you).
4. Subscribe on the host with `onMessage` and handle the new `type`.
5. Bump `GOMI_BRIDGE_PROTOCOL_VERSION` if the change is breaking.

---

## 8. Testing

Host-side validation is unit-tested with a fake webview host; webview-side
resolution is tested with a stubbed `globalThis` and a synthetic `MessageEvent`
target. Existing test suites live alongside the bridge sources under
`src/vs/workbench/contrib/gomi/browser/`.

When adding a validation rule, add a matching case that:

- constructs a well-formed message and asserts it is dispatched;
- constructs a malformed message and asserts a `gomi.bridgeError` is posted and
  **no** listener is invoked.
