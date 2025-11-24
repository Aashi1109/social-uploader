import { PLATFORM_TYPES } from "../constants";
import { JsonSchema } from "./json";

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
  platformId: string;
  mediaUrl: string;
  title?: string;
  description?: string;
  fileData?: string;
  filePath?: string;
}
