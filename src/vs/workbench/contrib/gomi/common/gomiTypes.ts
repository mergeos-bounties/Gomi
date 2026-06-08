export type GomiAgentId =
  | 'ceo'
  | 'system-analyst'
  | 'backend'
  | 'frontend'
  | 'database'
  | 'qa'
  | 'devops';

export type GomiAgentStatus =
  | 'idle'
  | 'planning'
  | 'working'
  | 'waiting'
  | 'reviewing'
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

export interface GomiWorkspaceSnapshot {
  rootName: string;
  files: string[];
  openEditors: string[];
  gitSummary: string;
  terminalSummary: string;
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
