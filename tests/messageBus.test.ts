import { describe, expect, it } from 'vitest';
import { GomiMessageBus } from '../src/vs/workbench/contrib/gomi/node/messageBus';

describe('GomiMessageBus', () => {
  it('publishes events to matching subscribers', () => {
    const bus = new GomiMessageBus<{ type: 'done'; value: number }>();
    const values: number[] = [];

    bus.subscribe('done', (event) => values.push(event.value));
    bus.publish({ type: 'done', value: 7 });

    expect(values).toEqual([7]);
  });
});
