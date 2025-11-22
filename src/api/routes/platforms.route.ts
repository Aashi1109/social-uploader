import { Router } from "express";
import { asyncHandler, bearerAuth } from "@/api/middleware";
import {
  validateCreatePlatformBody,
  validateUpdatePlatformBody,
  validatePlatformIdParams,
  validateProjectIdQuery,
} from "@/features/projects/validation";
import { PLATFORM_TYPES } from "@/shared/constants";
import { PlatformService } from "@/features";

const router = Router();
const platformService = new PlatformService();

router.get(
  "/",
  bearerAuth,
  validateProjectIdQuery,
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    const platforms = await platformService.list(projectId);
    return res.json({ data: platforms });
  })
);

router.get(
  "/config/:type",
  bearerAuth,
  asyncHandler(async (req, res) => {
    const config = await platformService.getBaseConfig(
      req.params.type as PLATFORM_TYPES
    );
    return res.json({ data: config });
  })
);

router.get(
  "/:id",
  bearerAuth,
  validatePlatformIdParams,
  asyncHandler(async (req, res) => {
    const platform = await platformService.getById(req.params.id as string);
    return res.json({ data: platform });
  })
);

router.post(
  "/",
  bearerAuth,
  validateCreatePlatformBody,
  asyncHandler(async (req, res) => {
    const platform = await platformService.create(req.body);
    return res.status(201).json({ data: platform });
  })
);

router.patch(
  "/:id",
  bearerAuth,
  validatePlatformIdParams,
  validateUpdatePlatformBody,
  asyncHandler(async (req, res) => {
    const platform = await platformService.update(
      req.params.id as string,
      req.body
    );
    return res.json({ data: platform });
  })
);

router.delete(
  "/:id",
  bearerAuth,
  validatePlatformIdParams,
  asyncHandler(async (req, res) => {
    await platformService.delete(req.params.id as string);
    return res.status(204).send();
  })
);

export default router;
