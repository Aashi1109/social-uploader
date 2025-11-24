import { createWorker } from "@/core/queues";
import { PlatformService } from "@/features";
import { PublishJobData } from "@/shared/types/publish";
import { PLATFORM_TYPES } from "@/shared/constants";
import { logger } from "@/core/logger";
import config from "@/config";
import { join, extname, basename } from "node:path";
import { stat, mkdir } from "node:fs/promises";
import ffmpeg from "fluent-ffmpeg";
import type { FfprobeData } from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import sharp from "sharp";
import { JsonSchema } from "@/shared/types/json";
import { isEmpty } from "@/shared/utils";

// Configure fluent-ffmpeg to use bundled binaries (no system dependencies)
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath?.path) {
  ffmpeg.setFfprobePath(ffprobePath.path);
}

type MediaType = "image" | "video";

interface MediaInfo {
  type: MediaType;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  codec?: string;
  audioCodec?: string;
  frameRate?: number;
  bitrate?: number;
  fileSize?: number;
  format?: string;
}

interface ConversionNeeds {
  needsConversion: boolean;
  reasons: string[];
  targetSpecs?: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    videoCodec?: string;
    audioCodec?: string;
    maxDuration?: number;
    format?: string;
    quality?: number;
  };
}

interface MediaPrepResult {
  filePath: string;
  converted: boolean;
}

enum UploadTypes {
  ShortVideos = "short-videos",
  LongVideos = "long-videos",
  Image = "image",
}

const getMediaUploadConfig = (
  platformType: PLATFORM_TYPES,
  config: JsonSchema
) => {
  switch (platformType) {
    case PLATFORM_TYPES.INSTAGRAM:
      return "image";
    case PLATFORM_TYPES.YOUTUBE: {
      const uploadType = config.uploadType;
      const uploadConfig = config[uploadType];

      if (isEmpty(uploadConfig)) throw new Error(`Upload config missing`);
      return uploadConfig;
    }
    default:
      throw new Error("Invalid platform type");
  }
};

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
      const { config, type } = await platformService.getById(platformId, true);

      const uploadType = config.uploadType;
      const requirements = config.requirements;

      // Detect media type
      const mediaType = detectMediaType(filePath);
      logger.debug({ traceId, mediaType }, "Media type detected");

      // Inspect the media file
      const mediaInfo =
        mediaType === "image"
          ? await inspectImage(filePath)
          : await inspectVideo(filePath);
      logger.debug({ traceId, mediaInfo }, "Media inspection complete");

      // Check if conversion is needed
      const conversionNeeds = analyzeConversionNeeds(
        mediaInfo,
        requirements,
        type
      );

      if (!conversionNeeds.needsConversion) {
        logger.info(
          { traceId, platformId, mediaType },
          "Media meets requirements, no conversion needed"
        );
        return { filePath, converted: false };
      }

      // Convert the media
      logger.info(
        { traceId, platformId, mediaType, reasons: conversionNeeds.reasons },
        "Media conversion required"
      );

      const convertedPath =
        mediaInfo.type === "image"
          ? await convertImage(filePath, conversionNeeds.targetSpecs!, traceId)
          : await convertVideo(filePath, conversionNeeds.targetSpecs!, traceId);

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
 * Analyze if media needs conversion based on platform requirements
 */
function analyzeConversionNeeds(
  mediaInfo: MediaInfo,
  requirements: any,
  platform: PLATFORM_TYPES
): ConversionNeeds {
  const reasons: string[] = [];
  const result: ConversionNeeds = {
    needsConversion: false,
    reasons,
    targetSpecs: {},
  };

  if (platform === PLATFORM_TYPES.INSTAGRAM) {
    // Handle images
    if (mediaInfo.type === "image") {
      const imageReq = requirements.imagesRequirements;
      if (!imageReq) return result;

      // Check aspect ratio
      if (mediaInfo.aspectRatio) {
        const minAspectRatio = imageReq.minAspectRatio
          ? parseFloat(imageReq.minAspectRatio)
          : 0.8;
        const maxAspectRatio = imageReq.maxAspectRatio
          ? parseFloat(imageReq.maxAspectRatio)
          : 1.91;

        if (
          mediaInfo.aspectRatio < minAspectRatio ||
          mediaInfo.aspectRatio > maxAspectRatio
        ) {
          reasons.push(
            `Aspect ratio ${mediaInfo.aspectRatio.toFixed(2)} outside range ${minAspectRatio}-${maxAspectRatio}`
          );
          // Fit to 1:1 (1080x1080) as safe default
          result.targetSpecs!.width = 1080;
          result.targetSpecs!.height = 1080;
        }
      }

      // Check format
      const acceptedFormats = imageReq.formats || ["jpeg", "jpg", "png"];
      if (mediaInfo.format && !acceptedFormats.includes(mediaInfo.format)) {
        reasons.push(`Format ${mediaInfo.format} not in accepted list`);
        result.targetSpecs!.format = "jpeg";
      }

      // Check file size
      const maxSizeBytes = (imageReq.maxFileSizeMB || 8) * 1024 * 1024;
      if (mediaInfo.fileSize && mediaInfo.fileSize > maxSizeBytes) {
        reasons.push(
          `File size ${(mediaInfo.fileSize / 1024 / 1024).toFixed(2)}MB exceeds max ${imageReq.maxFileSizeMB || 8}MB`
        );
        result.targetSpecs!.quality = 85; // Compress
      }

      result.needsConversion = reasons.length > 0;
      return result;
    }

    // Handle videos
    const videoReq = requirements.videoRequirements;
    if (!videoReq) return result;

    // Check video codec
    if (
      videoReq.videoCodecs &&
      !videoReq.videoCodecs.includes(mediaInfo.codec)
    ) {
      reasons.push(`Video codec ${mediaInfo.codec} not supported`);
      result.targetSpecs!.videoCodec = videoReq.videoCodecs[0];
    }

    // Check audio codec
    if (
      videoReq.audioCodecs &&
      !videoReq.audioCodecs.includes(mediaInfo.audioCodec)
    ) {
      reasons.push(`Audio codec ${mediaInfo.audioCodec} not supported`);
      result.targetSpecs!.audioCodec = videoReq.audioCodecs[0];
    }

    // Check width
    if (
      videoReq.maxWidth &&
      mediaInfo.width &&
      mediaInfo.width > videoReq.maxWidth
    ) {
      reasons.push(`Width ${mediaInfo.width} exceeds max ${videoReq.maxWidth}`);
      result.targetSpecs!.width = videoReq.maxWidth;
      // Calculate height to maintain aspect ratio
      if (mediaInfo.aspectRatio) {
        result.targetSpecs!.height = Math.round(
          videoReq.maxWidth / mediaInfo.aspectRatio
        );
      }
    }

    // Check duration
    if (
      videoReq.maxDurationSeconds &&
      mediaInfo.duration &&
      mediaInfo.duration > videoReq.maxDurationSeconds
    ) {
      reasons.push(
        `Duration ${mediaInfo.duration}s exceeds max ${videoReq.maxDurationSeconds}s`
      );
      result.targetSpecs!.maxDuration = videoReq.maxDurationSeconds;
    }

    // Check aspect ratio (Instagram Reels is 9:16)
    if (videoReq.aspectRatio && mediaInfo.aspectRatio) {
      const targetAspectRatio = eval(videoReq.aspectRatio); // e.g., "9/16"
      const tolerance = 0.05; // 5% tolerance
      if (Math.abs(mediaInfo.aspectRatio - targetAspectRatio) > tolerance) {
        reasons.push(
          `Aspect ratio ${mediaInfo.aspectRatio.toFixed(2)} does not match ${videoReq.aspectRatio}`
        );
        result.targetSpecs!.aspectRatio = videoReq.aspectRatio;
      }
    }

    // Check file size
    const maxSizeBytes = videoReq.maxFileSizeMB * 1024 * 1024;
    if (mediaInfo.fileSize && mediaInfo.fileSize > maxSizeBytes) {
      reasons.push(
        `File size ${(mediaInfo.fileSize / 1024 / 1024).toFixed(2)}MB exceeds max ${videoReq.maxFileSizeMB}MB`
      );
    }
  } else if (platform === PLATFORM_TYPES.YOUTUBE) {
    // YouTube primarily supports videos, but thumbnails are images
    if (mediaInfo.type === "image") {
      // For YouTube thumbnails (if applicable)
      const imageReq = requirements.imagesRequirements;
      if (imageReq) {
        // YouTube thumbnail: 1280x720 recommended
        if (
          mediaInfo.width &&
          mediaInfo.height &&
          (mediaInfo.width < 1280 || mediaInfo.height < 720)
        ) {
          reasons.push(
            `Image dimensions ${mediaInfo.width}x${mediaInfo.height} below recommended 1280x720`
          );
          result.targetSpecs!.width = 1280;
          result.targetSpecs!.height = 720;
        }

        // Check format
        const acceptedFormats = ["jpeg", "jpg", "png"];
        if (mediaInfo.format && !acceptedFormats.includes(mediaInfo.format)) {
          reasons.push(`Format ${mediaInfo.format} not optimal for YouTube`);
          result.targetSpecs!.format = "jpeg";
        }
      }
      result.needsConversion = reasons.length > 0;
      return result;
    }

    // YouTube video requirements are more lenient
    const videoReq = requirements.videoRequirements;
    if (!videoReq) return result;

    // YouTube accepts H.264 and others, but we'll standardize to H.264 if needed
    const acceptedCodecs = ["h264", "hevc", "vp9"];
    if (mediaInfo.codec && !acceptedCodecs.includes(mediaInfo.codec)) {
      reasons.push(`Video codec ${mediaInfo.codec} not optimal for YouTube`);
      result.targetSpecs!.videoCodec = "h264";
    }

    // YouTube prefers AAC audio
    const acceptedAudioCodecs = ["aac", "mp3", "vorbis", "opus"];
    if (
      mediaInfo.audioCodec &&
      !acceptedAudioCodecs.includes(mediaInfo.audioCodec)
    ) {
      reasons.push(
        `Audio codec ${mediaInfo.audioCodec} not optimal for YouTube`
      );
      result.targetSpecs!.audioCodec = "aac";
    }

    // Check max duration if configured
    if (
      videoReq.maxDurationSeconds &&
      mediaInfo.duration &&
      mediaInfo.duration > videoReq.maxDurationSeconds
    ) {
      reasons.push(
        `Duration ${mediaInfo.duration}s exceeds max ${videoReq.maxDurationSeconds}s`
      );
      result.targetSpecs!.maxDuration = videoReq.maxDurationSeconds;
    }
  }

  result.needsConversion = reasons.length > 0;
  return result;
}

/**
 * Convert image using sharp
 * Creates a new file in request folder, preserving the original
 */
async function convertImage(
  inputPath: string,
  targetSpecs: NonNullable<ConversionNeeds["targetSpecs"]>,
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
  targetSpecs: NonNullable<ConversionNeeds["targetSpecs"]>,
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

    // Resolution
    if (targetSpecs.width && targetSpecs.height) {
      // Ensure dimensions are divisible by 2 (required by many codecs)
      const w = Math.floor(targetSpecs.width / 2) * 2;
      const h = Math.floor(targetSpecs.height / 2) * 2;
      command = command.size(`${w}x${h}`);
    } else if (targetSpecs.aspectRatio) {
      // Adjust to target aspect ratio (pad or crop)
      // For Instagram Reels: 9:16 aspect ratio (1080x1920)
      const [arWidth, arHeight] = targetSpecs.aspectRatio
        .split("/")
        .map(Number);
      if (arWidth && arHeight) {
        const targetWidth = 1080;
        const targetHeight = Math.round((targetWidth * arHeight) / arWidth);
        command = command.videoFilters([
          `scale=-2:${targetHeight}`,
          `setsar=1`,
          `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`,
        ]);
      }
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
