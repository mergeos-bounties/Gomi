import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStreamThrottle } from '../src/vs/workbench/contrib/gomi/node/streamThrottle';

describe('StreamThrottle', () => {
  let onFlush: ReturnType<typeof vi.fn>;
  let now: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFlush = vi.fn();
    now = vi.fn(() => 0);
  });

  it('flushes first chunk immediately', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.push('chunk1');

    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush).toHaveBeenCalledWith('chunk1');
  });

  it('buffers chunks within interval window', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.push('chunk1');
    now.mockReturnValue(50); // 50ms elapsed
    throttle.push('chunk2');
    throttle.push('chunk3');

    // Only first chunk flushed, rest buffered
    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush).toHaveBeenCalledWith('chunk1');
  });

  it('flushes buffer when interval elapses', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.push('chunk1');
    now.mockReturnValue(50);
    throttle.push('chunk2');

    // Simulate timeout callback
    now.mockReturnValue(100);
    throttle.flush();

    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenNthCalledWith(1, 'chunk1');
    expect(onFlush).toHaveBeenNthCalledWith(2, 'chunk2');
  });

  it('flushes remaining buffer on dispose', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.push('chunk1');
    now.mockReturnValue(50);
    throttle.push('chunk2');
    throttle.push('chunk3');

    throttle.dispose();

    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenNthCalledWith(2, 'chunk2chunk3');
  });

  it('ignores pushes after dispose', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.push('chunk1');
    throttle.dispose();
    throttle.push('chunk2');

    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush).toHaveBeenCalledWith('chunk1');
  });

  it('ignores empty chunks', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.push('chunk1');
    throttle.push('');
    throttle.push('');

    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush).toHaveBeenCalledWith('chunk1');
  });

  it('coalesces multiple buffered chunks into single flush', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.push('a');
    now.mockReturnValue(50);
    throttle.push('b');
    throttle.push('c');
    throttle.push('d');
    now.mockReturnValue(100);
    throttle.flush();

    expect(onFlush).toHaveBeenNthCalledWith(2, 'bcd');
  });

  it('does not call onFlush for empty buffer on dispose', () => {
    const throttle = createStreamThrottle({
      intervalMs: 100,
      onFlush,
      now
    });

    throttle.dispose();

    expect(onFlush).not.toHaveBeenCalled();
  });

  it('respects negative interval as zero', () => {
    const throttle = createStreamThrottle({
      intervalMs: -50,
      onFlush,
      now
    });

    throttle.push('chunk1');
    now.mockReturnValue(1);
    throttle.push('chunk2');

    // Second push should flush immediately because interval is 0
    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenNthCalledWith(2, 'chunk2');
  });
});
