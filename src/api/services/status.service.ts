import prisma from "../../prisma";

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
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
      include: {
        stages: {
          include: {
            steps: true,
          },
        },
        events: {
          orderBy: { timestamp: "asc" },
        },
      },
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
      stages: trace.stages.map((s: StageRow) => ({
        id: s.id,
        name: s.name,
        platform: s.platform,
        status: s.status,
        steps: s.steps.map((st: StepRow) => ({
          id: st.id,
          name: st.name,
          status: st.status,
          durationMs: st.durationMs,
        })),
      })),
      events: trace.events,
    };
  }
}

export default new StatusService();
