export const DEFAULT_PORT = Number(process.env.PORT || 3000);
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const API_TOKENS = (
  process.env.API_TOKENS ||
  process.env.API_TOKEN ||
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export enum REDIS_CONNECTION_NAMES {
  Default = "default",
}

export enum DB_CONNECTION_NAMES {
  Default = "default",
}

export const QUEUE_NAMES = {
  master: "master",
  publish: "publish",
  mediaPrep: "media-prep",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Canonical event names (centralized)
export enum EventName {
  PUBLISH_REQUEST_RECEIVED = "publish.request.received",
  PUBLISH_REQUEST_VALIDATED = "publish.request.validated",
  PUBLISH_REQUEST_QUEUED = "publish.request.queued",
  PLATFORM_STARTED = "platform.started",
  PREP_STARTED = "prep.started",
  PREP_DONE = "prep.done",
  PREP_FAILED = "prep.failed",
  PREP_SKIPPED = "prep.skipped",
  UPLOAD_STARTED = "upload.started",
  UPLOAD_DONE = "upload.done",
  UPLOAD_FAILED = "upload.failed",
  PUBLISH_STARTED = "publish.started",
  PUBLISH_DONE = "publish.done",
  PUBLISH_FAILED = "publish.failed",
  PLATFORM_FINISHED = "platform.finished",
  PUBLISH_COMPLETED = "publish.completed",
}

// Known platform identifiers
export enum PLATFORM_TYPES {
  INSTAGRAM = "instagram",
  YOUTUBE = "youtube",
}

// Known step names
export const STEP_NAMES = {
  prep: "prep",
  upload: "upload",
  publish: "publish",
} as const;

// OAuth/Secrets provisioning enums
export const SECRET_PROVISION_STATUS = {
  pending: "pending",
  completed: "completed",
  failed: "failed",
} as const;

export type SecretProvisionStatus =
  (typeof SECRET_PROVISION_STATUS)[keyof typeof SECRET_PROVISION_STATUS];

export const OAUTH_PROVIDERS = {
  youtube: "youtube",
} as const;
export type OAuthProvider =
  (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS];

export const OAUTH_STATE_KIND = {
  secretProvision: "secret_provision",
} as const;

export type OAuthStateKind =
  (typeof OAUTH_STATE_KIND)[keyof typeof OAUTH_STATE_KIND];

export enum OAUTH_STEP_TYPES {
  Authorization = "authorization",
}

export const CACHE_NAMESPACE_CONFIG = {
  Secrets: {
    namespace: "secrets",
    ttl: 3600 * 24,
  },
  PendingSecrets: {
    namespace: "pending-secrets",
    ttl: 3600,
  },
};
