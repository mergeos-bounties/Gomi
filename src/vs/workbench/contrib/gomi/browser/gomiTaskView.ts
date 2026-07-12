import type { GomiTask } from '../common/gomiTypes';

export function upsertGomiTask(tasks: GomiTask[], nextTask: GomiTask): GomiTask[] {
  const exists = tasks.some((task) => task.id === nextTask.id);

  if (!exists) {
    return [...tasks, nextTask];
  }

  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
}

export function countCompletedGomiTasks(tasks: GomiTask[]): number {
  return tasks.filter((task) => task.status === 'done').length;
}

export function formatGomiTaskStatusLabel(task: GomiTask): string {
  return task.statusDetail ? `${task.status} · ${task.statusDetail}` : task.status;
}
