import type { YouTubeSecret } from "@/shared/secrets/schemas";
import {
  BasePlatformService,
  VendorPublishResult,
  VendorVerifyResult,
} from "@/shared/interfaces";
import axios from "axios";
import config from "@/config";
import { OAUTH_STEP_TYPES } from "@/shared/constants";
import { RequestContext } from "@/api/middleware";
import { isEmpty } from "@/shared/utils";
import { GoogleOAuthService } from "@/features/oauth";
import { logger } from "@/core/logger";
import { google } from "googleapis";
import { BadRequestError } from "@/shared/exceptions";
import fs from "fs";
import { GaxiosError } from "gaxios";

// Resumable upload configuration
const MAX_RETRIES = 10;
const RETRIABLE_STATUS_CODES = [500, 502, 503, 504];
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks for stable uploads

interface UploadOptions {
  filePath: string;
  title: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
  privacyStatus?: "public" | "private" | "unlisted";
  onProgress?: (progress: {
    uploadedBytes: number;
    totalBytes: number;
  }) => void;
}

class YouTubeService implements BasePlatformService {
  #googleOAuthService: GoogleOAuthService;

  constructor(clientId: string, clientSecret: string) {
    if (!clientId || !clientSecret) {
      throw new Error("Client ID and client secret are required");
    }

    this.#googleOAuthService = new GoogleOAuthService(clientId, clientSecret);
  }

  async verify(tokens: YouTubeSecret["tokens"]): Promise<VendorVerifyResult> {
    if (isEmpty(tokens)) throw new BadRequestError("Tokens are required");
    const { refreshToken, accessToken } = tokens!;

    const channelList = await this.getChannelList(accessToken, refreshToken);
    logger.debug({ channelList }, "Channel list");
    return { data: { isValidated: true } };
  }

  initOAuth(isRefresh = false, secretId?: string): VendorVerifyResult {
    const authorizationUri = this.#googleOAuthService.buildAuthorizationUri({
      state: { requestId: RequestContext.getRequestId(), isRefresh, secretId },
      scopes: config.platforms.youtube.requiredScopes || [],
      redirectUri: config.platforms.youtube.redirectUri || "",
      prompt: "consent", // Force consent to ensure we always get a refresh token
    });

    return {
      data: {
        isIncomplete: true,
        authorizationUri: authorizationUri,
        redirectUri: config.platforms.youtube.redirectUri || "",
      },
    };
  }

  async publish(data: {
    filePath: string;
    title: string;
    description?: string;
    accessToken: string;
    refreshToken?: string;
    tags?: string[];
    categoryId?: string;
    privacyStatus?: "public" | "private" | "unlisted";
    requestId: string;
    onProgress?: (progress: {
      uploadedBytes: number;
      totalBytes: number;
    }) => void;
  }): Promise<VendorPublishResult> {
    try {
      const videoId = await this.uploadVideoResumable(
        {
          filePath: data.filePath,
          title: data.title,
          description: data.description,
          tags: data.tags,
          categoryId: data.categoryId || "22", // Default to "People & Blogs"
          privacyStatus: data.privacyStatus || "private",
          onProgress: data.onProgress,
        },
        data.accessToken,
        data.refreshToken
      );

      return {
        requestId: data.requestId,
        creationId: videoId,
        data: {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        },
      };
    } catch (error) {
      logger.error({ error }, "YouTube upload failed");
      throw error;
    }
  }

  /**
   * Upload video to YouTube with resumable upload and retry logic
   * Implements exponential backoff similar to the official Python sample
   */
  private async uploadVideoResumable(
    options: UploadOptions,
    accessToken: string,
    refreshToken?: string
  ): Promise<string> {
    const oauthClient = this.#googleOAuthService.getOAuthClient();

    // Set credentials
    oauthClient.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Proactively test and refresh token if needed BEFORE upload starts
    if (refreshToken) {
      try {
        logger.info("Testing YouTube token validity before upload...");
        const tokenInfo = await oauthClient.getAccessToken();

        if (tokenInfo.token) {
          logger.info("YouTube token refreshed successfully before upload");
          // Update access token with the fresh one
          oauthClient.setCredentials({
            access_token: tokenInfo.token,
            refresh_token: refreshToken,
          });
        }
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Failed to refresh YouTube token - refresh token may be invalid/revoked"
        );
        throw new Error(
          "YouTube authentication failed. Please re-authenticate your YouTube account. " +
            "Error: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    } else {
      logger.warn(
        "No refresh token provided - token cannot be refreshed if it expires"
      );
    }

    // Handle token refresh during upload
    oauthClient.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        logger.debug("YouTube: Refresh token updated");
      }
      if (tokens.access_token) {
        logger.debug("YouTube: Access token refreshed during upload");
      }
    });

    const youtube = google.youtube({ version: "v3", auth: oauthClient });

    // Prepare video metadata
    const videoMetadata = {
      snippet: {
        title: options.title,
        description: options.description || "",
        tags: options.tags || [],
        categoryId: options.categoryId || "22",
      },
      status: {
        privacyStatus: options.privacyStatus || "private",
      },
    };

    // Get file size for progress tracking
    const fileStats = fs.statSync(options.filePath);
    const totalBytes = fileStats.size;

    logger.info(
      {
        filePath: options.filePath,
        fileSize: totalBytes,
        title: options.title,
      },
      "Starting YouTube resumable upload"
    );

    // Perform resumable upload with retry logic
    let retry = 0;
    let lastError: Error | null = null;

    while (retry <= MAX_RETRIES) {
      try {
        const response = await youtube.videos.insert(
          {
            part: ["snippet", "status"],
            requestBody: videoMetadata,
            media: {
              body: fs.createReadStream(options.filePath),
            },
          },
          {
            // Enable resumable upload with chunk size
            onUploadProgress: (evt) => {
              const uploadedBytes = evt.bytesRead;
              if (options.onProgress) {
                options.onProgress({ uploadedBytes, totalBytes });
              }

              const progress = ((uploadedBytes / totalBytes) * 100).toFixed(2);
              logger.debug(
                { uploadedBytes, totalBytes, progress: `${progress}%` },
                "YouTube upload progress"
              );
            },
          }
        );

        const videoId = response.data.id;
        if (!videoId) {
          throw new Error("Upload succeeded but no video ID returned");
        }

        logger.info(
          { videoId, title: options.title },
          "YouTube video uploaded successfully"
        );

        return videoId;
      } catch (error) {
        const isRetriable = this.isRetriableError(error);
        lastError = error as Error;

        if (!isRetriable) {
          logger.error(
            { error, retry },
            "Non-retriable error during YouTube upload"
          );
          throw error;
        }

        retry++;
        if (retry > MAX_RETRIES) {
          logger.error(
            { error, retry: MAX_RETRIES },
            "Max retries exceeded for YouTube upload"
          );
          throw new Error(
            `YouTube upload failed after ${MAX_RETRIES} retries: ${lastError?.message}`
          );
        }

        // Exponential backoff with jitter
        const maxSleep = Math.pow(2, retry);
        const sleepSeconds = Math.random() * maxSleep;

        logger.warn(
          { retry, sleepSeconds, error: lastError?.message },
          `Retriable error during YouTube upload, retrying in ${sleepSeconds.toFixed(2)}s...`
        );

        await this.sleep(sleepSeconds * 1000);
      }
    }

    throw new Error(
      `YouTube upload failed after ${MAX_RETRIES} retries: ${lastError?.message}`
    );
  }

  /**
   * Check if an error is retriable based on status code or error type
   */
  private isRetriableError(error: any): boolean {
    // Check for GaxiosError with retriable status codes
    if (error?.response?.status) {
      const statusCode = error.response.status;
      if (RETRIABLE_STATUS_CODES.includes(statusCode)) {
        return true;
      }
    }

    // Check for network errors
    if (
      error?.code === "ECONNRESET" ||
      error?.code === "ETIMEDOUT" ||
      error?.code === "ENOTFOUND" ||
      error?.code === "EAI_AGAIN"
    ) {
      return true;
    }

    // Check for specific error messages that indicate transient issues
    const errorMessage = error?.message?.toLowerCase() || "";
    if (
      errorMessage.includes("socket hang up") ||
      errorMessage.includes("connection reset") ||
      errorMessage.includes("timeout")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getChannelList(
    accessToken: string,
    refreshToken?: string,
    part?: string[]
  ) {
    const oauthClient = this.#googleOAuthService.getOAuthClient();

    // Set credentials with both access and refresh tokens
    oauthClient.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Enable automatic token refresh
    oauthClient.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        logger.debug("Refresh token updated");
      }
      if (tokens.access_token) {
        logger.debug("Access token refreshed");
      }
    });

    const youtubeChannels = await google.youtube("v3").channels.list({
      auth: oauthClient,
      part: part || ["id", "status", "snippet"],
      mine: true,
    });

    return youtubeChannels.data;
  }
}

export default YouTubeService;
