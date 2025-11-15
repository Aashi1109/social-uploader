import { Router } from "express";
import { asyncHandler, bearerAuth } from "@/api/middleware";
import { projectService } from "@/features/projects/service";
import {
  validateCreateProjectBody,
  validateUpdateProjectBody,
  validateProjectIdParams,
} from "@/features/projects/validation";

const router = Router();

router.get(
  "/",
  bearerAuth,
  asyncHandler(async (_req, res) => {
    const projects = await projectService.listProjects();
    return res.json({ projects });
  })
);

router.get(
  "/:id",
  bearerAuth,
  validateProjectIdParams,
  asyncHandler(async (req, res) => {
    const project = await projectService.getProjectById(
      req.params.id as string
    );
    return res.json({ project });
  })
);

router.post(
  "/",
  bearerAuth,
  validateCreateProjectBody,
  asyncHandler(async (req, res) => {
    const project = await projectService.createProject(req.body);
    return res.status(201).json({ data: project });
  })
);

router.patch(
  "/:id",
  bearerAuth,
  validateProjectIdParams,
  validateUpdateProjectBody,
  asyncHandler(async (req, res) => {
    const project = await projectService.updateProject(
      req.params.id as string,
      req.body
    );
    return res.json({ project });
  })
);

router.delete(
  "/:id",
  bearerAuth,
  validateProjectIdParams,
  asyncHandler(async (req, res) => {
    await projectService.deleteProject(req.params.id as string);
    return res.status(204).send();
  })
);

export default router;
