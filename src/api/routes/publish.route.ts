import { Router } from "express";
import { asyncHandler, bearerAuth, publishRateLimiter } from "@/api/middleware";
import { PublishService } from "@/features";
import { BadRequestError, NotFoundError } from "@/shared/exceptions";
import { validatePublishCreate } from "@/features/publish/validation";

const router = Router();
const publishService = new PublishService();

router.post(
  "/:projectId",
  [bearerAuth, publishRateLimiter, validatePublishCreate],
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    if (!projectId) throw new BadRequestError("Project ID is required");
    const { requestId } = await publishService.create({
      projectId,
      ...req.body,
    });
    return res.json({ requestId });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { projectId, id: requestId } = req.query;
    if (!projectId || !requestId)
      throw new BadRequestError("Project ID and request ID are required");

    const data = await publishService.getPublishStatus(
      requestId as string,
      projectId as string
    );
    if (!data) throw new NotFoundError("Publish not found");
    return res.json(data);
  })
);

export default router;
