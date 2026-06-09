import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../electron-sandbox/gomiBridge';

export interface GomiVsCodeWebviewApi {
  postMessage(message: GomiBridgeMessage): void;
  getState?(): unknown;
  setState?(state: unknown): void;
}

export interface GomiWebviewStateStore {
  getState(): unknown;
  setState(state: unknown): void;
}

export interface GomiWebviewBridgeContext {
  bridge: GomiWorkbenchBridge;
  stateStore: GomiWebviewStateStore;
}

export interface GomiWebviewBridgeGlobal {
  acquireVsCodeApi?: () => GomiVsCodeWebviewApi;
  __GOMI_ENABLE_WORKBENCH_BRIDGE__?: boolean;
}

export interface GomiMessageEventTarget {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export function resolveGomiWebviewBridge(
  globalObject: GomiWebviewBridgeGlobal = globalThis as GomiWebviewBridgeGlobal,
  eventTarget: GomiMessageEventTarget | undefined =
    typeof window !== 'undefined' ? window : undefined
): GomiWorkbenchBridge | undefined {
  return resolveGomiWebviewBridgeContext(globalObject, eventTarget)?.bridge;
}

export function resolveGomiWebviewBridgeContext(
  globalObject: GomiWebviewBridgeGlobal = globalThis as GomiWebviewBridgeGlobal,
  eventTarget: GomiMessageEventTarget | undefined =
    typeof window !== 'undefined' ? window : undefined
): GomiWebviewBridgeContext | undefined {
  if (!globalObject.__GOMI_ENABLE_WORKBENCH_BRIDGE__ || !globalObject.acquireVsCodeApi || !eventTarget) {
    return undefined;
  }

  const api = globalObject.acquireVsCodeApi();

  return {
    bridge: createGomiWebviewBridge(api, eventTarget),
    stateStore: createGomiWebviewStateStore(api)
  };
}

export function createGomiWebviewBridge(
  api: GomiVsCodeWebviewApi,
  eventTarget: GomiMessageEventTarget
): GomiWorkbenchBridge {
  return {
    postMessage(message) {
      api.postMessage(message);
    },

    onMessage(listener) {
      const messageListener = (event: MessageEvent) => {
        if (isTrustedGomiMessageEvent(event) && isGomiBridgeMessage(event.data)) {
          listener(event.data);
        }
      };

      eventTarget.addEventListener('message', messageListener);

      return () => {
        eventTarget.removeEventListener('message', messageListener);
      };
    }
  };
}

export function createGomiWebviewStateStore(api: GomiVsCodeWebviewApi): GomiWebviewStateStore {
  let fallbackState: unknown = {};

  return {
    getState() {
      return api.getState?.() ?? fallbackState;
    },

    setState(state) {
      fallbackState = state;
      api.setState?.(state);
    }
  };
}

const trustedGomiOriginPrefixes = ['vscode-webview://', 'vscode-file://'];

export function isTrustedGomiMessageEvent(event: Pick<MessageEvent, 'origin' | 'source'>): boolean {
  const origin = event.origin;

  if (typeof origin === 'string' && origin.length > 0) {
    const localOrigin = globalThis.location?.origin;
    const matchesOrigin =
      trustedGomiOriginPrefixes.some((prefix) => origin.startsWith(prefix)) ||
      (typeof localOrigin === 'string' && localOrigin.length > 0 && origin === localOrigin);

    if (!matchesOrigin) {
      return false;
    }
  }

  return true;
}

export function isGomiBridgeMessage(value: unknown): value is GomiBridgeMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    value.type.startsWith('gomi.')
  );
}
