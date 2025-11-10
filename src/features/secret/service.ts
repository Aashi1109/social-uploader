import type { ErrorObject } from "ajv";
import prisma from "../../prisma";
import { secrets } from "@/core/secrets";
import type { JsonObject } from "@/shared/types/json";
import { getSchema, listTemplateDescriptors } from "@/shared/secrets/schemas";
import InstagramService from "@/features/platforms/instagram.service";
import YouTubeService from "@/features/platforms/youtube.service";
import { BadRequestError } from "@/exceptions";
import ajv from "@/shared/ajv";
import type { InstagramSecret, YouTubeSecret } from "@/shared/secrets/schemas";
type ValidateResult = {
  valid: boolean;
  issues?: { path: string; message: string }[];
};

type VendorVerifyResult = {
  ok: boolean;
  details?: JsonObject;
};

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

  async validateAndVerify(
    type: string,
    data: JsonObject
  ): Promise<{
    schema: ValidateResult;
    vendor: VendorVerifyResult;
  }> {
    const schema = this.validateSchema(type, data);
    if (!schema.valid) {
      return { schema, vendor: { ok: false } };
    }
    if (type === "instagram") {
      const vendor = await InstagramService.verify(
        data as InstagramSecret & JsonObject
      );
      return { schema, vendor };
    }
    if (type === "youtube") {
      const vendor = await YouTubeService.verify(
        data as YouTubeSecret & JsonObject
      );
      return { schema, vendor };
    }
    // For unknown types, schema valid implies ok (no vendor check)
    return { schema, vendor: { ok: true } };
  }

  async createSecret(input: {
    scope: string; // "global" | `project:{id}`
    type: string;
    data: JsonObject;
    meta?: JsonObject;
  }): Promise<{ version: number }> {
    const { type, data } = input;
    const { schema, vendor } = await this.validateAndVerify(type, data);
    if (!schema.valid) {
      throw new BadRequestError("invalid_schema", 400, {
        issues: schema.issues || [],
      });
    }
    if (!vendor.ok) {
      throw new BadRequestError("invalid_credentials", 400, {
        vendor: vendor.details || {},
      });
    }
    const latest = await prisma.secret.findFirst({
      where: { scope: input.scope, type: input.type },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version || 0) + 1;
    await secrets.put(input.scope, input.type, input.data, input.meta);
    return { version: nextVersion };
  }
}

export default new SecretsService();
