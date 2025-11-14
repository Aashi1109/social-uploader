import { Router } from "express";
import { asyncHandler, bearerAuth } from "@/api/middleware";
import secretsService from "@/features/secret/service";
import { BadRequestError, NotFoundError } from "@/exceptions";
import { PLATFORM_TYPES } from "@/shared/constants";
import { validateSecretCreateBody } from "@/features/secret/validation";

const router = Router();

router.get(
  "/templates",
  asyncHandler((_req, res) => {
    const templates = secretsService.listTemplates();
    return res.json({ templates });
  })
);

router.get(
  "/templates/:type",
  asyncHandler((req, res) => {
    const tpl = secretsService.getTemplate(req.params.type as string);
    if (!tpl) throw new NotFoundError("Template not found");
    return res.json({ template: tpl });
  })
);

router.post(
  "/validate",
  bearerAuth,
  asyncHandler(async (req, res) => {
    const { type, data } = req.body;
    const result = await secretsService.validateAndVerify({
      type: type as PLATFORM_TYPES,
      data,
    });

    if (!result.schema.valid) {
      throw new BadRequestError("invalid_schema", {
        issues: result.schema.issues,
      });
    }
    if (result.vendor.errors) {
      throw new BadRequestError("invalid_credentials", {
        vendor: result.vendor.errors,
      });
    }
    return res.json({ valid: true, vendor: result.vendor });
  })
);

router.post(
  "/",
  bearerAuth,
  [validateSecretCreateBody],
  asyncHandler(async (req, res) => {
    const { scope, type, data, meta, projectId } = req.body;
    const result = await secretsService.createSecret({
      scope,
      type,
      data,
      meta,
      projectId,
    });
    return res.status(201).json(result);
  })
);

export default router;
