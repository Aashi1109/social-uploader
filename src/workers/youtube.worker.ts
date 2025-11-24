import {
  createWorker,
  mediaPrepQueue,
  mediaPrepQueueEvents,
} from "@/core/queues";
import { Tracer, YouTubeService, PlatformService } from "@/features";
import type { PublishJobData } from "@/shared/types/publish";
import {
  PLATFORM_TYPES,
  STEP_NAMES,
  EventName,
  getPlatformQueueName,
} from "@/shared/constants";
import { BadRequestError } from "@/shared/exceptions";
import { YouTubeSecret } from "@/shared/secrets/schemas";
import { logger } from "@/core/logger";

export default function YoutubeWorker() {
  const queueName = getPlatformQueueName(PLATFORM_TYPES.YOUTUBE);
  logger.info({ queueName }, "🎥 YouTube Worker initialized");

  createWorker(queueName, async (job) => {
    const data: PublishJobData = job.data as PublishJobData;
    logger.info(
      { jobId: job.id, platform: data.platformId },
      "YouTube worker processing job"
    );

    const { platformId } = data;

    const trace = Tracer.fromExisting(
      data.projectId,
      data.requestId,
      data.traceId as string
    );

    const platformSpan = trace.span({
      name: PLATFORM_TYPES.YOUTUBE,
      kind: "PLATFORM",
      platform: PLATFORM_TYPES.YOUTUBE,
    });

    try {
      // Get platform configuration and secrets
      const platformService = new PlatformService();

      const { secret } = await platformService.getById(platformId, true);

      const secretData = secret.data as YouTubeSecret;
      const tokens = secret.tokens as YouTubeSecret["tokens"];

      if (!secretData.clientId || !secretData.clientSecret) {
        throw new BadRequestError("YouTube OAuth credentials not configured");
      }

      if (!tokens?.accessToken) {
        throw new BadRequestError("YouTube access token not found");
      }

      // Prep step
      platformSpan.event("INFO", EventName.PREP_STARTED, {
        step: STEP_NAMES.prep,
      });

      const prepJob = await mediaPrepQueue.add("prep", {
        traceId: data.traceId,
        requestId: data.requestId,
        projectId: data.projectId,
        platform: PLATFORM_TYPES.YOUTUBE,
        platformId,
        mediaUrl: data.mediaUrl,
        filePath: data.filePath,
      });
      const prepResult = (await prepJob.waitUntilFinished(
        mediaPrepQueueEvents
      )) as { filePath: string };
      const preparedFilePath = prepResult?.filePath;

      platformSpan.event("INFO", EventName.PREP_DONE, {
        step: STEP_NAMES.prep,
        filePath: preparedFilePath,
      });

      // Validate file path
      if (!preparedFilePath) {
        throw new BadRequestError("File path is required for YouTube upload");
      }

      // Upload & Publish step (combined for YouTube)
      platformSpan.event("INFO", EventName.UPLOAD_STARTED, {
        step: STEP_NAMES.upload,
      });

      logger.info(
        {
          traceId: data.traceId,
          filePath: preparedFilePath,
          title: data.title,
        },
        "Starting YouTube upload"
      );

      // Publish step (YouTube upload already publishes the video)
      platformSpan.event("INFO", EventName.PUBLISH_STARTED, {
        step: STEP_NAMES.publish,
      });

      // Initialize YouTube service
      const youtubeService = new YouTubeService(
        secretData.clientId,
        secretData.clientSecret
      );

      // Call YouTube service to upload video with resumable upload
      const result = await youtubeService.publish({
        filePath: preparedFilePath,
        title: data.title || "Untitled Video",
        description: data.description,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        privacyStatus: "private", // Default to private; can be made configurable
        requestId: data.requestId,
      });

      platformSpan.event("INFO", EventName.UPLOAD_DONE, {
        step: STEP_NAMES.upload,
        videoId: result.creationId,
      });

      platformSpan.event("INFO", EventName.PUBLISH_DONE, {
        step: STEP_NAMES.publish,
        videoId: result.creationId,
        url: result.data?.url,
      });

      logger.info(
        {
          traceId: data.traceId,
          videoId: result.creationId,
          url: result.data?.url,
        },
        "YouTube video published successfully"
      );

      platformSpan.end("SUCCESS");
      return result;
    } catch (error) {
      logger.error(
        {
          traceId: data.traceId,
          error: error instanceof Error ? error.message : String(error),
        },
        "YouTube worker failed"
      );

      platformSpan.end("FAILED", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}
