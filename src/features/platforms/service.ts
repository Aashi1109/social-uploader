import { Platform } from "./model";
import { NotFoundError, BadRequestError } from "@/shared/exceptions";
import { PLATFORM_TYPES } from "@/shared/constants";
import config from "@/config";
import { pick } from "@/shared/utils";
import SecretsService from "../secrets/service";
import {
  deletePlatformCacheById,
  getPlatformCacheById,
  setPlatformCacheById,
} from "./helper";
import { getSafeMaskedSecret } from "../secrets/utils";
import { JsonSchema } from "@/shared/types/json";

export interface PlatformConfig extends JsonSchema {
  mediaProfile?: JsonSchema;
  mapping?: JsonSchema;
  limits?: JsonSchema;
  maxDurationSeconds?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  maxFileSizeMB?: number;
}

class PlatformService {
  #secretService: SecretsService;

  constructor() {
    this.#secretService = new SecretsService();
  }

  async list(projectId?: string) {
    const platforms = await Platform.findAll({
      where: projectId ? { projectId } : undefined,
      order: [["createdAt", "DESC"]],
      include: [{ association: "secret" }],
    });

    return platforms;
  }

  async getById(id: string, noSafeMask = false) {
    let platform = await getPlatformCacheById(id);

    if (!platform) {
      platform = await Platform.findOne({
        where: { id },
        include: [{ association: "secret" }],
      });
    }

    if (!platform) throw new NotFoundError("Platform not found");

    // If secret is already included in the association, use it
    const secret =
      platform.secret || (await this.#secretService.getById(platform.secretId));

    if (!secret) throw new NotFoundError("Secret not found");

    const maskedSecret = noSafeMask ? secret : getSafeMaskedSecret(secret);
    if (!noSafeMask) await setPlatformCacheById(platform.id, platform);
    return { ...platform, secret: maskedSecret };
  }

  async getPlatformByProjectAndName(projectId: string, name: PLATFORM_TYPES) {
    const platform = await Platform.findOne({
      where: {
        projectId,
        name: name,
      },
      include: [{ association: "secret" }],
    });

    if (!platform) throw new NotFoundError("Platform not found");

    return platform;
  }

  async create(data: {
    projectId: string;
    name: string;
    type: PLATFORM_TYPES;
    enabled?: boolean;
    secretId: string;
  }) {
    try {
      const secret = await this.#secretService.getById(data.secretId);
      if (!secret) throw new NotFoundError("Secret not found");
      const platform = await Platform.create({
        projectId: data.projectId,
        name: data.name,
        enabled: data.enabled ?? true,
        type: data.type,
        secretId: data.secretId,
        config: this.getBaseConfig(data.type),
      });

      const maskedSecret = getSafeMaskedSecret(secret);
      await setPlatformCacheById(platform.id, platform);

      return { ...platform.toJSON(), secret: maskedSecret };
    } catch (error: any) {
      if (error.name === "SequelizeUniqueConstraintError") {
        throw new BadRequestError(
          "Platform with this name already exists for this project"
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    data: {
      enabled?: boolean;
      config?: PlatformConfig;
    }
  ) {
    const platform = await Platform.findOne({ where: { id } });
    if (!platform) throw new NotFoundError("Platform not found");

    platform.enabled = data.enabled ?? platform.enabled;
    await platform.save();

    await deletePlatformCacheById(platform.id);
    return platform;
  }

  async delete(id: string) {
    const platform = await Platform.findOne({ where: { id } });
    if (!platform) throw new NotFoundError("Platform not found");

    await platform.destroy();
    deletePlatformCacheById(platform.id);
    return { success: true };
  }

  getBaseConfig(type: PLATFORM_TYPES) {
    if (type === PLATFORM_TYPES.INSTAGRAM) {
      const baseConfig = config.platforms.instagram;
      return pick(baseConfig, ["image", "video"] as const);
    }
    if (type === PLATFORM_TYPES.YOUTUBE) {
      const baseConfig = config.platforms.youtube;
      return pick(baseConfig, ["video"] as const);
    }
    throw new BadRequestError(`Invalid platform type: ${type}`);
  }
}

export default PlatformService;
