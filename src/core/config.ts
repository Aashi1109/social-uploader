import type { ProjectConfig } from "@/shared/types/config";
import prisma from "../prisma";

// Minimal in-code config for MVP. Can be extended or loaded from DB later.
const defaultProject: ProjectConfig = {
  projectId: "default",
  platforms: [
    {
      name: "instagram",
      enabled: true,
      mediaProfile: {
        maxDurationSeconds: 60,
        minAspectRatio: 0.5,
        maxAspectRatio: 2,
      },
    },
    {
      name: "youtube",
      enabled: true,
      mediaProfile: {
        maxDurationSeconds: 3600,
        minAspectRatio: 0.5,
        maxAspectRatio: 2,
      },
    },
  ],
};

const projects: Record<string, ProjectConfig> = {
  [defaultProject.projectId]: defaultProject,
};

export async function getProjectConfig(
  projectId: string
): Promise<ProjectConfig | null> {
  // Try DB-backed config
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { platforms: true },
  });
  if (project) {
    return {
      projectId: project.id,
      platforms: project.platforms.map(
        (p: {
          name: string;
          enabled: boolean;
          maxDurationSeconds: number | null;
          minAspectRatio: number | null;
          maxAspectRatio: number | null;
          maxFileSizeMB: number | null;
        }) => ({
          name: p.name as any,
          enabled: p.enabled,
          mediaProfile: {
            maxDurationSeconds: p.maxDurationSeconds ?? undefined,
            minAspectRatio: p.minAspectRatio ?? undefined,
            maxAspectRatio: p.maxAspectRatio ?? undefined,
            maxFileSizeMB: p.maxFileSizeMB ?? undefined,
          },
        })
      ),
    };
  }
  // Fallback to in-code default
  return projects[projectId] || null;
}
