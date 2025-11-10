const isProduction = process.env.NODE_ENV === "production";

const config = {
  env: process.env.NODE_ENV,
  db: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
  },
  masterKey: process.env.MASTER_KEY,
  port: Number(process.env.PORT),
  hostname: process.env.HOSTNAME,
  infra: {
    appName: process.env.APP_NAME,
    appVersion: process.env.APP_VERSION,
    appEnvironment: process.env.APP_ENVIRONMENT,
  },
  axiom: {
    apiKey: process.env.AXIOM_API_KEY,
    dataset: process.env.AXIOM_DATASET,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
  platforms: {
    instagram: {
      graphUrl: process.env.INSTAGRAM_GRAPH_URL,
      graphVersion: process.env.INSTAGRAM_GRAPH_VERSION,
      imagesRequirements: {
        minAspectRatio: process.env.INSTAGRAM_IMAGES_MIN_ASPECT_RATIO,
        maxAspectRatio: process.env.INSTAGRAM_IMAGES_MAX_ASPECT_RATIO,
        formats: process.env.INSTAGRAM_IMAGES_FORMATS?.split(","),
        maxFileSizeMB: Number(process.env.INSTAGRAM_IMAGES_MAX_FILE_SIZE_MB),
      },
      videoRequirements: {
        formats: process.env.INSTAGRAM_REELS_FORMATS?.split(","),
        audioCodecs: process.env.INSTAGRAM_REELS_AUDIO_CODECS?.split(","),
        videoCodecs: process.env.INSTAGRAM_REELS_VIDEO_CODECS?.split(","),
        maxWidth: Number(process.env.INSTAGRAM_REELS_MAX_WIDTH),
        aspectRatio: process.env.INSTAGRAM_REELS_ASPECT_RATIO,
        maxFileSizeMB: Number(process.env.INSTAGRAM_REELS_MAX_FILE_SIZE_MB),
        maxDurationSeconds: Number(
          process.env.INSTAGRAM_REELS_MAX_DURATION_SECONDS
        ),
        frameRateRange: process.env.INSTAGRAM_REELS_FRAME_RATE_RANGE,
      },
    },
    youtube: {
      requiredScopes: process.env.YOUTUBE_REQUIRED_SCOPES,
    },
  },
};

export default config;
