import { CACHE_NAMESPACE_CONFIG } from "@/shared/constants";
import { RedisCache } from "../cache";
import { Platform } from "./model";

const redisCache = new RedisCache({
  namespace: CACHE_NAMESPACE_CONFIG.Platform.namespace,
  defaultTTLSeconds: CACHE_NAMESPACE_CONFIG.Platform.ttl,
});

export const getPlatformCacheById = (id: string) =>
  redisCache.getItem<Platform>(id);
export const setPlatformCacheById = (id: string, data: Platform) =>
  redisCache.setItem(id, data);

export const deletePlatformCacheById = (id: string) =>
  redisCache.deleteItem(id);
