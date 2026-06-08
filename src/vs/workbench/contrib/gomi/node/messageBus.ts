type GomiListener<T> = (event: T) => void;

export class GomiMessageBus<TEvent extends { type: string }> {
  private readonly listeners = new Map<TEvent['type'], Set<GomiListener<TEvent>>>();

  subscribe(type: TEvent['type'], listener: GomiListener<TEvent>): () => void {
    const listenersForType = this.listeners.get(type) ?? new Set<GomiListener<TEvent>>();
    listenersForType.add(listener);
    this.listeners.set(type, listenersForType);

    return () => {
      listenersForType.delete(listener);
      if (listenersForType.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  publish(event: TEvent): void {
    const listenersForType = this.listeners.get(event.type);

    if (!listenersForType) {
      return;
    }

    for (const listener of listenersForType) {
      listener(event);
    }
  }
}
