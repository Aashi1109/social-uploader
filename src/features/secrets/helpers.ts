import { CACHE_NAMESPACE_CONFIG } from "@/shared/constants";
import { RedisCache } from "../../shared/cache";

const pendingSecretCache = new RedisCache({
  namespace: CACHE_NAMESPACE_CONFIG.PendingSecrets.namespace,
  defaultTTLSeconds: CACHE_NAMESPACE_CONFIG.PendingSecrets.ttl,
});

export const getPendingSecretCache = (key: string) =>
  pendingSecretCache.getItem(key);

export const setPendingSecretCache = (key: string, value: any) =>
  pendingSecretCache.setItem(key, value);

export const deletePendingSecretCache = (key: string) =>
  pendingSecretCache.deleteItem(key);
