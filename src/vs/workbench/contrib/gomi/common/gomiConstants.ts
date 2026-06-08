import type { GomiAgent } from './gomiTypes';

export const GOMI_VIEW_ID = 'workbench.view.gomiOffice';
export const GOMI_COMMAND_OPEN_OFFICE = 'gomi.openOffice';
export const GOMI_COMMAND_RUN_AGENT_TASK = 'gomi.runAgentTask';
export const GOMI_COMMAND_STOP_AGENT_TASK = 'gomi.stopAgentTask';

export const BASE_GOMI_AGENTS: GomiAgent[] = [
  {
    id: 'ceo',
    name: 'CEO Agent',
    role: 'Planning and delegation',
    status: 'idle',
    position: { x: 22, y: 35 }
  },
  {
    id: 'system-analyst',
    name: 'System Analyst',
    role: 'Requirements and module map',
    status: 'idle',
    position: { x: 30, y: 46 }
  },
  {
    id: 'backend',
    name: 'Backend Agent',
    role: 'API and service logic',
    status: 'idle',
    position: { x: 50, y: 60 }
  },
  {
    id: 'frontend',
    name: 'Frontend Agent',
    role: 'Workbench and webview UI',
    status: 'idle',
    position: { x: 74, y: 45 }
  },
  {
    id: 'designer',
    name: 'Designer Agent',
    role: 'UX, visual language, and game-like character feel',
    status: 'idle',
    position: { x: 88, y: 52 }
  },
  {
    id: 'database',
    name: 'Database Agent',
    role: 'Schema and storage review',
    status: 'idle',
    position: { x: 30, y: 72 }
  },
  {
    id: 'qa',
    name: 'QA Agent',
    role: 'Tests and quality gates',
    status: 'idle',
    position: { x: 58, y: 75 }
  },
  {
    id: 'devops',
    name: 'DevOps Agent',
    role: 'Build and packaging',
    status: 'idle',
    position: { x: 82, y: 72 }
  }
];

export const GOMI_SAMPLE_REQUEST =
  'Build a restaurant management API, review the UI flow, and prepare a patch plan.';
