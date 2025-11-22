import { masterQueue, getDefaultJobOptions } from "@/core/queues";

import { Trace } from "@/features/tracing/models";
import { getRequestContextRequestId } from "@/api/middleware";

export interface PublishRequest {
  projectId: string;
  mediaUrl?: string;
  title?: string;
  description?: string;
  fileData?: string;
  type: "video" | "image";
}

class PublishService {
  async create(body: PublishRequest): Promise<{ requestId: string }> {
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
      stages:
        trace.stages?.map((s: any) => ({
          id: s.id,
          name: s.name,
          platform: s.platform,
          status: s.status,
          steps:
            s.steps?.map((st: any) => ({
              id: st.id,
              name: st.name,
              status: st.status,
              durationMs: st.durationMs,
            })) || [],
        })) || [],
      events: trace.events || [],
    };
  }
}

export default PublishService;
