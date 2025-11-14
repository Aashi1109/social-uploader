import "dotenv/config";
import express from "express";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { DEFAULT_PORT } from "@/shared/constants";
import { logger } from "@/core/logger";
import { registerMetrics } from "@/api/plugins/metrics.plugin";
import publishRouter from "@/api/routes/publish.route";
import secretsRouter from "@/api/routes/secrets.route";
import oauthRouter from "@/api/routes/oauth.route";
import {
  errorHandler,
  RequestContext,
  requestContextMiddleware,
  requestLogger,
} from "./middleware";

const app = express();

app.use(express.json({ limit: "10mb" }));

app.use(requestContextMiddleware);

app.use(requestLogger);

registerMetrics(app);
app.use("/v1/publish", publishRouter);
app.use("/v1/secrets", secretsRouter);
app.use("/v1/oauth", oauthRouter);

// Basic health
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(DEFAULT_PORT, () => {
  logger.info({ port: DEFAULT_PORT }, "API listening");
});

export default app;
