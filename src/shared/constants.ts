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
export const MASTER_KEY_HEX = process.env.MASTER_KEY || "";

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
export const PLATFORM_NAMES = {
  instagram: "instagram",
  youtube: "youtube",
} as const;

// Known step names
export const STEP_NAMES = {
  prep: "prep",
  upload: "upload",
  publish: "publish",
} as const;
