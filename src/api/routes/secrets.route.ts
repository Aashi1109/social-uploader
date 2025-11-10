import { Router } from "express";
import { bearerAuth } from "@/api/middleware";
import secretsService from "@/features/secret/service";
import { BadRequestError, NotFoundError } from "@/exceptions";

const router = Router();

router.get("/secrets/templates", (_req, res) => {
  const templates = secretsService.listTemplates();
  return res.json({ templates });
});

router.get("/secrets/templates/:type", (req, res) => {
  const tpl = secretsService.getTemplate(req.params.type);
  if (!tpl) throw new NotFoundError("Template not found");
  return res.json({ template: tpl });
});

router.post("/secrets/validate", bearerAuth, async (req, res) => {
  const type = String(req.body?.type || "");
  const data = (req.body?.data as any) || {};
  const result = await secretsService.validateAndVerify(type, data);
  if (!result.schema.valid) {
    throw new BadRequestError("invalid_schema", 400, {
      issues: result.schema.issues,
    });
  }
  if (!result.vendor.ok) {
    throw new BadRequestError("invalid_credentials", 400, {
      vendor: result.vendor.details,
    });
  }
  return res.json({ valid: true, vendor: result.vendor });
});

router.post("/secrets", bearerAuth, async (req, res) => {
  const scope = String(req.body?.scope || "");
  const type = String(req.body?.type || "");
  const data = (req.body?.data as any) || {};
  const meta = (req.body?.meta as any) || undefined;
  if (!scope || !type || typeof data !== "object") {
    throw new BadRequestError("invalid_payload", 400);
  }
  const { version } = await secretsService.createSecret({
    scope,
    type,
    data,
    meta,
  });
  return res.status(201).json({ version });
});

export default router;
