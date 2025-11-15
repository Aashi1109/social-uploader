import type { JsonSchema } from "@/shared/types/json";
import { PLATFORM_TYPES } from "../constants";

export type YouTubeSecret = {
  clientId: string;
  clientSecret: string;

  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    refreshTokenExpiresIn: number;
  };
};

export type InstagramSecret = {
  appId: string;
  appSecret: string;
  tokens: string;
  businessAccountId: string;
};

export const PLATFORM_SCHEMAS: Record<PLATFORM_TYPES, JsonSchema> = {
  [PLATFORM_TYPES.INSTAGRAM]: {
    $id: "secrets/templates/instagram",
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
  [PLATFORM_TYPES.YOUTUBE]: {
    $id: "secrets/templates/youtube",
    type: "object",
    additionalProperties: false,
    label: "YouTube",
    description: "Google OAuth credentials for YouTube Data API publishing.",
    required: ["clientId", "clientSecret"],
    properties: {
      clientId: {
        type: "string",
        minLength: 1,
        label: "Client ID",
        inputType: "text",
      },
      clientSecret: {
        type: "string",
        minLength: 1,
        label: "Client Secret",
        inputType: "password",
      },
    },
  },
} as const;

export const getSchema = (type: string) =>
  PLATFORM_SCHEMAS[type as PLATFORM_TYPES];
