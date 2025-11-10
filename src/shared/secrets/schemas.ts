import type { JsonSchema } from "@/shared/types/json";

// Single-source-of-truth schemas with x-meta annotations for UI
// x-meta at root: { displayName, description }
// x-meta at property: { label, inputType }
export type YouTubeSecret = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelId?: string;
};
export type InstagramSecret = {
  appId: string;
  appSecret: string;
  accessToken: string;
  businessAccountId: string;
};

export const SECRET_SCHEMAS: Record<string, JsonSchema> = {
  instagram: {
    $id: "secrets/instagram",
    type: "object",
    additionalProperties: false,
    "x-meta": {
      displayName: "Instagram",
      description:
        "Instagram Graph API credentials for publishing to Instagram Business accounts.",
    },
    required: ["appId", "appSecret", "accessToken", "businessAccountId"],
    properties: {
      appId: {
        type: "string",
        minLength: 1,
        "x-meta": { label: "App ID", inputType: "text" },
      },
      appSecret: {
        type: "string",
        minLength: 1,
        "x-meta": { label: "App Secret", inputType: "password" },
      },
      accessToken: {
        type: "string",
        minLength: 1,
        "x-meta": { label: "User Access Token", inputType: "password" },
      },
      businessAccountId: {
        type: "string",
        minLength: 1,
        "x-meta": { label: "Business Account ID", inputType: "text" },
      },
    },
  },
  youtube: {
    $id: "secrets/youtube",
    type: "object",
    additionalProperties: false,
    "x-meta": {
      displayName: "YouTube",
      description: "Google OAuth credentials for YouTube Data API publishing.",
    },
    required: ["clientId", "clientSecret", "refreshToken"],
    properties: {
      clientId: {
        type: "string",
        minLength: 1,
        "x-meta": { label: "Client ID", inputType: "text" },
      },
      clientSecret: {
        type: "string",
        minLength: 1,
        "x-meta": { label: "Client Secret", inputType: "password" },
      },
      refreshToken: {
        type: "string",
        minLength: 1,
        "x-meta": { label: "Refresh Token", inputType: "password" },
      },
      channelId: {
        type: "string",
        minLength: 1,
        nullable: true,
        "x-meta": { label: "Channel ID", inputType: "text" },
      },
    },
  },
} as const;

type FieldMeta = {
  name: string;
  label: string;
  inputType: "text" | "password";
  required: boolean;
};

export function listTemplateDescriptors(): Array<{
  type: string;
  displayName: string;
  description?: string;
  fields: FieldMeta[];
}> {
  return Object.entries(SECRET_SCHEMAS).map(([type, schema]) => {
    const meta = (schema as any)["x-meta"] || {};
    const required: string[] = Array.isArray((schema as any).required)
      ? ((schema as any).required as string[])
      : [];
    const props = ((schema as any).properties || {}) as Record<string, any>;
    const fields: FieldMeta[] = Object.entries(props).map(([name, def]) => {
      const pmeta = (def as any)["x-meta"] || {};
      return {
        name,
        label: String(pmeta.label || name),
        inputType: (pmeta.inputType as "text" | "password") || "text",
        required: required.includes(name),
      };
    });
    return {
      type,
      displayName: String(meta.displayName || type),
      description:
        typeof meta.description === "string" ? meta.description : undefined,
      fields,
    };
  });
}

export function getSchema(type: string): JsonSchema | undefined {
  return SECRET_SCHEMAS[type];
}
