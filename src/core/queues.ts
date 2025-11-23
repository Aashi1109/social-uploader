import { Queue, QueueEvents, Worker, JobsOptions, Job } from "bullmq";
import { QUEUE_NAMES, REDIS_CONNECTION_NAMES, PLATFORM_TYPES, getPlatformQueueName } from "@/shared/constants";
import type { JsonSchema } from "@/shared/types/json";
import { logger } from "@/core/logger";
import { getRedisWorkerConnectionConfig } from "@/shared/connections/redis";

const connection = getRedisWorkerConnectionConfig(
  REDIS_CONNECTION_NAMES.Default
);

// Base queues
export const masterQueue = new Queue(QUEUE_NAMES.master, { connection });
export const mediaPrepQueue = new Queue(QUEUE_NAMES.mediaPrep, { connection });

export const masterQueueEvents = new QueueEvents(QUEUE_NAMES.master, {
  connection,
});
export const mediaPrepQueueEvents = new QueueEvents(QUEUE_NAMES.mediaPrep, {
  connection,
});

// Dynamic platform queues
const platformQueues = new Map<PLATFORM_TYPES, Queue>();
const platformQueueEvents = new Map<PLATFORM_TYPES, QueueEvents>();

// Initialize platform-specific queues dynamically
Object.values(PLATFORM_TYPES).forEach((platform) => {
  const queueName = getPlatformQueueName(platform);
  platformQueues.set(platform, new Queue(queueName, { connection }));
  platformQueueEvents.set(platform, new QueueEvents(queueName, { connection }));
  logger.info({ platform, queueName }, "Platform queue initialized");
});

// Helper functions to get platform queues
export function getPlatformQueue(platform: PLATFORM_TYPES): Queue {
  const queue = platformQueues.get(platform);
  if (!queue) {
    throw new Error(`Queue not found for platform: ${platform}`);
  }
  return queue;
}

export function getPlatformQueueEvents(platform: PLATFORM_TYPES): QueueEvents {
  const queueEvents = platformQueueEvents.get(platform);
  if (!queueEvents) {
    throw new Error(`QueueEvents not found for platform: ${platform}`);
  }
  return queueEvents;
}

export function getDefaultJobOptions(): JobsOptions {
  return {
    attempts: 1,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  };
}

export function createWorker<D = JsonSchema, R = boolean>(
  name: string,
  processor: (job: Job<D>) => Promise<R>,
  concurrency = 5
): Worker {
  logger.info({ queue: name }, "Starting worker");
  const worker = new Worker(name, processor, {
    connection,
    concurrency,
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: name }, "Worker error");
  });
  worker.on("active", (job) => {
    logger.info({ queue: name, jobId: job.id, jobData: job.data }, "Worker picked up job");
  });
  return worker;
}
