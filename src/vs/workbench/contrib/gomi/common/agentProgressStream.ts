/** Stream agent progress into chat bubbles (#10) */
export interface ProgressChunk { agentId: string; taskId: string; chunk: string; timestamp: number; done: boolean }
export type ProgressListener = (chunk: ProgressChunk) => void;
export class AgentProgressStream {
  private listeners = new Set<ProgressListener>();
  private active = new Map<string, { taskId: string; buffer: string }>();
  start(agentId: string, taskId: string): void { this.active.set(agentId, { taskId, buffer: '' }); }
  emit(agentId: string, chunk: string, done = false): void {
    const session = this.active.get(agentId);
    if (!session) return;
    session.buffer += chunk;
    const pc: ProgressChunk = { agentId, taskId: session.taskId, chunk, timestamp: Date.now(), done };
    for (const l of this.listeners) { try { l(pc); } catch {} }
    if (done) this.active.delete(agentId);
  }
  subscribe(listener: ProgressListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getActive(): string[] { return Array.from(this.active.keys()); }
}
