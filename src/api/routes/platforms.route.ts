import { Router } from "express";
import { asyncHandler, bearerAuth } from "@/api/middleware";
import { platformService } from "@/features/platforms/service";
import {
  validateCreatePlatformBody,
  validateUpdatePlatformBody,
  validatePlatformIdParams,
  validateProjectIdQuery,
} from "@/features/projects/validation";
import { PLATFORM_TYPES } from "@/shared/constants";

const router = Router();

router.get(
  "/",
  bearerAuth,
  validateProjectIdQuery,
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    const platforms = await platformService.listPlatforms(projectId);
    return res.json({ platforms });
  })
);

router.get(
  "/config/:type",
  bearerAuth,
  asyncHandler(async (req, res) => {
    const config = await platformService.getPlatformBaseConfig(
      req.params.type as PLATFORM_TYPES
    );
    return res.json({ config });
  })
);

router.get(
  "/:id",
  bearerAuth,
  validatePlatformIdParams,
  asyncHandler(async (req, res) => {
    const platform = await platformService.getPlatformById(
      req.params.id as string
    );
    return res.json({ platform });
  })
);

router.post(
  "/",
  bearerAuth,
  validateCreatePlatformBody,
  asyncHandler(async (req, res) => {
    const platform = await platformService.createPlatform(req.body);
    return res.status(201).json({ platform });
  })
);

router.patch(
  "/:id",
  bearerAuth,
  validatePlatformIdParams,
  validateUpdatePlatformBody,
  asyncHandler(async (req, res) => {
    const platform = await platformService.updatePlatform(
      req.params.id as string,
      req.body
    );
    return res.json({ platform });
  })
);

router.delete(
  "/:id",
  bearerAuth,
  validatePlatformIdParams,
  asyncHandler(async (req, res) => {
    await platformService.deletePlatform(req.params.id as string);
    return res.status(204).send();
  })
);

export default router;
