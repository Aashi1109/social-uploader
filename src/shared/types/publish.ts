import { JsonSchema } from "./json";

export type PlatformName = "instagram" | "youtube";

export interface MasterJobData {
  requestId: string;
  projectId: string;
  mediaUrl: string;
  title?: string;
  description?: string;
}

export interface PublishJobData extends JsonSchema {
  requestId: string;
  projectId: string;
  platform: PlatformName;
  mediaUrl: string;
  title?: string;
  description?: string;
  fileData?: string;
  filePath?: string;
}
