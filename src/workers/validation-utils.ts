/**
 * Media Validation Utilities
 * 
 * Provides comprehensive validation for media files against platform-specific constraints.
 * Supports two modes:
 * 1. Strict Mode (enforceConstraints: true) - Throws error if constraints are violated
 * 2. Auto-Format Mode (enforceConstraints: false) - Returns conversion specs to meet constraints
 */

import { PLATFORM_TYPES } from "@/shared/constants";
import { BadRequestError } from "@/shared/exceptions";

export interface MediaInfo {
  type: "image" | "video";
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

export interface MediaRequirements {
  // Video requirements
  formats?: string[];
  audioCodecs?: string[];
  videoCodecs?: string[];
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  minWidthPixels?: number;
  maxWidthPixels?: number;
  minHeightPixels?: number;
  maxHeightPixels?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  recommendedAspectRatio?: number;
  maxFileSizeMB?: number;
  minFrameRate?: number;
  maxFrameRate?: number;
  frameRateRange?: string;
  maxVideoBitrateMbps?: number;
  maxAudioBitrateKbps?: number;
  
  // Image requirements
  minResolution?: number;
}

export interface ValidationIssue {
  field: string;
  actual: any;
  expected: any;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  requiresConversion: boolean;
  targetSpecs?: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    videoCodec?: string;
    audioCodec?: string;
    maxDuration?: number;
    format?: string;
    quality?: number;
    frameRate?: number;
  };
}

/**
 * Validate media against platform requirements
 */
export function validateMediaConstraints(
  mediaInfo: MediaInfo,
  requirements: MediaRequirements,
  platformType: PLATFORM_TYPES,
  enforceConstraints: boolean = false
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const result: ValidationResult = {
    isValid: true,
    issues,
    requiresConversion: false,
    targetSpecs: {},
  };

  if (mediaInfo.type === "video") {
    validateVideoConstraints(mediaInfo, requirements, issues, result);
  } else if (mediaInfo.type === "image") {
    validateImageConstraints(mediaInfo, requirements, issues, result);
  }

  // Determine if conversion is needed
  result.requiresConversion = issues.some((issue) => issue.severity === "error");
  result.isValid = issues.length === 0;

  // If enforceConstraints is true and there are errors, throw an exception
  if (enforceConstraints && !result.isValid) {
    const errorMessages = issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message)
      .join("; ");
    
    throw new BadRequestError(
      `Media does not meet platform requirements: ${errorMessages}`
    );
  }

  return result;
}

/**
 * Validate video-specific constraints
 */
function validateVideoConstraints(
  mediaInfo: MediaInfo,
  requirements: MediaRequirements,
  issues: ValidationIssue[],
  result: ValidationResult
): void {
  // Duration validation
  if (requirements.minDurationSeconds !== undefined && mediaInfo.duration) {
    if (mediaInfo.duration < requirements.minDurationSeconds) {
      issues.push({
        field: "duration",
        actual: mediaInfo.duration,
        expected: `>= ${requirements.minDurationSeconds}s`,
        message: `Video duration ${mediaInfo.duration.toFixed(2)}s is below minimum ${requirements.minDurationSeconds}s`,
        severity: "error",
      });
    }
  }

  if (requirements.maxDurationSeconds !== undefined && mediaInfo.duration) {
    if (mediaInfo.duration > requirements.maxDurationSeconds) {
      issues.push({
        field: "duration",
        actual: mediaInfo.duration,
        expected: `<= ${requirements.maxDurationSeconds}s`,
        message: `Video duration ${mediaInfo.duration.toFixed(2)}s exceeds maximum ${requirements.maxDurationSeconds}s`,
        severity: "error",
      });
      result.targetSpecs!.maxDuration = requirements.maxDurationSeconds;
    }
  }

  // Resolution validation
  if (requirements.minWidthPixels !== undefined && mediaInfo.width) {
    if (mediaInfo.width < requirements.minWidthPixels) {
      issues.push({
        field: "width",
        actual: mediaInfo.width,
        expected: `>= ${requirements.minWidthPixels}px`,
        message: `Video width ${mediaInfo.width}px is below minimum ${requirements.minWidthPixels}px`,
        severity: "error",
      });
    }
  }

  if (requirements.maxWidthPixels !== undefined && mediaInfo.width) {
    if (mediaInfo.width > requirements.maxWidthPixels) {
      issues.push({
        field: "width",
        actual: mediaInfo.width,
        expected: `<= ${requirements.maxWidthPixels}px`,
        message: `Video width ${mediaInfo.width}px exceeds maximum ${requirements.maxWidthPixels}px`,
        severity: "error",
      });
      result.targetSpecs!.width = requirements.maxWidthPixels;
      
      // Calculate height maintaining aspect ratio
      if (mediaInfo.aspectRatio) {
        result.targetSpecs!.height = Math.round(
          requirements.maxWidthPixels / mediaInfo.aspectRatio
        );
      }
    }
  }

  if (requirements.minHeightPixels !== undefined && mediaInfo.height) {
    if (mediaInfo.height < requirements.minHeightPixels) {
      issues.push({
        field: "height",
        actual: mediaInfo.height,
        expected: `>= ${requirements.minHeightPixels}px`,
        message: `Video height ${mediaInfo.height}px is below minimum ${requirements.minHeightPixels}px`,
        severity: "error",
      });
    }
  }

  if (requirements.maxHeightPixels !== undefined && mediaInfo.height) {
    if (mediaInfo.height > requirements.maxHeightPixels) {
      issues.push({
        field: "height",
        actual: mediaInfo.height,
        expected: `<= ${requirements.maxHeightPixels}px`,
        message: `Video height ${mediaInfo.height}px exceeds maximum ${requirements.maxHeightPixels}px`,
        severity: "error",
      });
    }
  }

  // Aspect ratio validation
  if (mediaInfo.aspectRatio) {
    if (requirements.minAspectRatio !== undefined) {
      if (mediaInfo.aspectRatio < requirements.minAspectRatio) {
        issues.push({
          field: "aspectRatio",
          actual: mediaInfo.aspectRatio.toFixed(2),
          expected: `>= ${requirements.minAspectRatio}`,
          message: `Video aspect ratio ${mediaInfo.aspectRatio.toFixed(2)} is below minimum ${requirements.minAspectRatio}`,
          severity: "error",
        });
        
        // Set target to recommended aspect ratio if available
        if (requirements.recommendedAspectRatio) {
          result.targetSpecs!.aspectRatio = requirements.recommendedAspectRatio.toString();
        }
      }
    }

    if (requirements.maxAspectRatio !== undefined) {
      if (mediaInfo.aspectRatio > requirements.maxAspectRatio) {
        issues.push({
          field: "aspectRatio",
          actual: mediaInfo.aspectRatio.toFixed(2),
          expected: `<= ${requirements.maxAspectRatio}`,
          message: `Video aspect ratio ${mediaInfo.aspectRatio.toFixed(2)} exceeds maximum ${requirements.maxAspectRatio}`,
          severity: "error",
        });
        
        // Set target to recommended aspect ratio if available
        if (requirements.recommendedAspectRatio) {
          result.targetSpecs!.aspectRatio = requirements.recommendedAspectRatio.toString();
        }
      }
    }

    // Check recommended aspect ratio (warning only)
    if (requirements.recommendedAspectRatio !== undefined) {
      const tolerance = 0.05; // 5% tolerance
      if (Math.abs(mediaInfo.aspectRatio - requirements.recommendedAspectRatio) > tolerance) {
        issues.push({
          field: "aspectRatio",
          actual: mediaInfo.aspectRatio.toFixed(2),
          expected: requirements.recommendedAspectRatio.toFixed(2),
          message: `Video aspect ratio ${mediaInfo.aspectRatio.toFixed(2)} differs from recommended ${requirements.recommendedAspectRatio.toFixed(2)}`,
          severity: "warning",
        });
      }
    }
  }

  // Frame rate validation
  if (mediaInfo.frameRate) {
    if (requirements.minFrameRate !== undefined) {
      if (mediaInfo.frameRate < requirements.minFrameRate) {
        issues.push({
          field: "frameRate",
          actual: mediaInfo.frameRate,
          expected: `>= ${requirements.minFrameRate} fps`,
          message: `Video frame rate ${mediaInfo.frameRate}fps is below minimum ${requirements.minFrameRate}fps`,
          severity: "error",
        });
        result.targetSpecs!.frameRate = requirements.minFrameRate;
      }
    }

    if (requirements.maxFrameRate !== undefined) {
      if (mediaInfo.frameRate > requirements.maxFrameRate) {
        issues.push({
          field: "frameRate",
          actual: mediaInfo.frameRate,
          expected: `<= ${requirements.maxFrameRate} fps`,
          message: `Video frame rate ${mediaInfo.frameRate}fps exceeds maximum ${requirements.maxFrameRate}fps`,
          severity: "error",
        });
        result.targetSpecs!.frameRate = requirements.maxFrameRate;
      }
    }
  }

  // Codec validation
  if (requirements.videoCodecs && mediaInfo.codec) {
    if (!requirements.videoCodecs.includes(mediaInfo.codec.toLowerCase())) {
      issues.push({
        field: "videoCodec",
        actual: mediaInfo.codec,
        expected: requirements.videoCodecs.join(", "),
        message: `Video codec '${mediaInfo.codec}' is not supported. Supported codecs: ${requirements.videoCodecs.join(", ")}`,
        severity: "error",
      });
      result.targetSpecs!.videoCodec = requirements.videoCodecs[0];
    }
  }

  if (requirements.audioCodecs && mediaInfo.audioCodec) {
    if (!requirements.audioCodecs.includes(mediaInfo.audioCodec.toLowerCase())) {
      issues.push({
        field: "audioCodec",
        actual: mediaInfo.audioCodec,
        expected: requirements.audioCodecs.join(", "),
        message: `Audio codec '${mediaInfo.audioCodec}' is not supported. Supported codecs: ${requirements.audioCodecs.join(", ")}`,
        severity: "error",
      });
      result.targetSpecs!.audioCodec = requirements.audioCodecs[0];
    }
  }

  // File size validation
  if (requirements.maxFileSizeMB !== undefined && mediaInfo.fileSize) {
    const maxSizeBytes = requirements.maxFileSizeMB * 1024 * 1024;
    if (mediaInfo.fileSize > maxSizeBytes) {
      const actualSizeMB = (mediaInfo.fileSize / 1024 / 1024).toFixed(2);
      issues.push({
        field: "fileSize",
        actual: `${actualSizeMB}MB`,
        expected: `<= ${requirements.maxFileSizeMB}MB`,
        message: `Video file size ${actualSizeMB}MB exceeds maximum ${requirements.maxFileSizeMB}MB`,
        severity: "error",
      });
      // Note: File size reduction typically requires re-encoding with quality settings
      result.targetSpecs!.quality = 85; // Compress
    }
  }

  // Format validation
  if (requirements.formats && mediaInfo.format) {
    const formatList = mediaInfo.format.split(",");
    const hasAcceptedFormat = formatList.some((fmt) =>
      requirements.formats!.includes(fmt.trim().toLowerCase())
    );

    if (!hasAcceptedFormat) {
      issues.push({
        field: "format",
        actual: mediaInfo.format,
        expected: requirements.formats.join(", "),
        message: `Video format '${mediaInfo.format}' is not supported. Supported formats: ${requirements.formats.join(", ")}`,
        severity: "error",
      });
      result.targetSpecs!.format = requirements.formats[0];
    }
  }
}

/**
 * Validate image-specific constraints
 */
function validateImageConstraints(
  mediaInfo: MediaInfo,
  requirements: MediaRequirements,
  issues: ValidationIssue[],
  result: ValidationResult
): void {
  // Aspect ratio validation for images
  if (mediaInfo.aspectRatio) {
    if (requirements.minAspectRatio !== undefined) {
      if (mediaInfo.aspectRatio < requirements.minAspectRatio) {
        issues.push({
          field: "aspectRatio",
          actual: mediaInfo.aspectRatio.toFixed(2),
          expected: `>= ${requirements.minAspectRatio}`,
          message: `Image aspect ratio ${mediaInfo.aspectRatio.toFixed(2)} is below minimum ${requirements.minAspectRatio}`,
          severity: "error",
        });
        
        // Default to 1:1 (square) as safe option
        result.targetSpecs!.width = 1080;
        result.targetSpecs!.height = 1080;
      }
    }

    if (requirements.maxAspectRatio !== undefined) {
      if (mediaInfo.aspectRatio > requirements.maxAspectRatio) {
        issues.push({
          field: "aspectRatio",
          actual: mediaInfo.aspectRatio.toFixed(2),
          expected: `<= ${requirements.maxAspectRatio}`,
          message: `Image aspect ratio ${mediaInfo.aspectRatio.toFixed(2)} exceeds maximum ${requirements.maxAspectRatio}`,
          severity: "error",
        });
        
        // Default to 1:1 (square) as safe option
        result.targetSpecs!.width = 1080;
        result.targetSpecs!.height = 1080;
      }
    }
  }

  // Resolution validation
  if (requirements.minWidthPixels !== undefined && mediaInfo.width) {
    if (mediaInfo.width < requirements.minWidthPixels) {
      issues.push({
        field: "width",
        actual: mediaInfo.width,
        expected: `>= ${requirements.minWidthPixels}px`,
        message: `Image width ${mediaInfo.width}px is below minimum ${requirements.minWidthPixels}px`,
        severity: "error",
      });
      result.targetSpecs!.width = requirements.minWidthPixels;
    }
  }

  if (requirements.maxWidthPixels !== undefined && mediaInfo.width) {
    if (mediaInfo.width > requirements.maxWidthPixels) {
      issues.push({
        field: "width",
        actual: mediaInfo.width,
        expected: `<= ${requirements.maxWidthPixels}px`,
        message: `Image width ${mediaInfo.width}px exceeds maximum ${requirements.maxWidthPixels}px`,
        severity: "error",
      });
      result.targetSpecs!.width = requirements.maxWidthPixels;
    }
  }

  // Format validation
  if (requirements.formats && mediaInfo.format) {
    if (!requirements.formats.includes(mediaInfo.format.toLowerCase())) {
      issues.push({
        field: "format",
        actual: mediaInfo.format,
        expected: requirements.formats.join(", "),
        message: `Image format '${mediaInfo.format}' is not supported. Supported formats: ${requirements.formats.join(", ")}`,
        severity: "error",
      });
      result.targetSpecs!.format = "jpeg"; // Default to JPEG for images
    }
  }

  // File size validation
  if (requirements.maxFileSizeMB !== undefined && mediaInfo.fileSize) {
    const maxSizeBytes = requirements.maxFileSizeMB * 1024 * 1024;
    if (mediaInfo.fileSize > maxSizeBytes) {
      const actualSizeMB = (mediaInfo.fileSize / 1024 / 1024).toFixed(2);
      issues.push({
        field: "fileSize",
        actual: `${actualSizeMB}MB`,
        expected: `<= ${requirements.maxFileSizeMB}MB`,
        message: `Image file size ${actualSizeMB}MB exceeds maximum ${requirements.maxFileSizeMB}MB`,
        severity: "error",
      });
      result.targetSpecs!.quality = 85; // Compress
    }
  }
}

