/**
 * StreamThrottle coalesces high-frequency streaming chunks into a bounded
 * number of flushes so live agent output can be surfaced to the Office UI
 * without flooding it with an update per byte.
 *
 * - The first chunk flushes immediately (so streaming "feels live").
 * - Subsequent chunks that arrive within `intervalMs` of the last flush are
 *   buffered and released on a trailing flush.
 * - `dispose()` flushes any remaining buffered content (called when a task
 *   completes) so no trailing output is lost.
 */
export interface StreamThrottleOptions {
  /** Minimum time between flushes, in milliseconds. */
  intervalMs: number;
  /** Invoked with the accumulated payload on each flush. */
  onFlush: (payload: string) => void;
  /** Injectable clock for deterministic testing. Defaults to Date.now. */
  now?: () => number;
}

export class StreamThrottle {
  private buffer = '';
  private lastFlush = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly onFlush: (payload: string) => void;

  constructor(options: StreamThrottleOptions) {
    this.intervalMs = Math.max(0, options.intervalMs);
    this.onFlush = options.onFlush;
    this.now = options.now ?? (() => Date.now());
  }

  /** Queue a chunk. Flushes immediately if the throttle window has elapsed. */
  push(chunk: string): void {
    if (this.disposed || chunk.length === 0) {
      return;
    }

    this.buffer += chunk;
    const elapsed = this.now() - this.lastFlush;

    if (elapsed >= this.intervalMs) {
      this.flush();
      return;
    }

    if (this.timer === undefined) {
      const remaining = Math.max(0, this.intervalMs - elapsed);
      this.timer = globalThis.setTimeout(() => this.flush(), remaining);
    }
  }

  /** Emit any buffered content now and reset the throttle window. */
  flush(): void {
    if (this.timer !== undefined) {
      globalThis.clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const payload = this.buffer;
    this.buffer = '';
    this.lastFlush = this.now();
    this.onFlush(payload);
  }

  /** Flush remaining content and stop accepting further chunks. */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.flush();
    this.disposed = true;

    if (this.timer !== undefined) {
      globalThis.clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}

export function createStreamThrottle(options: StreamThrottleOptions): StreamThrottle {
  return new StreamThrottle(options);
}
