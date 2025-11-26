import { Platform } from "./model";
import { NotFoundError, BadRequestError } from "@/shared/exceptions";
import { PLATFORM_TYPES } from "@/shared/constants";
import config from "@/config";
import { isEmpty, pick } from "@/shared/utils";
import SecretsService from "../secrets/service";
import {
  deletePlatformCacheById,
  getPlatformCacheById,
  setPlatformCacheById,
} from "./helper";
import { getSafeMaskedSecret } from "../secrets/utils";
import {
  YOUTUBE_UPLOAD_DEFAULTS,
  YOUTUBE_PUBLISH_TYPES,
  YOUTUBE_VISIBILITY,
} from "./youtube/constants";
import {
  INSTAGRAM_PUBLISH_TYPES,
  INSTAGRAM_UPLOAD_DEFAULTS,
  INSTAGRAM_VISIBILITY,
} from "./instagram/constants";

export type PlatformConfig =
  | {
      uploadType: (typeof YOUTUBE_PUBLISH_TYPES)[keyof typeof YOUTUBE_PUBLISH_TYPES];
      visibility: (typeof YOUTUBE_VISIBILITY)[keyof typeof YOUTUBE_VISIBILITY];
      enforceConstraints?: boolean; // If true, throw error on constraint violation; if false (default), auto-format media
    }
  | {
      uploadType: (typeof INSTAGRAM_PUBLISH_TYPES)[keyof typeof INSTAGRAM_PUBLISH_TYPES];
      visibility: (typeof INSTAGRAM_VISIBILITY)[keyof typeof INSTAGRAM_VISIBILITY];
      enforceConstraints?: boolean; // If true, throw error on constraint violation; if false (default), auto-format media
    };

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
    config: PlatformConfig;
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
        config: this.getBaseConfig(data.type, data.config),
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
    if (!isEmpty(data.config)) {
      platform.config = this.getBaseConfig(platform.type, data.config!);
    }
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

  getBaseConfig(type: PLATFORM_TYPES, config: PlatformConfig) {
    const { uploadType, visibility, enforceConstraints } = config;

    let configObject;

    switch (type) {
      case PLATFORM_TYPES.INSTAGRAM:
        configObject = INSTAGRAM_UPLOAD_DEFAULTS;
        break;
      case PLATFORM_TYPES.YOUTUBE:
        configObject = YOUTUBE_UPLOAD_DEFAULTS;
        break;
      default:
        throw new BadRequestError(`Invalid platform type: ${type}`);
    }

    const _config = {
      ...((configObject as any)[uploadType] || {}),
      visibility,
      // enforceConstraints: if true, throw error on constraint violation; if false (default), auto-format media
      enforceConstraints: enforceConstraints ?? false,
    };

    return _config;
  }
}

export default PlatformService;
