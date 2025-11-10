import { JobData } from "bullmq";
import { JsonObject } from "./json";

export type PlatformName = "instagram" | "youtube";

export interface MasterJobData {
  traceId: string;
  projectId: string;
  mediaUrl: string;
  title?: string;
  description?: string;
  platforms?: PlatformName[];
}

export interface PublishJobData extends JsonObject {
  traceId: string;
  projectId: string;
  platform: PlatformName;
  mediaUrl: string;
  title?: string;
  description?: string;
}
