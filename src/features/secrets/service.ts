import { Secret } from "./model";
import type { JsonSchema } from "@/shared/types/json";
import { getSchema, PLATFORM_SCHEMAS } from "@/shared/secrets/schemas";
import { InstagramService } from "@/features/platforms/instagram";
import YouTubeService from "@/features/platforms/youtube/service";
import type { InstagramSecret, YouTubeSecret } from "@/shared/secrets/schemas";
import { PLATFORM_TYPES } from "@/shared/constants";
import { VendorPublishResult, VendorVerifyResult } from "@/shared/interfaces";
import { getRequestContextRequestId } from "@/api/middleware";
import { setPendingSecretCache } from "./helpers";
import { getUUID } from "@/shared/utils/ids";
import { isEmpty } from "@/shared/utils";
import { NotFoundError } from "@/shared/exceptions";
import { decryptAesGcm, encryptAesGcm } from "@/shared/utils/crypto";

class SecretsService {
  getTemplate(type: string): object | undefined {
    if (!type) return PLATFORM_SCHEMAS;
    return getSchema(type) as object | undefined;
  }

  async create(input: {
    platformIds: string[];
    type: PLATFORM_TYPES;
    data: InstagramSecret | YouTubeSecret;
    meta?: JsonSchema;
    tokens?: YouTubeSecret["tokens"] | InstagramSecret["tokens"];
  }): Promise<{ version: number; id?: string; data?: VendorPublishResult }> {
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
      const hasTokens = !isEmpty(restArgs.tokens);
      if (hasTokens) {
        vendor = await youtubeService.verify(
          restArgs.tokens as YouTubeSecret["tokens"]
        );
      } else {
        vendor = youtubeService.initOAuth();
      }
    }

    if (vendor?.data?.isIncomplete) {
      const requestId = getRequestContextRequestId();
      const encryptedData = this.encrypt({
        ...input,
        creationId: getUUID(),
      });

      await setPendingSecretCache(requestId!, encryptedData);
      return {
        version: -1,

        data: {
          requestId: getRequestContextRequestId(),
          ...vendor.data,
        },
      };
    }

    const latest = await Secret.create({
      type: input.type,
      data: input.data,
      meta: input.meta,
      version: 1,
      tokens: restArgs.tokens as JsonSchema,
    });

    return { version: latest.version, id: latest.id };
  }

  async getById(id: string) {
    const secret = await Secret.findOne({
      where: { id },
    });
    if (!secret) throw new NotFoundError("Secret not found");

    return secret;
  }

  async update(
    id: string,
    input: {
      meta?: JsonSchema;
      tokens?: YouTubeSecret["tokens"] | InstagramSecret["tokens"];
    }
  ) {
    const { meta, tokens } = input;
    let secret = await Secret.findOne({
      where: { id },
    });
    if (!secret) throw new NotFoundError("Secret not found");

    secret.meta = meta || secret.meta;

    // IMPORTANT: Merge tokens instead of replacing to preserve refresh token
    if (tokens) {
      const existingTokens = ((secret.tokens as JsonSchema) || {}) as Record<
        string,
        any
      >;
      const newTokens = tokens as Record<string, any>;
      secret.tokens = {
        ...existingTokens,
        ...newTokens,
      } as JsonSchema;
    }

    secret = await secret.save();

    return secret;
  }

  async delete(id: string) {
    const secret = await Secret.findOne({
      where: { id },
    });
    if (!secret) throw new NotFoundError("Secret not found");
    await secret.destroy();
    return secret;
  }

  async refresh(id: string) {
    const secret = await Secret.findOne({
      where: { id },
    });
    if (!secret) throw new NotFoundError("Secret not found");
    if (secret.type === PLATFORM_TYPES.YOUTUBE) {
      const youtubeService = new YouTubeService(
        (secret.data as YouTubeSecret).clientId,
        (secret.data as YouTubeSecret).clientSecret
      );
      const newTokens = youtubeService.initOAuth(true, id);
      return newTokens;
    }
    // if (secret.type === PLATFORM_TYPES.INSTAGRAM) {
    //   const instagramService = new InstagramService(
    //     (secret.data as InstagramSecret).businessAccountId,
    //     (secret.data as InstagramSecret).tokens
    //   );
    //   const newTokens = await instagramService.refresh(tokens);
    //   secret.tokens = newTokens;
    // }
    return secret;
  }

  encrypt(data: JsonSchema): string {
    return encryptAesGcm(data);
  }
  decrypt<T = JsonSchema>(text: string): T {
    return decryptAesGcm<T>(text);
  }
}

export default SecretsService;
