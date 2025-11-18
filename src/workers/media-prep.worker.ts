import { createWorker } from "@/core/queues";
import { eventBus } from "@/core/events";
import { nowIso } from "@/shared/utils/time";
import { EventName, STEP_NAMES } from "@/shared/constants";

export default function MediaPrepWorker() {
  createWorker("media-prep", async (job) => {
    const { traceId, projectId, platform, mediaUrl } = job.data as {
      traceId: string;
      projectId: string;
      platform: string;
      mediaUrl: string;
    };
    eventBus.emitEvent({
      name: EventName.PREP_STARTED,
      timestamp: nowIso(),
      traceId,
      projectId,
      platform,
      step: STEP_NAMES.prep,
      status: "running",
    });
    // MVP: pretend we inspected and normalized
    await new Promise((r) => setTimeout(r, 200));
    eventBus.emitEvent({
      name: EventName.PREP_DONE,
      timestamp: nowIso(),
      traceId,
      projectId,
      platform,
      step: STEP_NAMES.prep,
      status: "success",
      meta: { preparedUrl: mediaUrl, durationSec: 5 },
    });

    return true;
  });
}
