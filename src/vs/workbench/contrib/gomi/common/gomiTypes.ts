export type GomiAgentId =
  | 'ceo'
  | 'system-analyst'
  | 'backend'
  | 'frontend'
  | 'designer'
  | 'database'
  | 'qa'
  | 'devops';

export type GomiAgentStatus =
  | 'idle'
  | 'planning'
  | 'working'
  | 'waiting'
  | 'reviewing'
  | 'sleeping'
  | 'done'
  | 'blocked';

export type GomiTaskStatus = 'queued' | 'running' | 'done' | 'blocked';
export type GomiPatchApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applying'
  | 'applied'
  | 'failed';
export type GomiPatchRiskLevel = 'low' | 'medium' | 'high';
export type GomiMemoryKind = 'request' | 'workspace' | 'agent_result' | 'patch' | 'report';
export type GomiMemoryPrivacyMode = 'standard' | 'strict';
export type GomiAgentCliProviderId =
  | 'codex-cli'
  | 'claude-code'
  | 'gemini-cli'
  | 'aider-cli'
  | 'cursor-style-agent'
  | 'local-llm'
  | 'demo-runtime';
export type GomiAgentSeatKind = 'executive' | 'department-head' | 'employee';
export type GomiAgentWorkMode = 'active' | 'sleeping' | 'fired';

export interface GomiAgentCliProvider {
  id: GomiAgentCliProviderId;
  label: string;
  command: string;
  description: string;
}

export interface GomiAgentSeat {
  id: string;
  agentId: GomiAgentId;
  name: string;
  role: string;
  seatKind: GomiAgentSeatKind;
  providerId: GomiAgentCliProviderId;
  workMode: GomiAgentWorkMode;
  canSleep: boolean;
  canFire: boolean;
  departmentId?: GomiAgentId;
}

export interface GomiOfficeMemorySettings {
  retrievalMode: 'hybrid-vector';
  sharedMemoryEnabled: boolean;
  indexWorkspaceContext: boolean;
  privacyMode: GomiMemoryPrivacyMode;
  redactSecrets: boolean;
  retentionDays: number;
  maxProjectMemoryItems: number;
  broadcastThreshold: number;
  requirePatchApproval: boolean;
}

export interface GomiOfficeSettings {
  seats: GomiAgentSeat[];
  memory: GomiOfficeMemorySettings;
}

export interface GomiAgent {
  id: GomiAgentId;
  name: string;
  role: string;
  status: GomiAgentStatus;
  currentTaskId?: string;
  position: {
    x: number;
    y: number;
  };
}

export interface GomiTask {
  id: string;
  title: string;
  detail: string;
  agentId: GomiAgentId;
  status: GomiTaskStatus;
  progress: number;
}

export interface GomiChatMessage {
  id: string;
  senderId: GomiAgentId | 'user' | 'system' | 'pet-gomi';
  senderName: string;
  content: string;
  createdAt: string;
}

export interface GomiReportSection {
  title: string;
  lines: string[];
}

export interface GomiFinalReport {
  summary: string;
  sections: GomiReportSection[];
}

export interface GomiPatchProposal {
  id: string;
  filePath: string;
  targetFiles: string[];
  summary: string;
  diff: string;
  approvalStatus: GomiPatchApprovalStatus;
  riskLevel: GomiPatchRiskLevel;
  createdByAgentId: GomiAgentId;
}

export interface GomiPatchPreviewResult {
  patchId: string;
  previewedFiles: string[];
  skippedFiles: string[];
}

export interface GomiWorkspaceSnapshot {
  rootName: string;
  files: string[];
  openEditors: string[];
  gitSummary: string;
  terminalSummary: string;
  contentSnippets?: GomiWorkspaceContentSnippet[];
}

export interface GomiWorkspaceContentSnippet {
  filePath: string;
  content: string;
  language?: string;
  source: 'workspace' | 'open_editor' | 'selection' | 'terminal' | 'diagnostic' | 'error_log' | 'git_diff';
}

export interface GomiAgentResult {
  agentId: GomiAgentId;
  taskId: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  proposedFiles: string[];
  confidence: number;
}

export interface GomiMemoryEntry {
  id: string;
  sessionId: string;
  kind: GomiMemoryKind;
  content: string;
  createdAt: string;
  agentId?: GomiAgentId;
  taskId?: string;
}

export interface GomiMemoryBoardItem {
  id: string;
  key: string;
  title: string;
  content: string;
  source: 'session' | 'project';
  kind: GomiMemoryKind | 'shared_project';
  createdAt: string;
  importance?: number;
  shouldBroadcast?: boolean;
  agentId?: GomiAgentId;
  taskId?: string;
}

export type GomiRuntimeEvent =
  | {
      type: 'session_started';
      sessionId: string;
      request: string;
      workspace: GomiWorkspaceSnapshot;
    }
  | {
      type: 'agent_status';
      agentId: GomiAgentId;
      status: GomiAgentStatus;
      currentTaskId?: string;
    }
  | {
      type: 'message';
      message: GomiChatMessage;
    }
  | {
      type: 'task_update';
      task: GomiTask;
    }
  | {
      type: 'agent_result';
      result: GomiAgentResult;
    }
  | {
      type: 'memory_update';
      item: GomiMemoryBoardItem;
    }
  | {
      type: 'patch';
      patch: GomiPatchProposal;
    }
  | {
      type: 'report';
      report: GomiFinalReport;
    }
  | {
      type: 'session_completed';
      sessionId: string;
    };
