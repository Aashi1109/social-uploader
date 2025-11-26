import { CACHE_NAMESPACE_CONFIG } from "@/shared/constants";
import { RedisCache } from "../../shared/cache";
import { Project } from "./model";

const redisCache = new RedisCache({
  namespace: CACHE_NAMESPACE_CONFIG.Projects.namespace,
  defaultTTLSeconds: CACHE_NAMESPACE_CONFIG.Projects.ttl,
});

export const getProjectCacheById = (id: string) =>
  redisCache.getItem<Project>(`${id}`);

export const setProjectCacheById = (id: string, project: Project) =>
  redisCache.setItem(`${id}`, project);

export const deleteProjectCacheById = (id: string) =>
  redisCache.deleteItem(`${id}`);

export const getProjectCacheBySlug = async (slug: string) => {
  const redisKey = `slug:${slug}`;
  const cachedProjectId = await redisCache.getItem<string>(redisKey);
  if (!cachedProjectId) return cachedProjectId;
  return await getProjectCacheById(cachedProjectId);
};

export const setProjectCacheBySlug = async (slug: string, project: Project) => {
  const pipeline = redisCache.getPipeline();
  pipeline.set(`slug:${slug}`, project.id);
  pipeline.set(`${project.id}`, slug);
  await pipeline.exec();
  return "OK";
};
