import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../electron-sandbox/gomiBridge';

export interface GomiVsCodeWebviewApi {
  postMessage(message: GomiBridgeMessage): void;
  getState?(): unknown;
  setState?(state: unknown): void;
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
  if (!globalObject.__GOMI_ENABLE_WORKBENCH_BRIDGE__ || !globalObject.acquireVsCodeApi || !eventTarget) {
    return undefined;
  }

  return createGomiWebviewBridge(globalObject.acquireVsCodeApi(), eventTarget);
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
        if (isGomiBridgeMessage(event.data)) {
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

export function isGomiBridgeMessage(value: unknown): value is GomiBridgeMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    value.type.startsWith('gomi.')
  );
}
