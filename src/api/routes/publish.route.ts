import { Router } from "express";
import { bearerAuth, publishRateLimiter } from "@/api/middleware";
import { PublishRequestSchema } from "@/shared/utils/validation";
import { publishService, statusService } from "@/api/services";
import eventsService from "@/api/services/events.service";

const router = Router();

router.post("/publish", bearerAuth, publishRateLimiter, async (req, res) => {
  const parse = PublishRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "invalid_payload", details: parse.error.flatten() });
  }
  const { requestId } = await publishService.createPublishRequest(parse.data);
  return res.json({ requestId });
});

router.get("/publish/:id", async (req, res) => {
  const data = await statusService.getPublishStatus(req.params.id);
  if (!data) return res.status(404).json({ error: "not_found" });
  return res.json(data);
});

router.get("/publish/:id/events", async (req, res) => {
  const cursor =
    typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const limit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const page = await eventsService.getTraceEvents(req.params.id, {
    cursor,
    limit,
  });
  return res.json(page);
});

export default router;
