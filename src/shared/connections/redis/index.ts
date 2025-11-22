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
) => {
  const host = config.redis[name].host?.replace("https://", "") || "";
  const isLocalhost =
    host === "localhost" || host === "127.0.0.1" || host.startsWith("127.");

  return {
    host,
    password: config.redis[name].token,
    ...(isLocalhost ? {} : { tls: {} }),
    port: isLocalhost ? 6379 : config.redis[name].port,
  };
};
