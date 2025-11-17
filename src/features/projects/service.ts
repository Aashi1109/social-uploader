import { Project } from "./model";
import { NotFoundError, BadRequestError } from "@/exceptions";
import { slugify } from "@/shared/utils";
import { Op } from "sequelize";

export class ProjectService {
  async listProjects() {
    return await Project.findAll({
      include: [{ association: "platforms" }],
      order: [["createdAt", "DESC"]],
    });
  }

  async getProjectById(id: string) {
    const project = await Project.findOne({
      where: { id },
      include: [{ association: "platforms" }],
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    return project;
  }

  async getProjectBySlug(slug: string) {
    const project = await Project.findOne({
      where: { slug },
      include: [{ association: "platforms" }],
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    return project;
  }

  async createProject(data: { name: string; webhookUrl?: string | null }) {
    try {
      const slug = await this.getUniqueSlug(data.name);
      return await Project.create(
        {
          slug,
          name: data.name,
          webhookUrl: data.webhookUrl || null,
        },
        {
          include: [{ association: "platforms" }],
        }
      );
    } catch (error: any) {
      if (error.name === "SequelizeUniqueConstraintError") {
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
    const project = await Project.findOne({ where: { id } });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (data.name !== undefined) {
      project.name = data.name;
    }
    if (data.webhookUrl !== undefined) {
      project.webhookUrl = data.webhookUrl;
    }

    await project.save();
    await project.reload({ include: [{ association: "platforms" }] });

    return project;
  }

  async deleteProject(id: string) {
    const project = await Project.findOne({ where: { id } });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await project.destroy();
    return { success: true };
  }

  async getUniqueSlug(title: string) {
    const base = slugify(title);

    const existing = await Project.findAll({
      where: {
        slug: {
          [Op.startsWith]: base,
        },
      },
      attributes: ["slug"],
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
