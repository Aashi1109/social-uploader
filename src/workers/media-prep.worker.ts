import { createWorker } from "@/core/queues";
import { ProjectService } from "@/features";
import { PublishJobData } from "@/shared/types/publish";

export default function MediaPrepWorker() {
  createWorker("media-prep", async (job) => {
    const { mediaUrl } = job.data as unknown as PublishJobData;
    // This worker is called within a parent stage context.
    // The parent worker (Instagram/YouTube) already tracks the prep step,
    // so we just do the work here without emitting duplicate events.
    const projectService = new ProjectService();
    const config = await projectService.getConfig(projectId);
    return true;
  });
}
