import {
  createWorker,
  mediaPrepQueue,
  mediaPrepQueueEvents,
} from "@/core/queues";
import { eventBus } from "@/core/events";
import { nowIso } from "@/shared/utils/time";
import type { PublishJobData } from "@/shared/types/publish";
import { EventName, PLATFORM_NAMES, STEP_NAMES } from "@/shared/constants";

export default function InstagramWorker() {
  createWorker("publish", async (job) => {
    const data = job.data as PublishJobData;
    if (data.platform !== PLATFORM_NAMES.instagram) return;

    eventBus.emitEvent({
      name: EventName.PLATFORM_STARTED,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
      platform: PLATFORM_NAMES.instagram,
    });

    const prep = await mediaPrepQueue.add("prep", {
      traceId: data.traceId,
      projectId: data.projectId,
      platform: PLATFORM_NAMES.instagram,
      mediaUrl: data.mediaUrl,
    });
    await prep.waitUntilFinished(mediaPrepQueueEvents);

    eventBus.emitEvent({
      name: EventName.UPLOAD_STARTED,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
      platform: PLATFORM_NAMES.instagram,
      step: STEP_NAMES.upload,
      status: "running",
    });

    await new Promise((r) => setTimeout(r, 300));
    eventBus.emitEvent({
      name: EventName.UPLOAD_DONE,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
      platform: PLATFORM_NAMES.instagram,
      step: STEP_NAMES.upload,
      status: "success",
    });

    eventBus.emitEvent({
      name: EventName.PUBLISH_STARTED,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
      platform: PLATFORM_NAMES.instagram,
      step: STEP_NAMES.publish,
      status: "running",
    });
    // MVP: simulate publish
    await new Promise((r) => setTimeout(r, 200));
    eventBus.emitEvent({
      name: EventName.PUBLISH_DONE,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
      platform: PLATFORM_NAMES.instagram,
      step: STEP_NAMES.publish,
      status: "success",
    });

    eventBus.emitEvent({
      name: EventName.PLATFORM_FINISHED,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
      platform: PLATFORM_NAMES.instagram,
    });
  });
}
