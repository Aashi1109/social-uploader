import ajv from "@/shared/ajv";

export type YouTubeOAuthInitInput = {
  scope: string;
  clientId: string;
  clientSecret: string;
  channelId?: string;
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
  },
} as const;

export const validateYouTubeOAuthInit = ajv.compile(
  youTubeOAuthInitSchema as any
);
