import { Router } from "express";
import { asyncHandler, bearerAuth } from "@/api/middleware";
import secretsService from "@/features/secret/service";
import { BadRequestError, NotFoundError } from "@/exceptions";
import { validateSecretCreateBody } from "@/features/secret/validation";

const router = Router();

router.get(
  "/templates/:type?",
  asyncHandler((req, res) => {
    const tpl = secretsService.getTemplate(req.params.type ?? "");
    if (!tpl) throw new NotFoundError("Template not found");
    return res.json({ data: tpl });
  })
);

router.post(
  "/",
  bearerAuth,
  [validateSecretCreateBody],
  asyncHandler(async (req, res) => {
    const { projectId, type, data, meta } = req.body;
    const result = await secretsService.createSecret({
      projectId,
      type,
      data,
      meta,
    });
    return res.status(201).json(result);
  })
);

router.get(
  "/:id/validate",
  bearerAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string")
      throw new BadRequestError("Id is required");

    const secret = await secretsService.getById(id);
    if (!secret) throw new NotFoundError("Secret not found");
    return res.json({ data: secret });
  })
);

router.get(
  "/:id",
  bearerAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== "string")
      throw new BadRequestError("Id is required");

    const secret = await secretsService.getById(id);
    if (!secret) throw new NotFoundError("Secret not found");
    return res.json({ data: secret });
  })
);

export default router;
