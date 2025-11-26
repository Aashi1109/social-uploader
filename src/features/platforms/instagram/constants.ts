export const INSTAGRAM_PUBLISH_TYPES = Object.freeze({
  Reels: "reels",
  Carousel: "carousel",
});

export const INSTAGRAM_VISIBILITY = Object.freeze({
  Unlisted: "unlisted",
  Private: "private",
  Public: "public",
});

export const INSTAGRAM_UPLOAD_FORMATS = Object.freeze({
  Video: "video",
  Image: "image",
  Mixed: "mixed",
});

// Image constraints for Instagram Feed/Carousel
export const INSTAGRAM_IMAGE_REQUIREMENTS = {
  formats: ["jpg", "jpeg", "png"],
  minAspectRatio: 0.8, // 4:5 portrait
  maxAspectRatio: 1.91, // 1.91:1 landscape
  maxFileSizeMB: 8,
  minWidthPixels: 320,
  maxWidthPixels: 1440,
};

// Image constraints specific to Carousel
export const INSTAGRAM_CAROUSEL_IMAGE_REQUIREMENTS = {
  ...INSTAGRAM_IMAGE_REQUIREMENTS,
  maxFileSizeMB: 30,
  minWidthPixels: 600,
  minResolution: 1080, // For carousel ads
};

// Video constraints for Instagram
export const INSTAGRAM_VIDEO_REQUIREMENTS = {
  formats: ["mp4", "mov"],
  audioCodecs: ["aac"],
  videoCodecs: ["h264", "hevc"],
  frameRateRange: "23-60",
  maxVideoBitrateMbps: 25,
  maxAudioBitrateKbps: 128,
};

export const INSTAGRAM_BASE_DEFAULTS = {
  uploadType: INSTAGRAM_UPLOAD_FORMATS.Video,
  visibility: INSTAGRAM_VISIBILITY.Unlisted,
};

export const INSTAGRAM_UPLOAD_DEFAULTS = {
  [INSTAGRAM_PUBLISH_TYPES.Reels]: {
    ...INSTAGRAM_BASE_DEFAULTS,
    uploadType: INSTAGRAM_UPLOAD_FORMATS.Video,
    requirements: {
      video: {
        ...INSTAGRAM_VIDEO_REQUIREMENTS,
        minDurationSeconds: 3,
        maxDurationSeconds: 90, // 90 seconds (updated from official specs)
        minWidthPixels: 540,
        minHeightPixels: 960,
        maxWidthPixels: 1920,
        maxHeightPixels: 1920,
        minAspectRatio: 0.5625, // 9:16 recommended aspect ratio
        maxAspectRatio: 1.91,
        maxFileSizeMB: 4000, // 4GB (updated from official specs)
        minFrameRate: 30, // Minimum 30 FPS
        recommendedAspectRatio: 0.5625, // 9:16 (1080x1920)
      },
    },
  },
  [INSTAGRAM_PUBLISH_TYPES.Carousel]: {
    ...INSTAGRAM_BASE_DEFAULTS,
    uploadType: INSTAGRAM_UPLOAD_FORMATS.Mixed,
    requirements: {
      image: {
        ...INSTAGRAM_CAROUSEL_IMAGE_REQUIREMENTS,
      },
      video: {
        ...INSTAGRAM_VIDEO_REQUIREMENTS,
        minDurationSeconds: 3,
        maxDurationSeconds: 60,
        minWidthPixels: 600,
        minAspectRatio: 0.8, // 4:5 portrait
        maxAspectRatio: 1.91, // 1.91:1 landscape
        maxFileSizeMB: 4000, // 4GB
        minFrameRate: 30,
      },
      minItems: 2,
      maxItems: 10,
      maxCaptionLength: 2200,
      maxHashtags: 30,
      maxMentions: 20,
    },
  },
};
