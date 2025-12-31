import { createWorker } from "@/core/queues";
import { PlatformService } from "@/features";
import { PublishJobData } from "@/shared/types/publish";
import { PLATFORM_TYPES } from "@/shared/constants";
import { logger } from "@/core/logger";
import config from "@/config";
import { join, extname } from "node:path";
import { stat, mkdir } from "node:fs/promises";
import ffmpeg from "fluent-ffmpeg";
import type { FfprobeData } from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import sharp from "sharp";
import { JsonSchema } from "@/shared/types/json";
import {
  validateMediaConstraints,
  MediaInfo,
  MediaRequirements,
} from "./validation-utils";

// Configure fluent-ffmpeg to use bundled binaries (no system dependencies)
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath?.path) {
  ffmpeg.setFfprobePath(ffprobePath.path);
}

type MediaType = "image" | "video";

interface MediaPrepResult {
  filePath: string;
  converted: boolean;
}

/**
 * Extract platform-specific media requirements based on platform type and media type
 */
function getPlatformRequirements(
  platformType: PLATFORM_TYPES,
  platformConfig: JsonSchema,
  mediaType: MediaType
): MediaRequirements {
  const requirements = platformConfig.requirements as
    | MediaRequirements
    | { video?: MediaRequirements; image?: MediaRequirements };

  switch (platformType) {
    case PLATFORM_TYPES.INSTAGRAM: {
      // Instagram has nested requirements: requirements.video or requirements.image
      if (
        typeof requirements === "object" &&
        requirements !== null &&
        !Array.isArray(requirements)
      ) {
        const nestedReqs = requirements as {
          video?: MediaRequirements;
          image?: MediaRequirements;
        };
        const mediaSpecificReqs =
          mediaType === "video" ? nestedReqs.video : nestedReqs.image;

        if (!mediaSpecificReqs) {
          throw new Error(
            `No ${mediaType} requirements found for Instagram platform`
          );
        }
        return mediaSpecificReqs;
      }
      throw new Error("Invalid Instagram requirements structure");
    }
    case PLATFORM_TYPES.YOUTUBE: {
      // YouTube has requirements at root level
      if (
        typeof requirements === "object" &&
        requirements !== null &&
        !Array.isArray(requirements)
      ) {
        // Check if it's already a MediaRequirements object (not nested)
        if (
          "formats" in requirements ||
          "maxDurationSeconds" in requirements ||
          "videoCodecs" in requirements
        ) {
          return requirements as MediaRequirements;
        }
      }
      throw new Error("Invalid YouTube requirements structure");
    }
    default:
      throw new Error(`Unsupported platform type: ${platformType}`);
  }
}

export default function MediaPrepWorker() {
  createWorker<PublishJobData, MediaPrepResult>("media-prep", async (job) => {
    const { filePath, projectId, traceId, platformId } = job.data;

    // Validate required fields
    if (!filePath || !traceId || !platformId)
      throw new Error("Invalid job data");

    // This worker is called within a parent stage context.
    // The parent worker (Instagram/YouTube) already tracks the prep step,
    // so we just do the work here without emitting duplicate events.

    logger.info({ traceId, projectId, filePath }, "Media prep started");

    try {
      // Get platform-specific media requirements
      const platformService = new PlatformService();
      const { config: platformConfig, type: platformType } =
        await platformService.getById(platformId, true);

      // Get enforceConstraints setting (default to false for auto-format mode)
      const enforceConstraints = platformConfig.enforceConstraints === true;

      // Detect media type first (needed to extract correct requirements)
      const mediaType = detectMediaType(filePath);
      logger.debug({ traceId, mediaType, platformType }, "Media type detected");

      // Extract platform-specific requirements based on media type
      const requirements = getPlatformRequirements(
        platformType,
        platformConfig,
        mediaType
      );

      logger.debug(
        { traceId, platformType, mediaType, hasRequirements: !!requirements },
        "Platform requirements extracted"
      );

      // Inspect the media file
      const mediaInfo =
        mediaType === "image"
          ? await inspectImage(filePath)
          : await inspectVideo(filePath);
      logger.debug({ traceId, mediaInfo }, "Media inspection complete");

      // Validate media against platform requirements
      // This will throw an error if enforceConstraints=true and media doesn't meet requirements
      const validationResult = validateMediaConstraints(
        mediaInfo,
        requirements,
        platformType,
        enforceConstraints
      );

      logger.debug(
        {
          traceId,
          validationResult: {
            isValid: validationResult.isValid,
            requiresConversion: validationResult.requiresConversion,
            issueCount: validationResult.issues.length,
          },
        },
        "Media validation complete"
      );

      // Log validation issues
      if (validationResult.issues.length > 0) {
        validationResult.issues.forEach((issue) => {
          const logLevel = issue.severity === "error" ? "warn" : "debug";
          logger[logLevel](
            {
              traceId,
              field: issue.field,
              actual: issue.actual,
              expected: issue.expected,
            },
            issue.message
          );
        });
      }

      // If no conversion is needed, return original file
      if (!validationResult.requiresConversion) {
        logger.info(
          { traceId, platformId, mediaType },
          "Media meets requirements, no conversion needed"
        );
        return { filePath, converted: false };
      }

      // Convert the media to meet platform requirements
      logger.info(
        {
          traceId,
          platformId,
          mediaType,
          issueCount: validationResult.issues.filter(
            (i) => i.severity === "error"
          ).length,
        },
        "Media conversion required"
      );

      const convertedPath =
        mediaInfo.type === "image"
          ? await convertImage(filePath, validationResult.targetSpecs!, traceId)
          : await convertVideo(
              filePath,
              validationResult.targetSpecs!,
              traceId
            );

      logger.info({ traceId, convertedPath }, "Media conversion complete");

      return { filePath: convertedPath, converted: true };
    } catch (error) {
      logger.error(
        {
          traceId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Media prep failed"
      );
      throw error;
    }
  });
}

/**
 * Detect if file is an image or video based on extension
 */
function detectMediaType(filePath: string): MediaType {
  const ext = extname(filePath).toLowerCase();
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
  ];
  const videoExtensions = [
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".webm",
    ".flv",
    ".wmv",
    ".m4v",
  ];

  if (imageExtensions.includes(ext)) return "image";
  if (videoExtensions.includes(ext)) return "video";

  // Default to video for unknown extensions (will be caught during inspection)
  return "video";
}

/**
 * Inspect image file using sharp
 */
async function inspectImage(filePath: string): Promise<MediaInfo> {
  const metadata = await sharp(filePath).metadata();
  const fileStat = await stat(filePath);

  const width = metadata.width;
  const height = metadata.height;
  const aspectRatio = width && height ? width / height : undefined;

  return {
    type: "image",
    width,
    height,
    aspectRatio,
    format: metadata.format,
    fileSize: fileStat.size,
  };
}

/**
 * Inspect video file using ffprobe via fluent-ffmpeg
 */
async function inspectVideo(filePath: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, async (err, metadata: FfprobeData) => {
      if (err) {
        reject(new Error(`ffprobe failed: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams?.find(
          (s) => s.codec_type === "video"
        );
        const audioStream = metadata.streams?.find(
          (s) => s.codec_type === "audio"
        );
        const format = metadata.format;

        const width = videoStream?.width;
        const height = videoStream?.height;
        const aspectRatio = width && height ? width / height : undefined;

        // Get frame rate (can be in multiple formats)
        let frameRate: number | undefined;
        if (videoStream?.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
          frameRate = num && den ? num / den : undefined;
        }

        const fileStat = await stat(filePath);

        resolve({
          type: "video",
          duration: format.duration
            ? parseFloat(format.duration.toString())
            : undefined,
          width,
          height,
          aspectRatio,
          codec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          frameRate,
          bitrate: format.bit_rate
            ? parseInt(format.bit_rate.toString())
            : undefined,
          fileSize: fileStat.size,
          format: format.format_name,
        });
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error}`));
      }
    });
  });
}

/**
 * Convert image using sharp
 * Creates a new file in request folder, preserving the original
 */
async function convertImage(
  inputPath: string,
  targetSpecs: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    videoCodec?: string;
    audioCodec?: string;
    maxDuration?: number;
    format?: string;
    quality?: number;
    frameRate?: number;
  },
  traceId: string
): Promise<string> {
  const tmpDir = config.tmpDir;
  const outputFormat = targetSpecs.format || "jpeg";
  const extension =
    outputFormat === "jpeg" || outputFormat === "jpg" ? "jpg" : outputFormat;

  // Request folder already exists from master worker
  const requestFolder = join(tmpDir, traceId);

  // Consistent naming: converted.{ext}
  const outputFileName = `converted.${extension}`;
  const outputPath = join(requestFolder, outputFileName);

  logger.debug(
    { inputPath, outputPath, requestFolder, willOverwrite: false },
    "Converting image to new file in request folder"
  );

  let pipeline = sharp(inputPath);

  // Resize if needed
  if (targetSpecs.width && targetSpecs.height) {
    pipeline = pipeline.resize(targetSpecs.width, targetSpecs.height, {
      fit: "cover", // Cover the area, crop if needed
      position: "center",
    });
  } else if (targetSpecs.width || targetSpecs.height) {
    pipeline = pipeline.resize(targetSpecs.width, targetSpecs.height, {
      fit: "inside", // Maintain aspect ratio
    });
  }

  // Convert format if needed
  if (outputFormat === "jpeg" || outputFormat === "jpg") {
    pipeline = pipeline.jpeg({
      quality: targetSpecs.quality || 90,
      mozjpeg: true, // Better compression
    });
  } else if (outputFormat === "png") {
    pipeline = pipeline.png({
      quality: targetSpecs.quality || 90,
      compressionLevel: 9,
    });
  } else if (outputFormat === "webp") {
    pipeline = pipeline.webp({
      quality: targetSpecs.quality || 90,
    });
  }

  await pipeline.toFile(outputPath);

  logger.debug(
    { inputPath, outputPath, targetSpecs },
    "Image conversion completed"
  );

  return outputPath;
}

/**
 * Convert video using fluent-ffmpeg
 * Creates a new file in request folder, preserving the original
 */
async function convertVideo(
  inputPath: string,
  targetSpecs: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    videoCodec?: string;
    audioCodec?: string;
    maxDuration?: number;
    format?: string;
    quality?: number;
    frameRate?: number;
  },
  traceId: string
): Promise<string> {
  const tmpDir = config.tmpDir;

  // Request folder already exists from master worker
  const requestFolder = join(tmpDir, traceId);

  // Consistent naming: converted.mp4
  const outputFileName = "converted.mp4";
  const outputPath = join(requestFolder, outputFileName);

  logger.debug(
    { inputPath, outputPath, requestFolder, willOverwrite: false },
    "Converting video to new file in request folder"
  );

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    // Video codec
    if (targetSpecs.videoCodec) {
      const codecName =
        targetSpecs.videoCodec === "h264" ? "libx264" : targetSpecs.videoCodec;
      command = command.videoCodec(codecName);

      // Add encoding options for quality
      command = command.outputOptions(["-preset medium", "-crf 23"]);
    } else {
      command = command.videoCodec("copy");
    }

    // Audio codec
    if (targetSpecs.audioCodec) {
      command = command.audioCodec(targetSpecs.audioCodec).audioBitrate("128k");
    } else {
      command = command.audioCodec("copy");
    }

    // Frame rate
    if (targetSpecs.frameRate) {
      command = command.fps(targetSpecs.frameRate);
    }

    // Resolution
    if (targetSpecs.width && targetSpecs.height) {
      // Ensure dimensions are divisible by 2 (required by many codecs)
      const w = Math.floor(targetSpecs.width / 2) * 2;
      const h = Math.floor(targetSpecs.height / 2) * 2;
      command = command.size(`${w}x${h}`);
    } else if (targetSpecs.aspectRatio) {
      // Adjust to target aspect ratio (pad or crop)
      // Parse aspect ratio (can be string like "0.5625" or "9/16")
      let targetAspectRatio: number;
      if (targetSpecs.aspectRatio.includes("/")) {
        const parts = targetSpecs.aspectRatio.split("/");
        if (parts.length >= 2) {
          const arWidth = Number(parts[0]);
          const arHeight = Number(parts[1]);
          if (arWidth && arHeight) {
            targetAspectRatio = arWidth / arHeight;
          } else {
            targetAspectRatio = parseFloat(targetSpecs.aspectRatio);
          }
        } else {
          targetAspectRatio = parseFloat(targetSpecs.aspectRatio);
        }
      } else {
        targetAspectRatio = parseFloat(targetSpecs.aspectRatio);
      }

      // Use standard dimensions based on aspect ratio
      const targetWidth = 1080;
      const targetHeight = Math.round(targetWidth / targetAspectRatio);
      command = command.videoFilters([
        `scale=-2:${targetHeight}`,
        `setsar=1`,
        `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`,
      ]);
    }

    // Duration limit
    if (targetSpecs.maxDuration) {
      command = command.duration(targetSpecs.maxDuration);
    }

    // Output format
    command = command.format("mp4");

    logger.debug(
      { inputPath, outputPath, targetSpecs },
      "Running ffmpeg conversion"
    );

    command
      .on("start", (commandLine) => {
        logger.debug({ commandLine }, "FFmpeg command started");
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          logger.debug(
            { percent: progress.percent.toFixed(2) },
            "FFmpeg progress"
          );
        }
      })
      .on("error", (err, stdout, stderr) => {
        logger.error({ err: err.message, stderr }, "FFmpeg conversion failed");
        reject(new Error(`ffmpeg failed: ${err.message}`));
      })
      .on("end", () => {
        logger.debug({ outputPath }, "FFmpeg conversion completed");
        resolve(outputPath);
      })
      .save(outputPath);
  });
}
