import type { JsonObject, JsonValue } from "@/shared/types/json";

export interface SecretRecord<T = JsonValue> {
  id: string;
  scope: string; // global | project:{id}
  type: string; // instagram | youtube | custom
  version: number;
  data: T;
  meta?: JsonObject;
  createdAt: Date;
}
