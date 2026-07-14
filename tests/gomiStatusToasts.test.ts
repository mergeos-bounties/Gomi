import { describe, expect, it } from 'vitest';
import {
  enqueueStatusToast,
  type GomiStatusToast
} from '../src/vs/workbench/contrib/gomi/browser/gomiStatusToasts';

describe('Gomi status toasts', () => {
  it('keeps the latest three unique terminal transitions', () => {
    const toast = (id: number, agentId: GomiStatusToast['agentId']): GomiStatusToast => ({
      id,
      agentId,
      agentName: agentId,
      status: 'done'
    });
    const first = toast(1, 'backend');
    const toasts = [first, toast(2, 'frontend'), toast(3, 'qa'), toast(4, 'devops')]
      .reduce(enqueueStatusToast, [] as GomiStatusToast[]);

    expect(toasts.map((item) => item.id)).toEqual([2, 3, 4]);
    expect(enqueueStatusToast(toasts, toast(5, 'qa'))).toBe(toasts);
  });
});
