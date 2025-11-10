import "dotenv/config";
import express from "express";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { DEFAULT_PORT } from "@/shared/constants";
import { logger } from "@/core/logger";
import { registerMetrics } from "@/api/plugins/metrics.plugin";
import publishRouter from "@/api/routes/publish.route";
import secretsRouter from "@/api/routes/secrets.route";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(
  pinoHttp({
    logger,
    genReqId: (req) =>
      (req.headers["x-request-id"] as string) ?? crypto.randomUUID(),
  })
);

registerMetrics(app);
app.use("/v1", publishRouter);
app.use("/v1", secretsRouter);

// Basic health
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // Prefer structured CustomError if available
    const status: number = typeof err?.status === "number" ? err.status : 500;
    const message: string =
      typeof err?.message === "string" ? err.message : "internal_error";
    const additionalInfo = err?.additionalInfo;
    logger.error({ err, status, message }, "Unhandled error");
    const body: any = { error: message };
    if (additionalInfo) body.details = additionalInfo;
    res.status(status).json(body);
  }
);

app.listen(DEFAULT_PORT, () => {
  logger.info({ port: DEFAULT_PORT }, "API listening");
});

export default app;
