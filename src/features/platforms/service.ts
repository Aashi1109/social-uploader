import { Platform } from "./model";
import { Project } from "@/features/projects/model";
import { NotFoundError, BadRequestError } from "@/exceptions";
import { PLATFORM_TYPES } from "@/shared/constants";
import type { JsonObject } from "@/shared/types/json";
import config from "@/config";
import { pick } from "@/shared/utils";

export interface PlatformConfig extends JsonObject {
  mediaProfile?: Record<string, any>;
  credsRef?: string;
  mapping?: Record<string, any>;
  limits?: Record<string, any>;
  maxDurationSeconds?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  maxFileSizeMB?: number;
}

export class PlatformService {
  async listPlatforms(projectId?: string) {
    return await Platform.findAll({
      where: projectId ? { projectId } : undefined,
      include: [
        {
          association: "project",
          attributes: ["id", "name", "slug"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  async getPlatformById(id: string) {
    const platform = await Platform.findOne({
      where: { id },
      include: [
        {
          association: "project",
          attributes: ["id", "name", "slug"],
        },
      ],
    });

    if (!platform) {
      throw new NotFoundError("Platform not found");
    }

    return platform;
  }

  async getPlatformByProjectAndName(projectId: string, name: PLATFORM_TYPES) {
    const platform = await Platform.findOne({
      where: {
        projectId,
        name: name as any,
      },
      include: [
        {
          association: "project",
          attributes: ["id", "name", "slug"],
        },
      ],
    });

    if (!platform) {
      throw new NotFoundError("Platform not found");
    }

    return platform;
  }

  async createPlatform(data: {
    projectId: string;
    name: PLATFORM_TYPES;
    enabled?: boolean;
    config?: PlatformConfig;
  }) {
    // Verify project exists
    const project = await Project.findOne({
      where: { id: data.projectId },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    try {
      return await Platform.create(
        {
          projectId: data.projectId,
          name: data.name as any,
          enabled: data.enabled ?? true,
          config: data.config as any,
        },
        {
          include: [
            {
              association: "project",
              attributes: ["id", "name", "slug"],
            },
          ],
        }
      );
    } catch (error: any) {
      if (error.name === "SequelizeUniqueConstraintError") {
        throw new BadRequestError(
          "Platform with this name already exists for this project"
        );
      }
      throw error;
    }
  }

  async updatePlatform(
    id: string,
    data: {
      enabled?: boolean;
      config?: PlatformConfig;
    }
  ) {
    const platform = await Platform.findOne({ where: { id } });

    if (!platform) {
      throw new NotFoundError("Platform not found");
    }

    if (data.enabled !== undefined) {
      platform.enabled = data.enabled;
    }
    if (data.config !== undefined) {
      platform.config = data.config as any;
    }

    await platform.save();
    await platform.reload({
      include: [
        {
          association: "project",
          attributes: ["id", "name", "slug"],
        },
      ],
    });

    return platform;
  }

  async deletePlatform(id: string) {
    const platform = await Platform.findOne({ where: { id } });

    if (!platform) {
      throw new NotFoundError("Platform not found");
    }

    await platform.destroy();
    return { success: true };
  }

  async getPlatformBaseConfig(type: PLATFORM_TYPES) {
    if (type === PLATFORM_TYPES.INSTAGRAM) {
      const baseConfig = config.platforms.instagram;
      return pick(baseConfig, [
        "imagesRequirements",
        "videoRequirements",
      ] as const);
    }
    if (type === PLATFORM_TYPES.YOUTUBE) {
      const baseConfig = config.platforms.youtube;
      return pick(baseConfig, ["requiredScopes"] as const);
    }
    throw new BadRequestError(`Invalid platform type: ${type}`);
  }
}

export const platformService = new PlatformService();
