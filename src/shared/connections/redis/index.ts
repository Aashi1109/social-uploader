import config from "@/config";
import { REDIS_CONNECTION_NAMES } from "@/shared/constants";
import { Redis } from "@upstash/redis";

const redisConnections: Partial<Record<REDIS_CONNECTION_NAMES, Redis>> = {};

export const getRedisConnections = () => redisConnections;

const connect = (name: REDIS_CONNECTION_NAMES) => {
  return new Redis({
    url: `http://${config.redis[name].host}:${config.redis[name].port}`,
    token: config.redis[name].token,
  });
};

export async function disconnectRedisConnections() {
  const disconnecting = [];
  for (const name of Object.keys(redisConnections)) {
    disconnecting.push((redisConnections as any)[name].close());
  }
  return Promise.all(disconnecting);
}

export function getRedisConnection(
  name: REDIS_CONNECTION_NAMES = REDIS_CONNECTION_NAMES.Default
) {
  if (redisConnections[name]) {
    return redisConnections[name];
  }
  if (!config.redis[name]) {
    throw new Error(`Redis connection not exists: ${name}`);
  }
  redisConnections[name] = connect(name);
  return redisConnections[name];
}

export const getRedisWorkerConnectionConfig = (
  name: REDIS_CONNECTION_NAMES
) => ({
  host: config.redis[name].url?.replace("https://", "") || "",
  password: config.redis[name].token,
  tls: {},
  port: config.redis[name].port,
});
