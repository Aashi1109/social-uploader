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

class YouTubeService implements BasePlatformService {
  #googleOAuthService: GoogleOAuthService;
  #clientId: string;
  #clientSecret: string;
  constructor(clientId: string, clientSecret: string) {
    if (!clientId || !clientSecret) {
      throw new Error("Client ID and client secret are required");
    }
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
    this.#googleOAuthService = new GoogleOAuthService(clientId, clientSecret);
  }

  async verify(data: YouTubeSecret): Promise<VendorVerifyResult> {
    try {
      const { tokens } = data;
      if (isEmpty(tokens)) return this.initOAuth();
      const { refresh_token, access_token } = tokens!;
      if (isEmpty(refresh_token || access_token)) return this.initOAuth();

      const channelList = await this.getChannelList(
        access_token,
        refresh_token
      );
      logger.debug({ channelList }, "Channel list");
      return {
        data: { isIncomplete: false },
      };
    } catch (e: any) {
      return { errors: { message: e.message } };
    }
  }

  async initOAuth(): Promise<VendorVerifyResult> {
    const authorizationUri = this.#googleOAuthService.buildAuthorizationUri({
      state: { requestId: RequestContext.getRequestId() },
      scopes: config.platforms.youtube.requiredScopes || [],
      redirectUri: config.platforms.youtube.redirectUri || "",
    });

    return {
      data: {
        isIncomplete: true,
        authorizationUri: authorizationUri,
        redirectUri: config.platforms.youtube.redirectUri || "",
      },
    };
  }

  async publish(data: {}): Promise<VendorPublishResult> {
    throw new Error("Not implemented");
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

    logger.debug(
      {
        totalResults: youtubeChannels.data.pageInfo?.totalResults,
        itemsCount: youtubeChannels.data.items?.length,
      },
      "YouTube channels.list response"
    );

    return youtubeChannels.data;
  }
}

export default YouTubeService;
