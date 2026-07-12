import { describe, expect, it } from 'vitest';
import type { GomiTask } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import { formatGomiTaskStatusLabel } from '../src/vs/workbench/contrib/gomi/browser/gomiTaskView';

describe('Gomi task view helpers', () => {
  it('shows retry attempts inside the task status label', () => {
    const task: GomiTask = {
      id: 'task-http-backend',
      title: 'Run backend',
      detail: 'Use HTTP provider.',
      agentId: 'backend',
      status: 'running',
      progress: 42,
      statusDetail: 'Retry attempt 2/3 after HTTP 429'
    };

    expect(formatGomiTaskStatusLabel(task)).toBe('running · Retry attempt 2/3 after HTTP 429');
  });
});
