import { Router } from "express";
import { asyncHandler, bearerAuth } from "@/api/middleware";
import {
  validateCreateProjectBody,
  validateUpdateProjectBody,
  validateProjectIdParams,
} from "@/features/projects/validation";
import { ProjectService } from "@/features";
import { BadRequestError } from "@/shared/exceptions";
import { PlatformService } from "@/features/platforms/service";

const router = Router();
const projectService = new ProjectService();

router
  .route("/")
  .get(
    bearerAuth,
    asyncHandler(async (_req, res) => {
      const projects = await projectService.listProjects();
      return res.json({ projects });
    })
  )
  .post(
    bearerAuth,
    validateCreateProjectBody,
    asyncHandler(async (req, res) => {
      const project = await projectService.create(req.body);
      return res.status(201).json({ data: project });
    })
  );

router.get(
  "/:slug/slug",
  bearerAuth,
  asyncHandler(async (req, res) => {
    if (!req.params.slug) throw new BadRequestError("Slug is required");
    const project = await projectService.getBySlug(req.params.slug as string);
    return res.json({ data: project });
  })
);

router
  .route("/:id")
  .get(
    bearerAuth,
    validateProjectIdParams,
    asyncHandler(async (req, res) => {
      const project = await projectService.getById(req.params.id as string);
      return res.json({ data: project });
    })
  )
  .patch(
    bearerAuth,
    validateProjectIdParams,
    validateUpdateProjectBody,
    asyncHandler(async (req, res) => {
      const project = await projectService.update(
        req.params.id as string,
        req.body
      );
      return res.json({ data: project });
    })
  )
  .delete(
    bearerAuth,
    validateProjectIdParams,
    asyncHandler(async (req, res) => {
      await projectService.delete(req.params.id as string);
      return res.status(204).send();
    })
  );

export default router;
