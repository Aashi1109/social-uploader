import { createWorker, publishQueue } from "@/core/queues";
import { getProjectConfig } from "@/core/config";
import { eventBus } from "@/core/events";
import { nowIso } from "@/shared/utils/time";
import type { MasterJobData } from "@/shared/types/publish";
import { EventName } from "@/shared/constants";

export default function MasterWorker() {
  createWorker("master", async (job) => {
    const data = job.data as MasterJobData;
    const config = await getProjectConfig(data.projectId);
    eventBus.emitEvent({
      name: EventName.PUBLISH_REQUEST_VALIDATED,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
    });
    if (!config) {
      throw new Error(`Unknown project: ${data.projectId}`);
    }
    const platforms = (
      data.platforms && data.platforms.length > 0
        ? config.platforms.filter((p) => data.platforms?.includes(p.name))
        : config.platforms
    ).filter((p) => p.enabled);

    eventBus.emitEvent({
      name: EventName.PUBLISH_REQUEST_QUEUED,
      timestamp: nowIso(),
      traceId: data.traceId,
      projectId: data.projectId,
      meta: { platforms: platforms.map((p) => p.name) },
    });

    await Promise.all(
      platforms.map((p) =>
        publishQueue.add("publish", {
          traceId: data.traceId,
          projectId: data.projectId,
          platform: p.name,
          mediaUrl: data.mediaUrl,
          title: data.title,
          description: data.description,
        })
      )
    );
  });
}
