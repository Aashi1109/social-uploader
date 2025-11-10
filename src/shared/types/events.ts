import { EventName } from "@/shared/constants";
import type { JsonObject } from "@/shared/types/json";

export type CanonicalEventName = EventName;

export interface CanonicalEvent {
  timestamp: string;
  traceId: string;
  projectId: string;
  platform?: string;
  step?: string;
  status?: "success" | "failed" | "running" | "skipped";
  duration_ms?: number;
  meta?: JsonObject;
  name: CanonicalEventName;
}
