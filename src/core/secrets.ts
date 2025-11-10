import prisma from "../prisma";
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
    const row = await prisma.secret.findFirst({
      where: { scope, type },
      orderBy: { version: "desc" },
    });
    if (!row) return null;
    return this.decrypt<T>(row.data_encrypted);
  }
  async put(
    scope: string,
    type: string,
    data: JsonValue,
    meta?: JsonObject
  ): Promise<void> {
    const latest = await prisma.secret.findFirst({
      where: { scope, type },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version || 0) + 1;
    const data_encrypted = this.encrypt(data);
    await prisma.secret.create({
      data: { scope, type, version, data_encrypted, meta },
    });
  }
}

export const secrets: SecretManager = new LocalAesSecretManager();
