import { describe, expect, it, vi } from 'vitest';
import { AgentToastManager } from '../src/vs/workbench/contrib/gomi/browser/agentToasts';

describe('AgentToastManager', () => {
  it('notifies subscribers when agent finishes', () => {
    const mgr = new AgentToastManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.agentFinished('backend', 'Backend Agent');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      agentId: 'backend',
      type: 'success',
    });
  });

  it('notifies subscribers when agent is blocked', () => {
    const mgr = new AgentToastManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.agentBlocked('qa', 'QA Agent', 'waiting for build');
    expect(listener.mock.calls[0][0]).toMatchObject({
      type: 'warning',
      message: expect.stringContaining('waiting for build'),
    });
  });

  it('notifies subscribers on error', () => {
    const mgr = new AgentToastManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.agentError('frontend', 'Frontend Agent', 'Connection timeout');
    expect(listener.mock.calls[0][0].type).toBe('error');
  });

  it('respects max toast limit', () => {
    const mgr = new AgentToastManager(3);
    for (let i = 0; i < 5; i++) {
      mgr.agentFinished('agent', `Agent ${i}`);
    }
    expect(mgr.getRecent()).toHaveLength(3);
  });

  it('unsubscribe works', () => {
    const mgr = new AgentToastManager();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.agentFinished('agent', 'Test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('clear removes all toasts', () => {
    const mgr = new AgentToastManager();
    mgr.agentFinished('agent', 'Test');
    mgr.clear();
    expect(mgr.getRecent()).toHaveLength(0);
  });
});
