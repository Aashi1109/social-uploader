import { Queue, QueueEvents, Worker, JobsOptions, Job } from "bullmq";
import { QUEUE_NAMES, REDIS_CONNECTION_NAMES } from "@/shared/constants";
import type { JsonObject, JsonValue } from "@/shared/types/json";
import { logger } from "@/core/logger";
import { getRedisWorkerConnectionConfig } from "@/shared/connections/redis";

const connection = getRedisWorkerConnectionConfig(
  REDIS_CONNECTION_NAMES.Default
);

export const masterQueue = new Queue(QUEUE_NAMES.master, { connection });
export const publishQueue = new Queue(QUEUE_NAMES.publish, { connection });
export const mediaPrepQueue = new Queue(QUEUE_NAMES.mediaPrep, { connection });

export const masterQueueEvents = new QueueEvents(QUEUE_NAMES.master, {
  connection,
});
export const publishQueueEvents = new QueueEvents(QUEUE_NAMES.publish, {
  connection,
});
export const mediaPrepQueueEvents = new QueueEvents(QUEUE_NAMES.mediaPrep, {
  connection,
});

export function getDefaultJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  };
}

export function createWorker<D = JsonObject>(
  name: string,
  processor: (job: Job<D>) => Promise<boolean>,
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
  return worker;
}
