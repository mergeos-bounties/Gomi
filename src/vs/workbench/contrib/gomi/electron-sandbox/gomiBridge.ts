import type {
  GomiOfficeSettings,
  GomiPatchPreviewResult,
  GomiPatchProposal,
  GomiRuntimeEvent
} from '../common/gomiTypes';
import type { GomiRuntimeMemoryPruneReport } from '../node/agentRuntime';
import type { GomiPatchApplyResult } from '../node/workspacePatchApplier';

export type GomiBridgeMessage =
  | {
      type: 'gomi.run';
      request: string;
      officeSettings?: GomiOfficeSettings;
    }
  | {
      type: 'gomi.stop';
      reason?: string;
    }
  | {
      type: 'gomi.pruneMemory';
      officeSettings?: GomiOfficeSettings;
    }
  | {
      type: 'gomi.pruneMemoryResult';
      report?: GomiRuntimeMemoryPruneReport;
      error?: string;
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
      type: 'gomi.previewPatch';
      patch: GomiPatchProposal;
    }
  | {
      type: 'gomi.previewPatchResult';
      patchId: string;
      result?: GomiPatchPreviewResult;
      error?: string;
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
