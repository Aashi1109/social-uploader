import { JsonValue } from "./json";
import type { PlatformName } from "./publish";

export interface PlatformConfig {
  name: PlatformName;
  enabled: boolean;
  config: JsonValue;
}

export interface ProjectConfig {
  projectId: string;
  platforms: PlatformConfig[];
}
