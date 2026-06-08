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
  summary: string;
  diff: string;
}

export interface GomiWorkspaceSnapshot {
  rootName: string;
  files: string[];
  openEditors: string[];
  gitSummary: string;
  terminalSummary: string;
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
