import { masterQueue, getDefaultJobOptions } from "@/core/queues";

import { Trace } from "@/features/tracing/models";
import { getRequestContextRequestId } from "@/api/middleware";
import { IPublishRequest } from "./type";

class PublishService {
  async create(
    body: IPublishRequest & { projectId: string }
  ): Promise<{ requestId: string }> {
    const requestId = getRequestContextRequestId();

    await masterQueue.add(
      "master",
      {
        requestId,
        ...body,
      },
      getDefaultJobOptions()
    );

    return { requestId };
  }

  async getPublishStatus(requestId: string, projectId: string) {
    const trace = await Trace.findOne({
      where: { requestId, projectId },
      include: [
        {
          association: "stages",
          include: [
            {
              association: "steps",
            },
          ],
        },
        {
          association: "events",
        },
      ],
    });
    if (!trace) {
      return null;
    }

    return {
      trace: {
        id: trace.id,
        createdAt: trace.createdAt,
        updatedAt: trace.updatedAt,
      },
      events: trace.events || [],
    };
  }
}

export default PublishService;
