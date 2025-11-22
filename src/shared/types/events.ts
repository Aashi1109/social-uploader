import { EventName } from "@/shared/constants";
import type { JsonSchema } from "@/shared/types/json";

export type CanonicalEventName = EventName;

export interface CanonicalEvent {
  timestamp: string;
  traceId: string;
  projectId: string;
  platform?: string;
  step?: string;
  status?: "success" | "failed" | "running" | "skipped";
  duration_ms?: number;
  meta?: JsonSchema;
  name: CanonicalEventName;
}
