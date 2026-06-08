export const GOMI_EVENT_NAMES = {
  sessionStarted: 'gomi.session.started',
  agentStatus: 'gomi.agent.status',
  message: 'gomi.message',
  taskUpdate: 'gomi.task.update',
  patch: 'gomi.patch',
  report: 'gomi.report',
  sessionCompleted: 'gomi.session.completed'
} as const;

export type GomiEventName = (typeof GOMI_EVENT_NAMES)[keyof typeof GOMI_EVENT_NAMES];
