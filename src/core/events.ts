import { EventEmitter } from "node:events";
import type { CanonicalEvent } from "@/shared/types/events";

class EventBus extends EventEmitter {
  emitEvent(event: CanonicalEvent): boolean {
    return this.emit("event", event);
  }
  onEvent(listener: (event: CanonicalEvent) => void): this {
    return this.on("event", listener);
  }
}

export const eventBus = new EventBus();
