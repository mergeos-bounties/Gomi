/**
 * Agent status toasts (issue #18).
 * Lightweight notification system for agent state changes.
 */

export type AgentToastType = 'info' | 'success' | 'warning' | 'error';

export interface AgentToast {
  id: string;
  agentId: string;
  agentName: string;
  message: string;
  type: AgentToastType;
  timestamp: number;
}

export type ToastListener = (toast: AgentToast) => void;

export class AgentToastManager {
  private listeners = new Set<ToastListener>();
  private toasts: AgentToast[] = [];
  private idCounter = 0;
  private maxToasts: number;

  constructor(maxToasts = 10) {
    this.maxToasts = maxToasts;
  }

  notify(
    agentId: string,
    agentName: string,
    message: string,
    type: AgentToastType = 'info'
  ): AgentToast {
    const toast: AgentToast = {
      id: `toast-${++this.idCounter}`,
      agentId,
      agentName,
      message,
      type,
      timestamp: Date.now(),
    };

    this.toasts.push(toast);
    if (this.toasts.length > this.maxToasts) {
      this.toasts.shift();
    }

    for (const listener of this.listeners) {
      try { listener(toast); } catch { /* ignore listener errors */ }
    }

    return toast;
  }

  agentFinished(agentId: string, agentName: string): AgentToast {
    return this.notify(agentId, agentName, `${agentName} finished successfully.`, 'success');
  }

  agentBlocked(agentId: string, agentName: string, reason?: string): AgentToast {
    return this.notify(
      agentId,
      agentName,
      `${agentName} is blocked${reason ? `: ${reason}` : '.'}`,
      'warning'
    );
  }

  agentError(agentId: string, agentName: string, error: string): AgentToast {
    return this.notify(agentId, agentName, `${agentName} encountered an error: ${error}`, 'error');
  }

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getRecent(count?: number): AgentToast[] {
    const n = count ?? this.maxToasts;
    return this.toasts.slice(-n);
  }

  clear(): void {
    this.toasts = [];
  }
}
