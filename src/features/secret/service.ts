import type { ErrorObject } from "ajv";
import prisma from "@/prisma";
import { secrets } from "@/core/secrets";
import type { JsonObject } from "@/shared/types/json";
import { getSchema, listTemplateDescriptors } from "@/shared/secrets/schemas";
import { InstagramService } from "@/features/platforms/instagram";
import YouTubeService from "@/features/platforms/youtube/service";
import { BadRequestError } from "@/exceptions";
import ajv from "@/shared/ajv";
import type { InstagramSecret, YouTubeSecret } from "@/shared/secrets/schemas";
import { PLATFORM_TYPES } from "@/shared/constants";
import { VendorPublishResult, VendorVerifyResult } from "@/shared/interfaces";
import { logger } from "@/core/logger";
import { getRequestContextRequestId } from "@/api/middleware";
import { setPendingSecretCache } from "./helpers";
import { getUUID } from "@/shared/utils/ids";

type ValidateResult = {
  valid: boolean;
  issues?: { path: string; message: string }[];
};

type ValidateAndVerifyArgs =
  | ({ type: PLATFORM_TYPES.INSTAGRAM } & { data: InstagramSecret })
  | ({ type: PLATFORM_TYPES.YOUTUBE } & { data: YouTubeSecret });

function toIssues(errors: ErrorObject[] | null | undefined) {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || e.schemaPath || "",
    message: e.message || "invalid",
  }));
}

class SecretsService {
  listTemplates(): ReturnType<typeof listTemplateDescriptors> {
    return listTemplateDescriptors();
  }

  getTemplate(type: string): object | undefined {
    return getSchema(type) as object | undefined;
  }

  validateSchema(type: string, data: JsonObject): ValidateResult {
    logger.info({ type, data }, "Validating schema");

    if (!type || !data) throw new BadRequestError("Invalid Request Body");

    const schema = getSchema(type);
    if (!schema) {
      return { valid: false, issues: [{ path: "", message: "unknown_type" }] };
    }
    const validate = ajv.compile(schema as any);
    const valid = validate(data);
    return valid
      ? { valid: true }
      : { valid: false, issues: toIssues((validate as any).errors) };
  }

  async validateAndVerify(args: ValidateAndVerifyArgs): Promise<{
    schema: ValidateResult;
    vendor: VendorVerifyResult;
  }> {
    const { type, data, ...restArgs } = args;
    const schema = this.validateSchema(type, data);
    if (!schema.valid) {
      return { schema, vendor: { errors: { message: "Invalid schema" } } };
    }
    if (type === PLATFORM_TYPES.INSTAGRAM) {
      const instagramService = new InstagramService(
        String(data.businessAccountId || ""),
        String(data.tokens || "")
      );
      const vendor = await instagramService.verify(data);
      return { schema, vendor };
    }
    if (type === PLATFORM_TYPES.YOUTUBE) {
      const vendor = await new YouTubeService(
        data.clientId,
        data.clientSecret
      ).verify({ ...data, ...restArgs } as YouTubeSecret);
      return { schema, vendor };
    }
    return { schema, vendor: { data: { type } } };
  }

  async createSecret(input: {
    scope: string; // "global" | `project:{id}`
    type: PLATFORM_TYPES.INSTAGRAM | PLATFORM_TYPES.YOUTUBE;
    data: InstagramSecret | YouTubeSecret;
    meta?: JsonObject;
    projectId: string;
    creationId?: string;
    tokens?: YouTubeSecret["tokens"] | InstagramSecret["tokens"];
  }): Promise<{ version: number; data?: VendorPublishResult }> {
    const { type, data, ...restArgs } = input;
    const { schema, vendor } = await this.validateAndVerify({
      type,
      data,
      ...restArgs,
    } as ValidateAndVerifyArgs);

    if (!schema.valid) {
      throw new BadRequestError("invalid_schema", {
        issues: schema.issues || [],
      });
    }

    if (vendor.data?.isIncomplete) {
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
        scope: input.scope,
        type: input.type,
        data_encrypted: secrets.encrypt(input.data),
        meta: input.meta as any,
        version: 1,
        tokens: encryptedTokens,
      },
    });

    return { version: latest.version };
  }
}

export default new SecretsService();
