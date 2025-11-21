import { createWorker, publishQueue } from "@/core/queues";
import {
  Tracer,
  ProjectService,
  YouTubeService,
  InstagramService,
} from "@/features";
import { EventName, PLATFORM_TYPES } from "@/shared/constants";
import type { MasterJobData } from "@/shared/types/publish";
import { isEmpty } from "@/shared/utils";

export default function MasterWorker() {
  createWorker("master", async (job) => {
    const data = job.data as unknown as MasterJobData;

    const trace = Tracer.init(data.projectId, data.requestId, {
      input: { mediaUrl: data.mediaUrl },
    });

    const masterSpan = trace.span({ name: "master-orchestration" });

    try {
      const config = await new ProjectService().getProjectConfig(
        data.projectId
      );

      if (!config) {
        throw new Error(`Unknown project: ${data.projectId}`);
      }

      // get all the platforms enabled
      // for each validate if the secrets are valid
      // after all the validation push to respective queues
      for (const platform of config.platforms) {
        masterSpan.event("INFO", EventName.PLATFORM_VALIDATION_STARTED, {
          platform: platform.name,
        });

        try {
          if (!platform.enabled) {
            masterSpan.event("INFO", EventName.PLATFORM_VALIDATION_SKIPPED, {
              platform: platform.name,
            });
            continue;
          }
          if (isEmpty(platform.secret.data))
            throw new Error(`${platform.name} secret is empty`);

          switch (platform.name) {
            case PLATFORM_TYPES.INSTAGRAM: {
              const instagramService = new InstagramService(
                platform.secret.data.businessAccountId,
                platform.secret.data.accessToken
              );
              const isValid = await instagramService.verify(
                platform.secret.tokens
              );
              if (!isValid)
                throw new Error(`${platform.name} secret is invalid`);

              break;
            }
            case PLATFORM_TYPES.YOUTUBE: {
              const youtubeService = new YouTubeService(
                platform.secret.data.clientId,
                platform.secret.data.clientSecret
              );
              const isValid = await youtubeService.verify(
                platform.secret.tokens
              );
              if (!isValid)
                throw new Error(`${platform.name} secret is invalid`);
              break;
            }
            default:
              throw new Error(`Unknown platform: ${platform.name}`);
          }

          masterSpan.event("INFO", EventName.PLATFORM_VALIDATION_COMPLETED, {
            platform: platform.name,
          });
        } catch (error) {
          masterSpan.event("ERROR", EventName.PLATFORM_VALIDATION_FAILED, {
            platform: platform.name,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      for (const platform of config.platforms) {
        if (!platform.enabled) continue;
        await publishQueue.add("publish", {
          traceId: trace.traceId,
          projectId: data.projectId,
          platform: platform.name,
        });
      }

      masterSpan.end("SUCCESS");
      return true;
    } catch (error) {
      masterSpan.end("FAILED", {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  });
}
