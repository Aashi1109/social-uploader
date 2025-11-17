import { masterQueue, getDefaultJobOptions } from "@/core/queues";
import { createTrace } from "@/core/trace";
import type { PublishRequest } from "@/shared/utils/validation";
import { eventBus } from "@/core/events";
import { nowIso } from "@/shared/utils/time";
import { Trace } from "@/features/tracing/models";
import { EventName } from "@/shared/constants";

class PublishService {
  async createPublishRequest(
    body: PublishRequest
  ): Promise<{ requestId: string }> {
    // Idempotency: if idempotencyKey present, return existing trace
    if (body.idempotencyKey) {
      const existing = await Trace.findOne({
        where: {
          projectId: body.projectId,
          idempotencyKey: body.idempotencyKey,
        },
        attributes: ["id"],
      });
      if (existing) {
        return { requestId: existing.id };
      }
    }

    const { traceId } = await createTrace({
      projectId: body.projectId,
      idempotencyKey: body.idempotencyKey,
    });

    eventBus.emitEvent({
      name: EventName.PUBLISH_REQUEST_RECEIVED,
      timestamp: nowIso(),
      traceId,
      projectId: body.projectId,
      meta: { mediaUrl: body.mediaUrl },
    });

    await masterQueue.add(
      "master",
      {
        traceId,
        projectId: body.projectId,
        mediaUrl: body.mediaUrl,
        title: body.title,
        description: body.description,
        platforms: body.platforms,
      },
      getDefaultJobOptions()
    );

    return { requestId: traceId };
  }
}

export default new PublishService();
