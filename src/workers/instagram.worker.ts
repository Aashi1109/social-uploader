import {
  createWorker,
  mediaPrepQueue,
  mediaPrepQueueEvents,
} from "@/core/queues";
import { Tracer } from "@/features/tracing/service";
import type { PublishJobData } from "@/shared/types/publish";
import {
  PLATFORM_TYPES,
  STEP_NAMES,
  EventName,
  getPlatformQueueName,
} from "@/shared/constants";
import { BadRequestError } from "@/shared/exceptions";
import { logger } from "@/core/logger";

export default function InstagramWorker() {
  const queueName = getPlatformQueueName(PLATFORM_TYPES.INSTAGRAM);

  logger.info({ queueName }, "📸 Instagram Worker initialized");

  createWorker(queueName, async (job) => {
    const data = job.data as unknown as PublishJobData;
    logger.info(
      { jobId: job.id, platform: data.platform },
      "Instagram worker processing job"
    );

    const trace = Tracer.fromExisting(
      data.projectId,
      data.requestId,
      data.traceId as string
    );

    const platformSpan = trace.span({
      name: PLATFORM_TYPES.INSTAGRAM,
      kind: "PLATFORM",
      platform: PLATFORM_TYPES.INSTAGRAM,
    });

    try {
      // Prep step
      platformSpan.event("INFO", EventName.PREP_STARTED, {
        step: STEP_NAMES.prep,
      });

      const prepJob = await mediaPrepQueue.add("prep", {
        traceId: data.traceId,
        requestId: data.requestId,
        projectId: data.projectId,
        platform: PLATFORM_TYPES.INSTAGRAM,
        mediaUrl: data.mediaUrl,
        filePath: data.filePath,
      });
      const prepResult = (await prepJob.waitUntilFinished(
        mediaPrepQueueEvents
      )) as { filePath: string; converted: boolean };
      const preparedFilePath = prepResult?.filePath || data.filePath;

      platformSpan.event("INFO", EventName.PREP_DONE, {
        step: STEP_NAMES.prep,
        filePath: preparedFilePath,
        converted: prepResult?.converted,
      });

      // Upload step
      platformSpan.event("INFO", EventName.UPLOAD_STARTED, {
        step: STEP_NAMES.upload,
      });

      await new Promise((r) => setTimeout(r, 300));

      platformSpan.event("INFO", EventName.UPLOAD_DONE, {
        step: STEP_NAMES.upload,
      });

      // Publish step
      platformSpan.event("INFO", EventName.PUBLISH_STARTED, {
        step: STEP_NAMES.publish,
      });

      await new Promise((r) => setTimeout(r, 200));

      platformSpan.event("INFO", EventName.PUBLISH_DONE, {
        step: STEP_NAMES.publish,
      });

      platformSpan.end("SUCCESS");
      return true;
    } catch (error) {
      platformSpan.end("FAILED", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}
