export const YOUTUBE_PUBLISH_TYPES = Object.freeze({
  Shorts: "shorts",
  Standard: "standard",
});

export const YOUTUBE_VISIBILITY = Object.freeze({
  Unlisted: "unlisted",
  Private: "private",
  Public: "public",
});

export const YOUTUBE_UPLOAD_FORMATS = Object.freeze({
  Video: "video",
});

export const YOUTUBE_BASE_DEFAULTS = {
  uploadType: YOUTUBE_UPLOAD_FORMATS.Video,
  visibility: YOUTUBE_VISIBILITY.Unlisted,
  requirements: {
    formats: ["mp4", "mov"],
    audioCodecs: ["aac", "mp3", "opus"],
    videoCodecs: ["h264"],
  },
};

export const YOUTUBE_UPLOAD_DEFAULTS = {
  [YOUTUBE_PUBLISH_TYPES.Shorts]: {
    ...YOUTUBE_BASE_DEFAULTS,
    requirements: {
      ...YOUTUBE_BASE_DEFAULTS.requirements,
      maxDurationSeconds: 60,
      minDurationSeconds: 1,
      maxWidthPixels: 1080,
      maxHeightPixels: 1920,
      maxFileSizeMB: 128000, // 128GB (official YouTube limit)
      recommendedAspectRatio: 0.5625, // 9:16 vertical
      minFrameRate: 24,
      maxFrameRate: 60,
    },
  },
  [YOUTUBE_PUBLISH_TYPES.Standard]: {
    ...YOUTUBE_BASE_DEFAULTS,
    requirements: {
      ...YOUTUBE_BASE_DEFAULTS.requirements,
      maxDurationSeconds: 43200, // 12 hours (verified)
      minDurationSeconds: 1,
      maxWidthPixels: 3840, // 4K resolution
      maxHeightPixels: 2160,
      maxFileSizeMB: 128000, // 128GB (official YouTube limit)
      recommendedAspectRatio: 1.7778, // 16:9 standard
      minFrameRate: 24,
      maxFrameRate: 60,
    },
  },
};
