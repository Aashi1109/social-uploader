export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonArray
  | JsonPrimitive
  | undefined;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = JsonValue[];

// Minimal JSON Schema shape for Ajv usage without importing its types
export type JsonSchema = Record<string, any>;
