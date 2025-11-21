import {
  createWorker,
  mediaPrepQueue,
  mediaPrepQueueEvents,
} from "@/core/queues";
import { Tracer } from "@/features/tracing/service";
import type { PublishJobData } from "@/shared/types/publish";
import { PLATFORM_TYPES, STEP_NAMES, EventName } from "@/shared/constants";
import { BadRequestError } from "@/shared/exceptions";

export default function InstagramWorker() {
  createWorker("publish", async (job) => {
    const data = job.data as unknown as PublishJobData;
    if (data.platform !== PLATFORM_TYPES.INSTAGRAM)
      throw new BadRequestError("Invalid platform");

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

      const prep = await mediaPrepQueue.add("prep", {
        traceId: trace.traceId,
        projectId: data.projectId,
        platform: PLATFORM_TYPES.INSTAGRAM,
        mediaUrl: data.mediaUrl,
      });
      await prep.waitUntilFinished(mediaPrepQueueEvents);

      platformSpan.event("INFO", EventName.PREP_DONE, {
        step: STEP_NAMES.prep,
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
