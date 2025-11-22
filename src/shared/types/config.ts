import { JsonSchema } from "./json";
import type { PlatformName } from "./publish";

export interface PlatformConfig {
  name: PlatformName;
  enabled: boolean;
  config: JsonSchema;
}

export interface ProjectConfig {
  projectId: string;
  platforms: PlatformConfig[];
}
