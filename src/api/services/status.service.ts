import { Trace, Stage, Step, Event } from "@/features/tracing/models";

type StepRow = {
  id: string;
  name: string;
  status: string;
  durationMs: number | null;
};
type StageRow = {
  id: string;
  name: string;
  platform: string | null;
  status: string;
  steps: StepRow[];
};

class StatusService {
  async getPublishStatus(traceId: string) {
    const trace = await Trace.findOne({
      where: { id: traceId },
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
      order: [[{ model: Event, as: "events" }, "timestamp", "ASC"]],
    });
    if (!trace) {
      return null;
    }
    return {
      trace: {
        id: trace.id,
        status: trace.status,
        totalStages: trace.totalStages,
        completedStages: trace.completedStages,
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

export default new StatusService();
