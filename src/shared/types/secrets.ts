import type { JsonSchema, JsonSchema } from "@/shared/types/json";

export interface SecretRecord<T = JsonSchema> {
  id: string;
  scope: string; // global | project:{id}
  type: string; // instagram | youtube | custom
  version: number;
  data: T;
  meta?: JsonSchema;
  createdAt: Date;
}
