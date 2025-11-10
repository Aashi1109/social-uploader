import { JsonObject } from "../types/json";

export interface BasePlatformService {
  verify(data: JsonObject): Promise<{ ok: boolean; details?: JsonObject }>;
}
