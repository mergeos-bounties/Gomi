import { describe, expect, it } from 'vitest';
import { GomiTaskPlanner } from '../src/vs/workbench/contrib/gomi/node/taskPlanner';
import { createDemoWorkspaceSnapshot } from '../src/vs/workbench/contrib/gomi/node/workspaceReader';

describe('GomiTaskPlanner', () => {
  it('creates a multi-agent plan from a project request', () => {
    const planner = new GomiTaskPlanner();
    const tasks = planner.createPlan(
      'Fix login API, check database migration, and prepare build package',
      createDemoWorkspaceSnapshot()
    );
    const agentIds = tasks.map((task) => task.agentId);

    expect(agentIds).toContain('system-analyst');
    expect(agentIds).toContain('backend');
    expect(agentIds).toContain('designer');
    expect(agentIds).toContain('database');
    expect(agentIds).toContain('devops');
    expect(agentIds).toContain('qa');
  });
});
