import type { GomiAgentId } from '../common/gomiTypes';

export interface GomiStatusToast {
  id: number;
  agentId: GomiAgentId;
  agentName: string;
  status: 'done' | 'blocked';
}

export function enqueueStatusToast(
  toasts: GomiStatusToast[],
  toast: GomiStatusToast
): GomiStatusToast[] {
  if (toasts.some((item) => item.agentId === toast.agentId && item.status === toast.status)) {
    return toasts;
  }

  return [...toasts, toast].slice(-3);
}
