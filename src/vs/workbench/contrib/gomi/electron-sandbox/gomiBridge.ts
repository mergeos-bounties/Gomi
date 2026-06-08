import type { GomiPatchProposal, GomiRuntimeEvent } from '../common/gomiTypes';

export type GomiBridgeMessage =
  | {
      type: 'gomi.run';
      request: string;
    }
  | {
      type: 'gomi.event';
      event: GomiRuntimeEvent;
    }
  | {
      type: 'gomi.applyPatch';
      patch: GomiPatchProposal;
    };

export interface GomiWorkbenchBridge {
  postMessage(message: GomiBridgeMessage): void;
  onMessage(listener: (message: GomiBridgeMessage) => void): () => void;
}
