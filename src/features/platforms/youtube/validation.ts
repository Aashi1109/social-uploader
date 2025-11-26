import ajv from "@/shared/ajv";
import { YOUTUBE_PUBLISH_TYPES, YOUTUBE_VISIBILITY } from "./constants";

export type YouTubeOAuthInitInput = {
  scope: string;
  clientId: string;
  clientSecret: string;
  channelId?: string;
};

export type YoutubeUploadConfig = {
  uploadType: string;
  category?: string;
};

const youTubeOAuthInitSchema = {
  $id: "youtube/oauth/init",
  type: "object",
  additionalProperties: false,
  required: ["scope", "clientId", "clientSecret"],
  properties: {
    scope: { type: "string", minLength: 1 },
    clientId: { type: "string", minLength: 1 },
    clientSecret: { type: "string", minLength: 1 },
    channelId: { type: "string", minLength: 1, nullable: true },
    config: {
      type: "object",
      additionalProperties: false,
      required: ["uploadType"],
      properties: {
        uploadType: {
          type: "string",
          enum: Object.values(YOUTUBE_PUBLISH_TYPES),
        },
        category: { type: "string", minLength: 1, nullable: true },
        visibility: {
          type: "string",
          enum: Object.values(YOUTUBE_VISIBILITY),
        },
      },
    },
  },
} as const;

export const validateYouTubeOAuthInit = ajv.compile(youTubeOAuthInitSchema);
