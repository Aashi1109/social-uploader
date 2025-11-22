import { createWorker, publishQueue } from "@/core/queues";
import {
  Tracer,
  YouTubeService,
  InstagramService,
  PlatformService,
} from "@/features";
import { EventName, PLATFORM_TYPES } from "@/shared/constants";
import type { MasterJobData } from "@/shared/types/publish";
import { isEmpty } from "@/shared/utils";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import axios from "axios";
import { logger } from "@/core/logger";
import config from "@/config";
import { InstagramSecret, YouTubeSecret } from "@/shared/secrets/schemas";

// Map MIME types to file extensions
function getExtensionFromContentType(contentType: string | undefined): string {
  if (!contentType || typeof contentType !== "string") return "";

  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/webm": ".weba",
  };

  // Extract base MIME type (remove charset, boundary, etc.)
  const baseType = contentType.split(";")[0]?.trim().toLowerCase() || "";
  return baseType ? mimeToExt[baseType] || "" : "";
}

export default function MasterWorker() {
  createWorker("master", async (job) => {
    const data = job.data as unknown as MasterJobData;

    const trace = Tracer.init(data.projectId, data.requestId, {
      input: { mediaUrl: data.mediaUrl },
    });

    trace.event("INFO", EventName.PUBLISH_REQUEST_RECEIVED);
    const fileUrl = data.mediaUrl;

    if (!fileUrl) throw new Error("Media URL is required");

    const masterSpan = trace.span({ name: "master-orchestration" });

    try {
      // Download file from URL and save to tmp directory
      masterSpan.event("INFO", "file.download.started", {
        url: fileUrl,
      });

      const tmpDir = config.tmpDir;
      await mkdir(tmpDir, { recursive: true });

      // Download file
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
        timeout: 300000, // 5 minutes timeout
      });

      // Get extension from Content-Type header
      const contentType = response.headers["content-type"];
      const extension = getExtensionFromContentType(contentType);
      const fileName = `${trace.traceId}${extension}`;
      const filePath = join(tmpDir, fileName);

      await writeFile(filePath, Buffer.from(response.data));

      masterSpan.event("INFO", "file.download.completed", {
        filePath,
        size: response.data.byteLength,
      });

      logger.info(
        { traceId: trace.traceId, filePath, size: response.data.byteLength },
        "File downloaded successfully"
      );
      const platformService = new PlatformService();
      const platforms = await platformService.list(data.projectId);

      if (!platforms.length)
        throw new Error(`No platforms found for project: ${data.projectId}`);

      // get all the platforms enabled
      // for each validate if the secrets are valid
      // after all the validation push to respective queues
      for (const platform of platforms) {
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
          if (
            isEmpty(platform.secret?.data) ||
            isEmpty(platform.secret?.tokens)
          )
            throw new Error(`${platform.name} secret is empty`);

          switch (platform.type) {
            case PLATFORM_TYPES.INSTAGRAM: {
              const instagramService = new InstagramService(
                platform.secret?.data?.businessAccountId as string,
                platform.secret?.data?.accessToken as string
              );
              const isValid = await instagramService.verify(
                platform.secret!.tokens as InstagramSecret
              );
              if (!isValid)
                throw new Error(`${platform.name} secret is invalid`);

              break;
            }
            case PLATFORM_TYPES.YOUTUBE: {
              const youtubeService = new YouTubeService(
                platform.secret!.data.clientId,
                platform.secret!.data.clientSecret
              );
              const isValid = await youtubeService.verify(
                platform.secret!.tokens as YouTubeSecret["tokens"]
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

      for (const platform of platforms) {
        if (!platform.enabled) continue;
        await publishQueue.add("publish", {
          traceId: trace.traceId,
          requestId: data.requestId,
          projectId: data.projectId,
          platform: platform.name,
          mediaUrl: data.mediaUrl,
          filePath,
          title: data.title,
          description: data.description,
        });
      }

      masterSpan.end("SUCCESS");
      return true;
    } catch (error) {
      masterSpan.event("ERROR", "file.download.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      masterSpan.end("FAILED", {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  });
}
