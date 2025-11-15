import prisma from "@/prisma";
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
    return await prisma.platform.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getPlatformById(id: string) {
    const platform = await prisma.platform.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!platform) {
      throw new NotFoundError("Platform not found");
    }

    return platform;
  }

  async getPlatformByProjectAndName(projectId: string, name: PLATFORM_TYPES) {
    const platform = await prisma.platform.findUnique({
      where: {
        projectId_name: {
          projectId,
          name: name as any,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
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
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    try {
      return await prisma.platform.create({
        data: {
          projectId: data.projectId,
          name: data.name as any,
          enabled: data.enabled ?? true,
          config: data.config as any,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
    } catch (error: any) {
      if (error.code === "P2002") {
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
    try {
      return await prisma.platform.update({
        where: { id },
        data: {
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          ...(data.config !== undefined && { config: data.config as any }),
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError("Platform not found");
      }
      throw error;
    }
  }

  async deletePlatform(id: string) {
    try {
      await prisma.platform.delete({
        where: { id },
      });
      return { success: true };
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError("Platform not found");
      }
      throw error;
    }
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
