import prisma from "@/prisma";
import { secrets } from "@/core/secrets";
import type { JsonObject } from "@/shared/types/json";
import { getSchema, PLATFORM_SCHEMAS } from "@/shared/secrets/schemas";
import { InstagramService } from "@/features/platforms/instagram";
import YouTubeService from "@/features/platforms/youtube/service";
import type { InstagramSecret, YouTubeSecret } from "@/shared/secrets/schemas";
import { PLATFORM_TYPES } from "@/shared/constants";
import { VendorPublishResult, VendorVerifyResult } from "@/shared/interfaces";
import { getRequestContextRequestId } from "@/api/middleware";
import { setPendingSecretCache } from "./helpers";
import { getUUID } from "@/shared/utils/ids";
import { Secret } from "@/prisma/generated";
import { isEmpty } from "@/shared/utils";

class SecretsService {
  getTemplate(type: string): object | undefined {
    if (!type) return PLATFORM_SCHEMAS;
    return getSchema(type) as object | undefined;
  }

  async createSecret(input: {
    projectId?: string;
    type: PLATFORM_TYPES.INSTAGRAM | PLATFORM_TYPES.YOUTUBE;
    data: InstagramSecret | YouTubeSecret;
    meta?: JsonObject;
    creationId?: string;
    tokens?: YouTubeSecret["tokens"] | InstagramSecret["tokens"];
  }): Promise<{ version: number; data?: VendorPublishResult }> {
    const { type, data, ...restArgs } = input;

    let vendor: VendorVerifyResult | undefined;
    if (type === PLATFORM_TYPES.INSTAGRAM) {
      const instagramService = new InstagramService(
        String((data as InstagramSecret).businessAccountId || ""),
        String((data as InstagramSecret).tokens || "")
      );
      vendor = await instagramService.verify(data as InstagramSecret);
    }
    if (type === PLATFORM_TYPES.YOUTUBE) {
      const youtubeService = new YouTubeService(
        (data as YouTubeSecret).clientId,
        (data as YouTubeSecret).clientSecret
      );
      const hasTokens = isEmpty(restArgs.tokens);
      if (hasTokens) {
        vendor = await youtubeService.verify(
          restArgs.tokens as YouTubeSecret["tokens"]
        );
      } else {
        vendor = await youtubeService.initOAuth();
      }
    }

    if (vendor?.data?.isIncomplete) {
      const requestId = getRequestContextRequestId();
      const encryptedData = secrets.encrypt({
        ...input,
        creationId: getUUID(),
      });
      await setPendingSecretCache(requestId!, encryptedData);
      return {
        version: -1,
        data: {
          requestId: getRequestContextRequestId(),
          creationId: getUUID(),
          ...vendor.data,
        },
      };
    }
    const encryptedTokens = secrets.encrypt(restArgs.tokens);

    const latest = await prisma.secret.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        data_encrypted: secrets.encrypt(input.data),
        meta: input.meta as any,
        version: 1,
        tokens: encryptedTokens,
      },
    });

    return { version: latest.version };
  }

  async getById(id: string): Promise<Secret | null> {
    const secret = await prisma.secret.findFirst({
      where: { id },
    });

    return secret;
  }
}

export default new SecretsService();
