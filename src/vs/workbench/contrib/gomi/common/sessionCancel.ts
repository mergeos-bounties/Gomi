/** Runtime cancel/stop in-flight session (issue #8) */
export interface CancellableSession { id: string; status: 'running' | 'cancelling' | 'cancelled'; cancelReason?: string; }
export class SessionCancellationManager {
  private sessions = new Map<string, AbortController>();
  createSession(sessionId: string): AbortSignal {
    const controller = new AbortController();
    this.sessions.set(sessionId, controller);
    return controller.signal;
  }
  cancel(sessionId: string, reason?: string): boolean {
    const controller = this.sessions.get(sessionId);
    if (!controller) return false;
    controller.abort();
    this.sessions.delete(sessionId);
    return true;
  }
  isCancelled(sessionId: string): boolean {
    const controller = this.sessions.get(sessionId);
    return controller ? controller.signal.aborted : false;
  }
  remove(sessionId: string): void { this.sessions.delete(sessionId); }
}
