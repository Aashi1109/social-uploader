import { CACHE_NAMESPACE_CONFIG } from "@/shared/constants";
import { RedisCache } from "../cache";

const redisCache = new RedisCache({
  namespace: CACHE_NAMESPACE_CONFIG.Secrets.namespace,
  defaultTTLSeconds: CACHE_NAMESPACE_CONFIG.Secrets.ttl,
});

const pendingSecretCache = new RedisCache({
  namespace: CACHE_NAMESPACE_CONFIG.PendingSecrets.namespace,
  defaultTTLSeconds: CACHE_NAMESPACE_CONFIG.PendingSecrets.ttl,
});

export const getSecretCache = (key: string) => redisCache.getItem(key);

export const setSecretCache = (key: string, value: any) =>
  redisCache.setItem(key, value);

export const deleteSecretCache = (key: string) => redisCache.deleteItem(key);

export const getPendingSecretCache = (key: string) =>
  pendingSecretCache.getItem(key);

export const setPendingSecretCache = (key: string, value: any) =>
  pendingSecretCache.setItem(key, value);

export const deletePendingSecretCache = (key: string) =>
  pendingSecretCache.deleteItem(key);
