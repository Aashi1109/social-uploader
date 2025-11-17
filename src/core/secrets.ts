import { Secret } from "@/features/secret/model";
import { encryptAesGcm, decryptAesGcm } from "@/shared/utils/crypto";
import type { JsonObject, JsonValue } from "@/shared/types/json";

export interface SecretManager {
  encrypt(data: JsonValue): string;
  decrypt<T = JsonValue>(ciphertext: string): T;
  get<T = JsonValue>(scope: string, type: string): Promise<T | null>;
  put(
    scope: string,
    type: string,
    data: JsonValue,
    meta?: JsonObject
  ): Promise<void>;
}

export class LocalAesSecretManager implements SecretManager {
  encrypt(data: JsonValue): string {
    return encryptAesGcm(data);
  }
  decrypt<T = JsonValue>(ciphertext: string): T {
    return decryptAesGcm<T>(ciphertext);
  }
  async get<T = JsonValue>(scope: string, type: string): Promise<T | null> {
    // scope can be 'global' or 'project:{id}'
    const projectId = scope === "global" ? null : scope.replace("project:", "");

    const row = await Secret.findOne({
      where: {
        projectId: projectId === "global" ? null : projectId,
        type,
      },
      order: [["version", "DESC"]],
    });
    if (!row) return null;

    // Data is automatically decrypted via the getter
    return row.data as T;
  }
  async put(
    scope: string,
    type: string,
    data: JsonValue,
    meta?: JsonObject
  ): Promise<void> {
    // scope can be 'global' or 'project:{id}'
    const projectId = scope === "global" ? null : scope.replace("project:", "");

    const latest = await Secret.findOne({
      where: {
        projectId: projectId === "global" ? null : projectId,
        type,
      },
      order: [["version", "DESC"]],
      attributes: ["version"],
    });
    const version = (latest?.version || 0) + 1;
    const dataEncrypted = this.encrypt(data);

    await Secret.create({
      projectId: projectId === "global" ? null : projectId,
      type: type as any,
      version,
      dataEncrypted,
      meta: meta as any,
    });
  }
}

export const secrets: SecretManager = new LocalAesSecretManager();
