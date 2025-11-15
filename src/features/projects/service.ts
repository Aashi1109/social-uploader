import prisma from "@/prisma";
import { NotFoundError, BadRequestError } from "@/exceptions";
import { slugify } from "@/shared/utils";

export class ProjectService {
  async listProjects() {
    return await prisma.project.findMany({
      include: {
        platforms: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getProjectById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        platforms: true,
      },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    return project;
  }

  async getProjectBySlug(slug: string) {
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        platforms: true,
      },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    return project;
  }

  async createProject(data: { name: string; webhookUrl?: string | null }) {
    try {
      const slug = await this.getUniqueSlug(data.name);
      return await prisma.project.create({
        data: {
          slug,
          name: data.name,
          webhookUrl: data.webhookUrl,
        },
        include: {
          platforms: true,
        },
      });
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new BadRequestError("Project with this name already exists");
      }
      throw error;
    }
  }

  async updateProject(
    id: string,
    data: {
      name?: string;
      webhookUrl?: string | null;
    }
  ) {
    try {
      return await prisma.project.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.webhookUrl !== undefined && { webhookUrl: data.webhookUrl }),
        },
        include: {
          platforms: true,
        },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError("Project not found");
      }
      throw error;
    }
  }

  async deleteProject(id: string) {
    try {
      await prisma.project.delete({
        where: { id },
      });
      return { success: true };
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError("Project not found");
      }
      throw error;
    }
  }

  async getUniqueSlug(title: string) {
    const base = slugify(title);

    const existing = await prisma.project.findMany({
      where: {
        slug: {
          startsWith: base,
        },
      },
      select: { slug: true },
    });

    if (existing.length === 0) {
      return base;
    }

    // Extract numbers after base slug: e.g., my-project-3 → 3
    const numbers = existing
      .map((e) => {
        const match = e.slug.match(new RegExp(`^${base}-(\\d+)$`));
        return match ? parseInt(match[1] ?? "0", 10) : 0;
      })
      .sort((a, b) => b - a);

    const next = (numbers[0] ?? 0) + 1;
    return `${base}-${next}`;
  }
}

export const projectService = new ProjectService();
