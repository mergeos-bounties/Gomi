import type { GomiPatchProposal, GomiRuntimeEvent } from '../common/gomiTypes';
import type { GomiPatchApplyResult } from '../node/workspacePatchApplier';

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
    }
  | {
      type: 'gomi.applyPatchResult';
      patchId: string;
      result?: GomiPatchApplyResult;
      error?: string;
    };

export interface GomiWorkbenchBridge {
  postMessage(message: GomiBridgeMessage): void;
  onMessage(listener: (message: GomiBridgeMessage) => void): () => void;
}
